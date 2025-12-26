import WebSocket from 'ws';
import { NodeConfig } from '../types';
import { HttpProxyServer } from '../proxy/http-proxy';
import { Socks5ProxyServer } from '../proxy/socks5-proxy';
import {
  ControlCommand,
  NodeEvent,
  CommandResponse,
  WebSocketMessage,
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
            const message: WebSocketMessage = JSON.parse(data.toString());
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
  private handleMessage(message: WebSocketMessage): void {
    if (message.type === 'command') {
      this.handleCommand(message as ControlCommand);
    } else {
      console.warn('[WebSocketClient] 未知消息类型:', message);
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
          // 这里可以实现配置更新逻辑
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
          // 可以在这里实现重启逻辑
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

