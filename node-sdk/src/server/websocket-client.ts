import WebSocket from 'ws';
import { createConnection, Socket } from 'net';
import * as http from 'http';
import * as https from 'https';
import { NodeConfig } from '../types';
import { HttpProxyServer } from '../proxy/http-proxy';
import { Socks5ProxyServer } from '../proxy/socks5-proxy';
import {
  ControlCommand,
  NodeEvent,
  CommandResponse,
  WebSocketMessage,
  ProxyRequestMessage,
  ProxyResponseMessage,
  ProxyDataMessage,
  ProxyCloseMessage,
  ProxyErrorMessage,
  ActiveProxyConnection,
} from '../types';

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private config: NodeConfig;
  private nodeId: string;
  private httpProxy: HttpProxyServer;
  private socks5Proxy: Socks5ProxyServer;
  private reconnectInterval: NodeJS.Timeout | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectDelay: number = 5000; // 5秒
  private isConnected: boolean = false;
  private activeProxyConnections: Map<string, ActiveProxyConnection> = new Map();

  constructor(
    config: NodeConfig,
    nodeId: string,
    httpProxy: HttpProxyServer,
    socks5Proxy: Socks5ProxyServer
  ) {
    this.config = config;
    this.nodeId = nodeId;
    this.httpProxy = httpProxy;
    this.socks5Proxy = socks5Proxy;
  }

  /**
   * 连接到主服务器
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const wsUrl = this.config.master.wsUrl;
        console.log(`[WebSocketClient] 正在连接到主服务器: ${wsUrl}`);

        this.ws = new WebSocket(wsUrl, {
          headers: this.config.master.apiKey
            ? { 'X-API-Key': this.config.master.apiKey }
            : {},
        });

        this.ws.on('open', () => {
          console.log('[WebSocketClient] 已连接到主服务器');
          this.isConnected = true;
          this.reconnectAttempts = 0;

          // 发送节点 ID（用于主服务器识别）
          this.sendNodeId();

          resolve();
        });

        this.ws.on('message', (data: Buffer) => {
          try {
            const message: any = JSON.parse(data.toString());
            this.handleMessage(message);
          } catch (error) {
            console.error('[WebSocketClient] 消息解析错误:', error);
          }
        });

        this.ws.on('error', (error) => {
          console.error('[WebSocketClient] WebSocket 错误:', error);
          if (!this.isConnected) {
            reject(error);
          }
        });

        this.ws.on('close', (code, reason) => {
          console.log(
            `[WebSocketClient] 连接已关闭: ${code} - ${reason.toString()}`
          );
          this.isConnected = false;
          this.ws = null;

          // 清理所有活动的代理连接
          this.cleanupAllProxyConnections();

          // 尝试重连
          this.scheduleReconnect();
        });
      } catch (error) {
        console.error('[WebSocketClient] 连接失败:', error);
        reject(error);
      }
    });
  }

  /**
   * 发送节点 ID
   */
  private sendNodeId(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'node_id',
          nodeId: this.nodeId,
        })
      );
    }
  }

  /**
   * 处理接收到的消息
   */
  private handleMessage(message: any): void {
    switch (message.type) {
      case 'command':
        this.handleCommand(message as ControlCommand);
        break;
      case 'proxy_request':
        this.handleProxyRequest(message as ProxyRequestMessage);
        break;
      case 'proxy_data':
        this.handleProxyData(message as ProxyDataMessage);
        break;
      case 'proxy_close':
        this.handleProxyClose(message as ProxyCloseMessage);
        break;
      default:
        console.warn('[WebSocketClient] 未知消息类型:', message.type);
    }
  }

  /**
   * 处理控制指令
   */
  private handleCommand(command: ControlCommand): void {
    console.log(`[WebSocketClient] 收到控制指令: ${command.command}`);

    try {
      let response: CommandResponse;

      switch (command.command) {
        case 'enable':
          this.httpProxy.enable();
          this.socks5Proxy.enable();
          response = {
            type: 'response',
            command: command.command,
            success: true,
            message: '代理已启用',
          };
          break;

        case 'disable':
          this.httpProxy.disable();
          this.socks5Proxy.disable();
          response = {
            type: 'response',
            command: command.command,
            success: true,
            message: '代理已禁用',
          };
          break;

        case 'update_config':
          response = {
            type: 'response',
            command: command.command,
            success: true,
            message: '配置已更新',
          };
          break;

        case 'restart':
          response = {
            type: 'response',
            command: command.command,
            success: true,
            message: '重启指令已接收',
          };
          setTimeout(() => {
            process.exit(0);
          }, 1000);
          break;

        default:
          response = {
            type: 'response',
            command: command.command,
            success: false,
            message: '未知指令',
          };
      }

      this.sendResponse(response);
    } catch (error: any) {
      console.error('[WebSocketClient] 处理指令错误:', error);
      this.sendResponse({
        type: 'response',
        command: command.command,
        success: false,
        message: error.message || '执行指令失败',
      });
    }
  }

  // ==================== 代理请求处理 ====================

  /**
   * 处理代理请求
   */
  private async handleProxyRequest(message: ProxyRequestMessage): Promise<void> {
    console.log(
      `[WebSocketClient] 收到代理请求: ${message.protocol} ${message.requestId}`
    );

    try {
      if (message.protocol === 'http') {
        await this.handleHttpProxyRequest(message);
      } else if (message.protocol === 'https') {
        await this.handleHttpsProxyRequest(message);
      } else if (message.protocol === 'socks5') {
        await this.handleSocks5ProxyRequest(message);
      } else {
        throw new Error(`不支持的协议: ${message.protocol}`);
      }
    } catch (error: any) {
      console.error('[WebSocketClient] 代理请求处理失败:', error);
      this.sendProxyError(message.requestId, error.message);
    }
  }

  /**
   * 处理 HTTP 代理请求
   */
  private async handleHttpProxyRequest(message: ProxyRequestMessage): Promise<void> {
    const url = new URL(message.url!);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const options: http.RequestOptions = {
      method: message.method,
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      headers: message.headers || {},
    };

    const targetReq = client.request(options, (targetRes) => {
      console.log(
        `[WebSocketClient] HTTP 响应: ${targetRes.statusCode} (${message.requestId})`
      );

      // 发送响应头
      this.sendProxyResponse(message.requestId, {
        statusCode: targetRes.statusCode!,
        statusMessage: targetRes.statusMessage!,
        headers: targetRes.headers as Record<string, string | string[]>,
      });

      // 转发响应数据
      targetRes.on('data', (chunk: Buffer) => {
        this.sendProxyData(message.requestId, chunk, false);
      });

      targetRes.on('end', () => {
        console.log(`[WebSocketClient] HTTP 请求完成: ${message.requestId}`);
        this.sendProxyData(message.requestId, Buffer.from(''), true);
        this.activeProxyConnections.delete(message.requestId);
      });

      targetRes.on('error', (error) => {
        console.error('[WebSocketClient] HTTP 响应错误:', error);
        this.sendProxyError(message.requestId, error.message);
        this.activeProxyConnections.delete(message.requestId);
      });
    });

    // 保存连接
    this.activeProxyConnections.set(message.requestId, {
      requestId: message.requestId,
      protocol: 'http',
      socket: targetReq,
      startTime: Date.now(),
    });

    targetReq.on('error', (error) => {
      console.error('[WebSocketClient] HTTP 请求错误:', error);
      this.sendProxyError(message.requestId, error.message);
      this.activeProxyConnections.delete(message.requestId);
    });

    // 发送请求体
    if (message.body) {
      const body = Buffer.from(message.body, 'base64');
      targetReq.write(body);
    }

    targetReq.end();
  }

  /**
   * 处理 HTTPS 代理请求（CONNECT 隧道）
   */
  private async handleHttpsProxyRequest(message: ProxyRequestMessage): Promise<void> {
    const { host, port } = message.target!;

    const socket = createConnection({ host, port }, () => {
      console.log(`[WebSocketClient] HTTPS 隧道已建立: ${host}:${port} (${message.requestId})`);

      // 保存连接
      this.activeProxyConnections.set(message.requestId, {
        requestId: message.requestId,
        protocol: 'https',
        socket,
        startTime: Date.now(),
      });

      // 发送成功响应
      this.sendProxyResponse(message.requestId, { success: true });
    });

    socket.on('data', (data: Buffer) => {
      this.sendProxyData(message.requestId, data, false);
    });

    socket.on('end', () => {
      console.log(`[WebSocketClient] HTTPS 隧道关闭: ${message.requestId}`);
      this.sendProxyClose(message.requestId);
      this.activeProxyConnections.delete(message.requestId);
    });

    socket.on('close', () => {
      this.sendProxyClose(message.requestId);
      this.activeProxyConnections.delete(message.requestId);
    });

    socket.on('error', (error) => {
      console.error('[WebSocketClient] HTTPS 隧道错误:', error);
      this.sendProxyError(message.requestId, error.message);
      this.activeProxyConnections.delete(message.requestId);
    });
  }

  /**
   * 处理 SOCKS5 代理请求
   */
  private async handleSocks5ProxyRequest(message: ProxyRequestMessage): Promise<void> {
    const { host, port } = message.target!;

    const socket = createConnection({ host, port }, () => {
      console.log(`[WebSocketClient] SOCKS5 连接已建立: ${host}:${port} (${message.requestId})`);

      // 保存连接
      this.activeProxyConnections.set(message.requestId, {
        requestId: message.requestId,
        protocol: 'socks5',
        socket,
        startTime: Date.now(),
      });

      // 发送成功响应
      this.sendProxyResponse(message.requestId, { success: true });
    });

    socket.on('data', (data: Buffer) => {
      this.sendProxyData(message.requestId, data, false);
    });

    socket.on('end', () => {
      console.log(`[WebSocketClient] SOCKS5 连接关闭: ${message.requestId}`);
      this.sendProxyClose(message.requestId);
      this.activeProxyConnections.delete(message.requestId);
    });

    socket.on('close', () => {
      this.sendProxyClose(message.requestId);
      this.activeProxyConnections.delete(message.requestId);
    });

    socket.on('error', (error) => {
      console.error('[WebSocketClient] SOCKS5 连接错误:', error);
      this.sendProxyError(message.requestId, error.message);
      this.activeProxyConnections.delete(message.requestId);
    });
  }

  /**
   * 处理来自 Master 的代理数据
   */
  private handleProxyData(message: ProxyDataMessage): void {
    const connection = this.activeProxyConnections.get(message.requestId);
    if (!connection) {
      console.warn(`[WebSocketClient] 未找到代理连接: ${message.requestId}`);
      return;
    }

    const data = Buffer.from(message.data, 'base64');

    if (connection.socket && typeof connection.socket.write === 'function') {
      connection.socket.write(data);
    }

    if (message.isEnd) {
      if (connection.socket && typeof connection.socket.end === 'function') {
        connection.socket.end();
      }
      this.activeProxyConnections.delete(message.requestId);
    }
  }

  /**
   * 处理来自 Master 的代理关闭
   */
  private handleProxyClose(message: ProxyCloseMessage): void {
    console.log(`[WebSocketClient] 收到关闭消息: ${message.requestId}`);

    const connection = this.activeProxyConnections.get(message.requestId);
    if (connection && connection.socket) {
      if (typeof connection.socket.destroy === 'function') {
        connection.socket.destroy();
      } else if (typeof connection.socket.abort === 'function') {
        connection.socket.abort();
      }
      this.activeProxyConnections.delete(message.requestId);
    }
  }

  /**
   * 发送代理响应
   */
  private sendProxyResponse(
    requestId: string,
    response: Partial<ProxyResponseMessage>
  ): void {
    const message: ProxyResponseMessage = {
      type: 'proxy_response',
      requestId,
      timestamp: Date.now(),
      success: true,
      ...response,
    };

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  /**
   * 发送代理数据
   */
  private sendProxyData(requestId: string, data: Buffer, isEnd: boolean): void {
    const message: ProxyDataMessage = {
      type: 'proxy_data',
      requestId,
      data: data.toString('base64'),
      isEnd,
      timestamp: Date.now(),
    };

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  /**
   * 发送代理关闭
   */
  private sendProxyClose(requestId: string, reason?: string): void {
    const message: ProxyCloseMessage = {
      type: 'proxy_close',
      requestId,
      reason,
      timestamp: Date.now(),
    };

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  /**
   * 发送代理错误
   */
  private sendProxyError(requestId: string, error: string): void {
    const message: ProxyErrorMessage = {
      type: 'proxy_error',
      requestId,
      error,
      timestamp: Date.now(),
    };

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  /**
   * 清理所有代理连接
   */
  private cleanupAllProxyConnections(): void {
    console.log(`[WebSocketClient] 清理 ${this.activeProxyConnections.size} 个活动代理连接`);

    for (const [requestId, connection] of this.activeProxyConnections.entries()) {
      if (connection.socket) {
        if (typeof connection.socket.destroy === 'function') {
          connection.socket.destroy();
        } else if (typeof connection.socket.abort === 'function') {
          connection.socket.abort();
        }
      }
    }

    this.activeProxyConnections.clear();
  }

  /**
   * 发送响应
   */
  private sendResponse(response: CommandResponse): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(response));
    }
  }

  /**
   * 发送事件
   */
  sendEvent(event: NodeEvent): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(event));
    }
  }

  /**
   * 安排重连
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(
        '[WebSocketClient] 达到最大重连次数，停止重连'
      );
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;

    console.log(
      `[WebSocketClient] ${delay / 1000} 秒后尝试重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`
    );

    this.reconnectInterval = setTimeout(() => {
      this.connect().catch((error) => {
        console.error('[WebSocketClient] 重连失败:', error);
      });
    }, delay);
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    if (this.reconnectInterval) {
      clearTimeout(this.reconnectInterval);
      this.reconnectInterval = null;
    }

    // 清理所有代理连接
    this.cleanupAllProxyConnections();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isConnected = false;
    console.log('[WebSocketClient] 已断开连接');
  }

  /**
   * 检查是否已连接
   */
  isConnectedToMaster(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }
}
