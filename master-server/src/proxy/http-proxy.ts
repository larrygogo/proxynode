import { createServer, Server, IncomingMessage, ServerResponse } from 'http';
import { Socket } from 'net';
import { v4 as uuidv4 } from 'uuid';
import { NodeManager } from '../manager/node-manager';
import { MasterWebSocketServer } from '../websocket/websocket-server';
import { ProxyRequestMessage } from '../types';

export class HttpProxyServer {
  private server: Server;
  private nodeManager: NodeManager;
  private wsServer: MasterWebSocketServer;

  constructor(nodeManager: NodeManager, wsServer: MasterWebSocketServer) {
    this.nodeManager = nodeManager;
    this.wsServer = wsServer;
    this.server = createServer(this.handleRequest.bind(this));
    
    // 注册 CONNECT 事件处理器（用于 HTTPS 代理）
    this.server.on('connect', this.handleConnect.bind(this));
  }

  private async handleRequest(
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> {
    console.log(`[HttpProxy] 收到请求: ${req.method} ${req.url}`);

    // 处理普通 HTTP 请求
    this.handleHttp(req, res);
  }

  private async handleConnect(
    req: IncomingMessage,
    clientSocket: Socket,
    head: Buffer
  ): Promise<void> {
    // 解析目标地址
    const [target, portStr] = (req.url || '').split(':');
    const port = parseInt(portStr || '443', 10);

    console.log(`[HttpProxy] CONNECT 请求: ${target}:${port}`);

    // 选择节点
    const node = this.nodeManager.selectNode('http');
    if (!node) {
      console.log(`[HttpProxy] 错误: 没有可用节点`);
      clientSocket.write('HTTP/1.1 502 No available nodes\r\n\r\n');
      clientSocket.destroy();
      return;
    }

    console.log(`[HttpProxy] 选择节点: ${node.name} (${node.nodeId})`);
    console.log(`[HttpProxy] 通过 WebSocket 隧道转发 CONNECT 请求`);

    const requestId = uuidv4();

    try {
      // 构建代理请求
      const proxyRequest: ProxyRequestMessage = {
        type: 'proxy_request',
        requestId,
        protocol: 'https',
        target: {
          host: target,
          port,
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
          `[HttpProxy] 节点建立连接失败: ${response.error}`
        );
        clientSocket.write('HTTP/1.1 502 Proxy Error\r\n\r\n');
        clientSocket.destroy();
        return;
      }

      // 响应客户端：连接已建立
      clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');

      console.log(`[HttpProxy] CONNECT 隧道已建立: ${requestId}`);

      // 如果有初始数据（head），立即发送
      if (head && head.length > 0) {
        this.wsServer.sendProxyData(node.nodeId, requestId, head);
      }

      // 建立双向数据流
      this.setupTunnel(requestId, clientSocket, node.nodeId);
    } catch (error: any) {
      console.error(`[HttpProxy] CONNECT 失败:`, error);
      clientSocket.write('HTTP/1.1 502 Proxy Error\r\n\r\n');
      clientSocket.destroy();
    }
  }

  private async handleHttp(
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> {
    console.log(`[HttpProxy] HTTP 请求: ${req.method} ${req.url}`);

    // 选择节点
    const node = this.nodeManager.selectNode('http');
    if (!node) {
      console.log(`[HttpProxy] 错误: 没有可用节点`);
      res.writeHead(502, 'No available nodes');
      res.end('No available proxy nodes');
      return;
    }

    console.log(`[HttpProxy] 选择节点: ${node.name} (${node.nodeId})`);
    console.log(`[HttpProxy] 通过 WebSocket 隧道转发 HTTP 请求`);

    if (!req.url) {
      res.writeHead(400, 'Bad Request');
      res.end();
      return;
    }

    const requestId = uuidv4();

    try {
      // 读取请求体
      const bodyChunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => {
        bodyChunks.push(chunk);
      });

      req.on('end', async () => {
        try {
          const body = Buffer.concat(bodyChunks);

          // 构建代理请求
          const proxyRequest: ProxyRequestMessage = {
            type: 'proxy_request',
            requestId,
            protocol: 'http',
            method: req.method,
            url: req.url,
            headers: req.headers as Record<string, string | string[]>,
            body: body.length > 0 ? body.toString('base64') : undefined,
            timestamp: Date.now(),
          };

          // 发送代理请求到节点
          const response = await this.wsServer.sendProxyRequest(
            node.nodeId,
            proxyRequest
          );

          if (!response.success) {
            console.error(
              `[HttpProxy] 节点处理请求失败: ${response.error}`
            );
            res.writeHead(502, 'Proxy Error');
            res.end();
            return;
          }

          // 写入响应头
          res.writeHead(
            response.statusCode || 502,
            response.statusMessage || 'Bad Gateway',
            response.headers || {}
          );

          console.log(
            `[HttpProxy] 已发送响应头: ${response.statusCode} (${requestId})`
          );

          // 监听数据流
          let dataReceived = false;
          const dataHandler = (event: { data: Buffer; isEnd: boolean }) => {
            dataReceived = true;
            res.write(event.data);
            if (event.isEnd) {
              res.end();
              console.log(`[HttpProxy] 请求完成: ${requestId}`);
              this.wsServer.removeListener(`proxy_data_${requestId}`, dataHandler);
              this.wsServer.removeListener(`proxy_close_${requestId}`, closeHandler);
              this.wsServer.removeListener(`proxy_error_${requestId}`, errorHandler);
            }
          };

          const closeHandler = () => {
            if (!dataReceived) {
              res.end();
            }
            console.log(`[HttpProxy] 连接关闭: ${requestId}`);
            this.wsServer.removeListener(`proxy_data_${requestId}`, dataHandler);
            this.wsServer.removeListener(`proxy_error_${requestId}`, errorHandler);
          };

          const errorHandler = (event: { error: string }) => {
            console.error(`[HttpProxy] 代理错误: ${requestId} - ${event.error}`);
            if (!res.headersSent) {
              res.writeHead(502, 'Proxy Error');
            }
            res.end();
            this.wsServer.removeListener(`proxy_data_${requestId}`, dataHandler);
            this.wsServer.removeListener(`proxy_close_${requestId}`, closeHandler);
          };

          this.wsServer.on(`proxy_data_${requestId}`, dataHandler);
          this.wsServer.on(`proxy_close_${requestId}`, closeHandler);
          this.wsServer.on(`proxy_error_${requestId}`, errorHandler);

          // 如果客户端断开，通知节点
          res.on('close', () => {
            this.wsServer.sendProxyClose(node.nodeId, requestId, 'client_closed');
            this.wsServer.removeListener(`proxy_data_${requestId}`, dataHandler);
            this.wsServer.removeListener(`proxy_close_${requestId}`, closeHandler);
            this.wsServer.removeListener(`proxy_error_${requestId}`, errorHandler);
          });
        } catch (error: any) {
          console.error('[HttpProxy] 处理请求体错误:', error);
          if (!res.headersSent) {
            res.writeHead(500, 'Internal Server Error');
          }
          res.end();
        }
      });
    } catch (error) {
      console.error('[HttpProxy] 处理 HTTP 请求错误:', error);
      if (!res.headersSent) {
        res.writeHead(500, 'Internal Server Error');
        res.end();
      }
    }
  }

  /**
   * 建立 CONNECT 隧道的双向数据流
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
      console.log(`[HttpProxy] 隧道关闭: ${requestId}`);
      clientSocket.end();
      this.wsServer.removeListener(`proxy_data_${requestId}`, dataHandler);
      this.wsServer.removeListener(`proxy_error_${requestId}`, errorHandler);
    };

    const errorHandler = (event: { error: string }) => {
      console.error(`[HttpProxy] 隧道错误: ${requestId} - ${event.error}`);
      clientSocket.destroy();
      this.wsServer.removeListener(`proxy_data_${requestId}`, dataHandler);
      this.wsServer.removeListener(`proxy_close_${requestId}`, closeHandler);
    };

    this.wsServer.on(`proxy_data_${requestId}`, dataHandler);
    this.wsServer.on(`proxy_close_${requestId}`, closeHandler);
    this.wsServer.on(`proxy_error_${requestId}`, errorHandler);

    // 客户端断开时通知节点
    clientSocket.on('close', () => {
      console.log(`[HttpProxy] 客户端断开: ${requestId}`);
      this.wsServer.sendProxyClose(nodeId, requestId, 'client_closed');
      this.wsServer.removeListener(`proxy_data_${requestId}`, dataHandler);
      this.wsServer.removeListener(`proxy_close_${requestId}`, closeHandler);
      this.wsServer.removeListener(`proxy_error_${requestId}`, errorHandler);
    });

    clientSocket.on('error', (error: Error) => {
      console.error(`[HttpProxy] 客户端错误: ${requestId}`, error);
      this.wsServer.sendProxyClose(nodeId, requestId, 'client_error');
      this.wsServer.removeListener(`proxy_data_${requestId}`, dataHandler);
      this.wsServer.removeListener(`proxy_close_${requestId}`, closeHandler);
      this.wsServer.removeListener(`proxy_error_${requestId}`, errorHandler);
    });
  }

  listen(port: number, host: string = '0.0.0.0', callback?: () => void): void {
    this.server.listen(port, host, callback);
    console.log(`[HttpProxy] HTTP 代理服务器启动在 ${host}:${port}`);
  }

  close(callback?: () => void): void {
    this.server.close(callback);
  }
}
