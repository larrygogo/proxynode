import { createServer, Server, Socket } from 'net';
import { v4 as uuidv4 } from 'uuid';
import { NodeManager } from '../manager/node-manager';
import { MasterWebSocketServer } from '../websocket/websocket-server';
import { ProxyRequestMessage } from '../types';

export class Socks5ProxyServer {
  private server: Server;
  private nodeManager: NodeManager;
  private wsServer: MasterWebSocketServer;

  constructor(nodeManager: NodeManager, wsServer: MasterWebSocketServer) {
    this.nodeManager = nodeManager;
    this.wsServer = wsServer;
    this.server = createServer(this.handleConnection.bind(this));
  }

  private async handleConnection(clientSocket: Socket): Promise<void> {
    // 读取 SOCKS5 握手
    clientSocket.once('data', async (data: Buffer) => {
      try {
        // SOCKS5 握手
        if (data[0] !== 0x05) {
          clientSocket.destroy();
          return;
        }

        // 发送认证方法（无认证）
        clientSocket.write(Buffer.from([0x05, 0x00]));

        // 读取连接请求
        clientSocket.once('data', async (requestData: Buffer) => {
          try {
            if (requestData[0] !== 0x05 || requestData[1] !== 0x01) {
              clientSocket.destroy();
              return;
            }

            const addressType = requestData[3];
            let targetHost: string;
            let targetPort: number;
            let offset = 4;

            // 解析目标地址
            if (addressType === 0x01) {
              // IPv4
              targetHost = `${requestData[offset]}.${requestData[offset + 1]}.${requestData[offset + 2]}.${requestData[offset + 3]}`;
              offset += 4;
            } else if (addressType === 0x03) {
              // 域名
              const domainLength = requestData[offset];
              targetHost = requestData
                .slice(offset + 1, offset + 1 + domainLength)
                .toString();
              offset += 1 + domainLength;
            } else if (addressType === 0x04) {
              // IPv6（简化处理，实际应完整解析）
              clientSocket.write(
                Buffer.from([0x05, 0x08, 0x00, 0x01, 0, 0, 0, 0, 0, 0])
              );
              clientSocket.destroy();
              return;
            } else {
              clientSocket.destroy();
              return;
            }

            // 解析端口
            targetPort = (requestData[offset] << 8) | requestData[offset + 1];

            console.log(`[Socks5Proxy] SOCKS5 请求: ${targetHost}:${targetPort}`);

            // 选择节点
            const node = this.nodeManager.selectNode('socks5');
            if (!node) {
              console.log(`[Socks5Proxy] 错误: 没有可用节点`);
              clientSocket.write(
                Buffer.from([0x05, 0x01, 0x00, 0x01, 0, 0, 0, 0, 0, 0])
              );
              clientSocket.destroy();
              return;
            }

            console.log(`[Socks5Proxy] 选择节点: ${node.name} (${node.nodeId})`);
            console.log(`[Socks5Proxy] 通过 WebSocket 隧道转发 SOCKS5 请求`);

            const requestId = uuidv4();

            try {
              // 构建代理请求
              const proxyRequest: ProxyRequestMessage = {
                type: 'proxy_request',
                requestId,
                protocol: 'socks5',
                target: {
                  host: targetHost,
                  port: targetPort,
                },
                timestamp: Date.now(),
              };

              // 发送代理请求到节点
              const response = await this.wsServer.sendProxyRequest(
                node.nodeId,
                proxyRequest
              );

              if (!response.success) {
                console.error(
                  `[Socks5Proxy] 节点建立连接失败: ${response.error}`
                );
                clientSocket.write(
                  Buffer.from([0x05, 0x01, 0x00, 0x01, 0, 0, 0, 0, 0, 0])
                );
                clientSocket.destroy();
                return;
              }

              // 发送成功响应
              clientSocket.write(
                Buffer.from([0x05, 0x00, 0x00, 0x01, 0, 0, 0, 0, 0, 0])
              );

              console.log(`[Socks5Proxy] SOCKS5 隧道已建立: ${requestId}`);

              // 建立双向数据流
              this.setupTunnel(requestId, clientSocket, node.nodeId);
            } catch (error: any) {
              console.error('[Socks5Proxy] 连接节点失败:', error);
              clientSocket.write(
                Buffer.from([0x05, 0x01, 0x00, 0x01, 0, 0, 0, 0, 0, 0])
              );
              clientSocket.destroy();
            }
          } catch (error) {
            console.error('[Socks5Proxy] 处理请求错误:', error);
            clientSocket.destroy();
          }
        });
      } catch (error: any) {
        console.error('[Socks5Proxy] 握手错误:', error.message || error);
        clientSocket.destroy();
      }
    });

    clientSocket.on('error', (error: any) => {
      // 常见的网络错误不需要打印完整堆栈
      const commonErrors = ['ECONNRESET', 'EPIPE', 'ETIMEDOUT', 'ENOTFOUND'];
      if (error.code && commonErrors.includes(error.code)) {
        console.log(`[Socks5Proxy] 客户端连接中断 (${error.code})`);
      } else {
        console.error('[Socks5Proxy] 客户端连接错误:', error.message || error);
      }
    });
  }

  /**
   * 建立 SOCKS5 隧道的双向数据流
   */
  private setupTunnel(
    requestId: string,
    clientSocket: Socket,
    nodeId: string
  ): void {
    // 客户端 → Master → Node
    clientSocket.on('data', (data: Buffer) => {
      this.wsServer.sendProxyData(nodeId, requestId, data);
    });

    // Node → Master → 客户端
    const dataHandler = (event: { data: Buffer; isEnd: boolean }) => {
      clientSocket.write(event.data);
      if (event.isEnd) {
        clientSocket.end();
        this.wsServer.removeListener(`proxy_data_${requestId}`, dataHandler);
        this.wsServer.removeListener(`proxy_close_${requestId}`, closeHandler);
        this.wsServer.removeListener(`proxy_error_${requestId}`, errorHandler);
      }
    };

    const closeHandler = () => {
      console.log(`[Socks5Proxy] 隧道关闭: ${requestId}`);
      clientSocket.end();
      this.wsServer.removeListener(`proxy_data_${requestId}`, dataHandler);
      this.wsServer.removeListener(`proxy_error_${requestId}`, errorHandler);
    };

    const errorHandler = (event: { error: string }) => {
      console.error(`[Socks5Proxy] 隧道错误: ${requestId} - ${event.error}`);
      clientSocket.destroy();
      this.wsServer.removeListener(`proxy_data_${requestId}`, dataHandler);
      this.wsServer.removeListener(`proxy_close_${requestId}`, closeHandler);
    };

    this.wsServer.on(`proxy_data_${requestId}`, dataHandler);
    this.wsServer.on(`proxy_close_${requestId}`, closeHandler);
    this.wsServer.on(`proxy_error_${requestId}`, errorHandler);

    // 客户端断开时通知节点
    clientSocket.on('close', () => {
      console.log(`[Socks5Proxy] 客户端断开: ${requestId}`);
      this.wsServer.sendProxyClose(nodeId, requestId, 'client_closed');
      this.wsServer.removeListener(`proxy_data_${requestId}`, dataHandler);
      this.wsServer.removeListener(`proxy_close_${requestId}`, closeHandler);
      this.wsServer.removeListener(`proxy_error_${requestId}`, errorHandler);
    });

    clientSocket.on('error', (error: any) => {
      // 常见的网络错误不需要打印完整堆栈
      const commonErrors = ['ECONNRESET', 'EPIPE', 'ETIMEDOUT', 'ENOTFOUND'];
      if (error.code && commonErrors.includes(error.code)) {
        console.log(`[Socks5Proxy] 客户端连接中断: ${requestId} (${error.code})`);
      } else {
        console.error(`[Socks5Proxy] 客户端错误: ${requestId}`, error.message || error);
      }
      
      this.wsServer.sendProxyClose(nodeId, requestId, 'client_error');
      this.wsServer.removeListener(`proxy_data_${requestId}`, dataHandler);
      this.wsServer.removeListener(`proxy_close_${requestId}`, closeHandler);
      this.wsServer.removeListener(`proxy_error_${requestId}`, errorHandler);
    });
  }

  listen(port: number, host: string = '0.0.0.0', callback?: () => void): void {
    this.server.listen(port, host, callback);
    console.log(`[Socks5Proxy] SOCKS5 代理服务器启动在 ${host}:${port}`);
  }

  close(callback?: () => void): void {
    this.server.close(callback);
  }
}
