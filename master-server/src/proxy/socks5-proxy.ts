import { createServer, Server, Socket } from 'net';
import { SocksClient, SocksClientOptions } from 'socks';
import { NodeManager } from '../manager/node-manager';

export class Socks5ProxyServer {
  private server: Server;
  private nodeManager: NodeManager;

  constructor(nodeManager: NodeManager) {
    this.nodeManager = nodeManager;
    this.server = createServer(this.handleConnection.bind(this));
  }

  private async handleConnection(clientSocket: Socket): Promise<void> {
    let nodeSocket: Socket | null = null;

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

            // 选择节点
            const node = this.nodeManager.selectNode('socks5');
            if (!node) {
              clientSocket.write(
                Buffer.from([0x05, 0x01, 0x00, 0x01, 0, 0, 0, 0, 0, 0])
              );
              clientSocket.destroy();
              return;
            }

            // 智能选择连接地址：优先使用公网IP，如果host是0.0.0.0则使用localhost
            const connectHost = node.publicIp || 
                                (node.host === '0.0.0.0' ? 'localhost' : node.host) || 
                                'localhost';
            
            // 连接到节点（作为 SOCKS5 客户端）
            const socksOptions: SocksClientOptions = {
              proxy: {
                host: connectHost,
                port: node.socks5Port,
                type: 5,
              },
              command: 'connect',
              destination: {
                host: targetHost,
                port: targetPort,
              },
            };

            try {
              const info = await SocksClient.createConnection(socksOptions);
              nodeSocket = info.socket as Socket;

              // 发送成功响应
              clientSocket.write(
                Buffer.from([0x05, 0x00, 0x00, 0x01, 0, 0, 0, 0, 0, 0])
              );

              // 建立双向连接
              clientSocket.pipe(nodeSocket);
              nodeSocket.pipe(clientSocket);

              // 清理连接
              clientSocket.on('close', () => {
                if (nodeSocket) {
                  nodeSocket.destroy();
                }
              });
              nodeSocket.on('close', () => {
                clientSocket.destroy();
              });
              clientSocket.on('error', () => {
                if (nodeSocket) {
                  nodeSocket.destroy();
                }
              });
              nodeSocket.on('error', () => {
                clientSocket.destroy();
              });
            } catch (error) {
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
      } catch (error) {
        console.error('[Socks5Proxy] 握手错误:', error);
        clientSocket.destroy();
      }
    });

    clientSocket.on('error', (error) => {
      console.error('[Socks5Proxy] 客户端连接错误:', error);
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

