import { createServer, Server, IncomingMessage, ServerResponse } from 'http';
import { createConnection, Socket } from 'net';
import { v4 as uuidv4 } from 'uuid';
import { NodeMonitor } from '../monitor/node-monitor';
import { ProxyConnection } from '../types';

export class HttpProxyServer {
  private server: Server;
  private monitor: NodeMonitor;
  private enabled: boolean = true;

  constructor(monitor: NodeMonitor) {
    this.monitor = monitor;
    this.server = createServer(this.handleRequest.bind(this));
  }

  private async handleRequest(
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> {
    console.log(`[HttpProxy] 收到代理请求: ${req.method} ${req.url}`);
    
    if (!this.enabled) {
      console.log(`[HttpProxy] 代理服务已禁用`);
      res.writeHead(503, 'Service Unavailable');
      res.end('Proxy service is disabled');
      return;
    }

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
    if (!req.url) {
      res.writeHead(400, 'Bad Request');
      res.end();
      return;
    }

    const [target, portStr] = req.url.split(':');
    const port = parseInt(portStr || '443', 10);

    console.log(`[HttpProxy] CONNECT 目标: ${target}:${port}`);

    // 创建连接记录
    const connectionId = uuidv4();
    const connection: ProxyConnection = {
      id: connectionId,
      protocol: 'http',
      target,
      port,
      startTime: new Date(),
      bytesUp: 0,
      bytesDown: 0,
    };

    this.monitor.addConnection(connection);

    // 连接到目标服务器
    const targetSocket = createConnection(port, target, () => {
      // 连接成功，发送 200 响应
      res.writeHead(200, 'Connection Established');
      res.end();

      // 建立双向连接
      req.socket.pipe(targetSocket);
      targetSocket.pipe(req.socket);

      // 监控数据量
      req.socket.on('data', (data: Buffer) => {
        connection.bytesUp += data.length;
        this.monitor.updateConnectionBytes(
          connectionId,
          data.length,
          0
        );
      });

      targetSocket.on('data', (data: Buffer) => {
        connection.bytesDown += data.length;
        this.monitor.updateConnectionBytes(
          connectionId,
          0,
          data.length
        );
      });
    });

    targetSocket.on('error', (error: Error) => {
      console.error(`[HttpProxy] 连接目标服务器失败 ${target}:${port}:`, error);
      this.monitor.removeConnection(connectionId);
      if (!res.headersSent) {
        res.writeHead(502, 'Bad Gateway');
        res.end();
      }
      req.socket.destroy();
    });

    req.socket.on('error', (error: any) => {
      // 忽略客户端断开连接的错误（这是正常的）
      if (error.code !== 'ECONNRESET' && error.code !== 'EPIPE') {
        console.error('[HttpProxy] 客户端连接错误:', error);
      }
      this.monitor.removeConnection(connectionId);
      targetSocket.destroy();
    });

    req.socket.on('close', () => {
      this.monitor.removeConnection(connectionId);
      targetSocket.destroy();
    });

    targetSocket.on('close', () => {
      this.monitor.removeConnection(connectionId);
      req.socket.destroy();
    });
  }

  private async handleHttp(
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> {
    if (!req.url || !req.headers.host) {
      res.writeHead(400, 'Bad Request');
      res.end();
      return;
    }

    try {
      console.log(`[HttpProxy] 处理 HTTP 请求: ${req.method} ${req.url}`);
      
      // 从 Host 头中解析目标地址
      const hostHeader = req.headers.host;
      const [hostname, portStr] = hostHeader.split(':');
      const port = parseInt(portStr || '80', 10);

      console.log(`[HttpProxy] 目标服务器: ${hostname}:${port}`);

      // 创建连接记录
      const connectionId = uuidv4();
      const connection: ProxyConnection = {
        id: connectionId,
        protocol: 'http',
        target: hostname,
        port,
        startTime: new Date(),
        bytesUp: 0,
        bytesDown: 0,
      };

      this.monitor.addConnection(connection);

      // 使用 HTTP 模块发送请求到目标服务器
      const http = require('http');
      const https = require('https');
      
      // 解析 URL 以确定协议
      const urlObj = new URL(req.url);
      const isHttps = urlObj.protocol === 'https:';
      const client = isHttps ? https : http;
      
      const targetReq = client.request({
        hostname: hostname,
        port: port || (isHttps ? 443 : 80),
        method: req.method,
        path: urlObj.pathname + urlObj.search,
        headers: req.headers,
      });

      // 转发请求体
      req.pipe(targetReq);

      targetReq.on('response', (targetRes: any) => {
        console.log(`[HttpProxy] 收到目标响应: ${targetRes.statusCode} from ${hostname}`);
        
        // 转发响应头
        res.writeHead(targetRes.statusCode, targetRes.headers);
        
        // 转发响应体
        targetRes.pipe(res);

        // 监控数据量
        req.on('data', (data: Buffer) => {
          connection.bytesUp += data.length;
          this.monitor.updateConnectionBytes(connectionId, data.length, 0);
        });

        targetRes.on('data', (data: Buffer) => {
          connection.bytesDown += data.length;
          this.monitor.updateConnectionBytes(connectionId, 0, data.length);
        });
      });

      targetReq.on('error', (error: Error) => {
        console.error(
          `[HttpProxy] 连接目标服务器失败 ${hostname}:${port}:`,
          error
        );
        this.monitor.removeConnection(connectionId);
        if (!res.headersSent) {
          res.writeHead(502, 'Bad Gateway');
          res.end();
        }
      });

      req.on('error', (error: any) => {
        // 忽略客户端断开连接的错误（这是正常的）
        if (error.code !== 'ECONNRESET' && error.code !== 'EPIPE') {
          console.error('[HttpProxy] 请求错误:', error);
        }
        this.monitor.removeConnection(connectionId);
        targetReq.destroy();
      });

      res.on('close', () => {
        this.monitor.removeConnection(connectionId);
        targetReq.destroy();
      });
    } catch (error) {
      console.error('[HttpProxy] 处理 HTTP 请求错误:', error);
      res.writeHead(500, 'Internal Server Error');
      res.end();
    }
  }

  /**
   * 启用代理
   */
  enable(): void {
    this.enabled = true;
    console.log('[HttpProxy] HTTP 代理已启用');
  }

  /**
   * 禁用代理
   */
  disable(): void {
    this.enabled = false;
    console.log('[HttpProxy] HTTP 代理已禁用');
  }

  /**
   * 启动服务器
   */
  listen(port: number, callback?: () => void): void {
    this.server.listen(port, callback);
    console.log(`[HttpProxy] HTTP 代理服务器启动在端口 ${port}`);
  }

  /**
   * 关闭服务器
   */
  close(callback?: () => void): void {
    this.server.close(callback);
  }
}

