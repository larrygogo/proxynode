import { createServer, Server, IncomingMessage, ServerResponse } from 'http';
import { createConnection, Socket } from 'net';
import { NodeManager } from '../manager/node-manager';

export class HttpProxyServer {
  private server: Server;
  private nodeManager: NodeManager;

  constructor(nodeManager: NodeManager) {
    this.nodeManager = nodeManager;
    this.server = createServer(this.handleRequest.bind(this));
  }

  private async handleRequest(
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> {
    console.log(`[HttpProxy] 收到请求: ${req.method} ${req.url}`);
    
    // 处理 CONNECT 方法（用于 HTTPS 代理）
    if (req.method === 'CONNECT') {
      this.handleConnect(req, res);
      return;
    }

    // 处理普通 HTTP 请求
    this.handleHttp(req, res);
  }

  private async handleConnect(
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> {
    const url = new URL(`https://${req.url}`);
    const target = url.hostname;
    const port = parseInt(url.port || '443', 10);

    console.log(`[HttpProxy] CONNECT 请求: ${target}:${port}`);

    // 选择节点
    const node = this.nodeManager.selectNode('http');
    if (!node) {
      console.log(`[HttpProxy] 错误: 没有可用节点`);
      res.writeHead(502, 'No available nodes');
      res.end();
      return;
    }

    console.log(`[HttpProxy] 选择节点: ${node.name} (${node.nodeId})`);
    console.log(`[HttpProxy] 转发到节点: ${node.host}:${node.httpPort}`);

    // 连接到节点（作为客户端）
    const nodeConnection = createConnection(
      {
        host: node.host || 'localhost',
        port: node.httpPort,
      },
      () => {
        // 发送 CONNECT 请求到节点
        nodeConnection.write(`CONNECT ${target}:${port} HTTP/1.1\r\n`);
        nodeConnection.write(`Host: ${target}:${port}\r\n`);
        nodeConnection.write(`\r\n`);

        // 响应客户端
        res.writeHead(200, 'Connection Established');
        res.end();

        // 建立双向连接
        req.socket.pipe(nodeConnection);
        nodeConnection.pipe(req.socket);

        // 清理连接
        req.socket.on('close', () => {
          nodeConnection.end();
        });
        nodeConnection.on('close', () => {
          req.socket.end();
        });
      }
    );

    nodeConnection.on('error', (error: Error) => {
      console.error('[HttpProxy] 节点连接错误:', error);
      if (!res.headersSent) {
        res.writeHead(502, 'Bad Gateway');
        res.end();
      }
      req.socket.destroy();
    });
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
    console.log(`[HttpProxy] 转发到节点: ${node.host}:${node.httpPort}`);

    if (!req.url) {
      res.writeHead(400, 'Bad Request');
      res.end();
      return;
    }

    try {
      // HTTP 代理请求的 URL 是完整的 URL (http://host/path)
      // 需要解析并转发到节点代理
      const http = require('http');
      
      // 构建到节点的代理请求
      const proxyReq = http.request({
        host: node.host || 'localhost',
        port: node.httpPort,
        method: req.method,
        path: req.url, // 完整 URL
        headers: req.headers,
      });

      // 转发请求体
      req.pipe(proxyReq);

      proxyReq.on('response', (proxyRes: IncomingMessage) => {
        console.log(`[HttpProxy] 收到节点响应: ${proxyRes.statusCode} (${req.url})`);
        // 转发响应头
        res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
        // 转发响应体
        proxyRes.pipe(res);
      });

      proxyReq.on('error', (error: Error) => {
        console.error('[HttpProxy] 节点连接错误:', error);
        if (!res.headersSent) {
          res.writeHead(502, 'Bad Gateway');
          res.end('Proxy error');
        }
      });

      req.on('error', (error: Error) => {
        console.error('[HttpProxy] 请求错误:', error);
        proxyReq.destroy();
      });

      res.on('close', () => {
        proxyReq.destroy();
      });
    } catch (error) {
      console.error('[HttpProxy] 处理 HTTP 请求错误:', error);
      if (!res.headersSent) {
        res.writeHead(500, 'Internal Server Error');
        res.end();
      }
    }
  }

  listen(port: number, callback?: () => void): void {
    this.server.listen(port, callback);
    console.log(`[HttpProxy] HTTP 代理服务器启动在端口 ${port}`);
  }

  close(callback?: () => void): void {
    this.server.close(callback);
  }
}

