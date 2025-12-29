import { WebSocketServer, WebSocket } from 'ws';
import { Server as HttpServer } from 'http';
import { EventEmitter } from 'events';
import { NodeManager } from '../manager/node-manager';
import {
  ControlCommand,
  NodeEvent,
  WebSocketMessage,
  ProxyRequestMessage,
  ProxyResponseMessage,
  ProxyDataMessage,
  ProxyCloseMessage,
  ProxyErrorMessage,
  PendingProxyRequest,
} from '../types';

interface NodeWebSocket extends WebSocket {
  nodeId?: string;
  isAlive?: boolean;
}

export class MasterWebSocketServer extends EventEmitter {
  private wss: WebSocketServer;
  private nodeManager: NodeManager;
  private nodeConnections: Map<string, NodeWebSocket> = new Map();
  private pendingProxyRequests: Map<string, PendingProxyRequest> = new Map();
  private readonly PROXY_TIMEOUT = 60000; // 代理请求超时时间：60秒

  constructor(server: HttpServer, nodeManager: NodeManager) {
    super();
    this.nodeManager = nodeManager;
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.setupWebSocketServer();
    this.startHeartbeat();
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: NodeWebSocket) => {
      console.log('[WebSocket] 新连接建立');

      ws.isAlive = true;

      // 处理 ping/pong 心跳
      ws.on('pong', () => {
        ws.isAlive = true;
      });

      // 处理消息
      ws.on('message', (data: Buffer) => {
        try {
          const message: any = JSON.parse(data.toString());
          
          // 处理节点 ID 注册消息
          if (message.type === 'node_id' && message.nodeId) {
            this.registerNodeConnection(message.nodeId, ws);
            return;
          }
          
          // 处理其他消息
          const wsMessage: WebSocketMessage = message;
          this.handleMessage(ws, wsMessage);
        } catch (error) {
          console.error('[WebSocket] 消息解析错误:', error);
          ws.send(
            JSON.stringify({
              type: 'error',
              message: '消息格式错误',
            })
          );
        }
      });

      // 处理关闭
      ws.on('close', () => {
        if (ws.nodeId) {
          console.log(`[WebSocket] 节点断开连接: ${ws.nodeId}`);
          this.nodeConnections.delete(ws.nodeId);
        }
      });

      // 处理错误
      ws.on('error', (error) => {
        console.error('[WebSocket] 连接错误:', error);
        if (ws.nodeId) {
          this.nodeConnections.delete(ws.nodeId);
        }
      });
    });
  }

  private handleMessage(ws: NodeWebSocket, message: any): void {
    switch (message.type) {
      case 'event':
        // 处理节点事件
        this.handleNodeEvent(ws, message as NodeEvent);
        break;
      case 'proxy_response':
        // 处理代理响应
        this.handleProxyResponse(message as ProxyResponseMessage);
        break;
      case 'proxy_data':
        // 处理代理数据
        this.handleProxyData(message as ProxyDataMessage);
        break;
      case 'proxy_close':
        // 处理代理关闭
        this.handleProxyClose(message as ProxyCloseMessage);
        break;
      case 'proxy_error':
        // 处理代理错误
        this.handleProxyError(message as ProxyErrorMessage);
        break;
      default:
        console.warn('[WebSocket] 未知消息类型:', message.type);
    }
  }

  private handleNodeEvent(ws: NodeWebSocket, event: NodeEvent): void {
    // 如果是状态变更事件，可能需要更新节点管理器中的状态
    if (event.event === 'status_changed' && event.data) {
      // 这里可以根据需要更新节点状态
      console.log(`[WebSocket] 收到节点事件: ${event.event}`, event.data);
    }
  }

  /**
   * 注册节点连接
   */
  registerNodeConnection(nodeId: string, ws: NodeWebSocket): void {
    ws.nodeId = nodeId;
    this.nodeConnections.set(nodeId, ws);
    console.log(`[WebSocket] 节点连接已注册: ${nodeId}`);
  }

  /**
   * 向节点发送控制指令
   */
  sendCommand(nodeId: string, command: ControlCommand): boolean {
    const ws = this.nodeConnections.get(nodeId);
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn(`[WebSocket] 节点 ${nodeId} 连接不可用`);
      return false;
    }

    try {
      ws.send(JSON.stringify(command));
      console.log(`[WebSocket] 已发送指令到节点 ${nodeId}: ${command.command}`);
      return true;
    } catch (error) {
      console.error(`[WebSocket] 发送指令到节点 ${nodeId} 失败:`, error);
      return false;
    }
  }

  /**
   * 广播控制指令到所有节点
   */
  broadcastCommand(command: ControlCommand): number {
    let count = 0;
    for (const [nodeId, ws] of this.nodeConnections.entries()) {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify(command));
          count++;
        } catch (error) {
          console.error(`[WebSocket] 广播指令到节点 ${nodeId} 失败:`, error);
        }
      }
    }
    console.log(`[WebSocket] 已广播指令到 ${count} 个节点`);
    return count;
  }

  /**
   * 启动心跳检测
   */
  private startHeartbeat(): void {
    const interval = setInterval(() => {
      for (const [nodeId, ws] of this.nodeConnections.entries()) {
        if (!ws.isAlive) {
          console.log(`[WebSocket] 节点 ${nodeId} 心跳超时，关闭连接`);
          ws.terminate();
          this.nodeConnections.delete(nodeId);
          continue;
        }

        ws.isAlive = false;
        ws.ping();
      }
    }, 30000); // 每30秒检查一次

    this.wss.on('close', () => {
      clearInterval(interval);
    });
  }

  /**
   * 获取连接的节点数量
   */
  getConnectedNodeCount(): number {
    return this.nodeConnections.size;
  }

  /**
   * 检查节点是否连接
   */
  isNodeConnected(nodeId: string): boolean {
    const ws = this.nodeConnections.get(nodeId);
    return ws !== undefined && ws.readyState === WebSocket.OPEN;
  }

  // ==================== 代理消息处理 ====================

  /**
   * 发送代理请求到节点
   */
  public async sendProxyRequest(
    nodeId: string,
    request: ProxyRequestMessage
  ): Promise<ProxyResponseMessage> {
    const ws = this.nodeConnections.get(nodeId);
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error(`节点 ${nodeId} 未连接或连接不可用`);
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingProxyRequests.delete(request.requestId);
        reject(new Error(`代理请求超时: ${request.requestId}`));
      }, this.PROXY_TIMEOUT);

      this.pendingProxyRequests.set(request.requestId, {
        requestId: request.requestId,
        nodeId,
        protocol: request.protocol,
        resolve,
        reject,
        timeout,
      });

      try {
        ws.send(JSON.stringify(request));
        console.log(
          `[WebSocket] 发送代理请求: ${request.requestId} → ${nodeId} (${request.protocol})`
        );
      } catch (error: any) {
        clearTimeout(timeout);
        this.pendingProxyRequests.delete(request.requestId);
        reject(error);
      }
    });
  }

  /**
   * 发送代理数据到节点
   */
  public sendProxyData(
    nodeId: string,
    requestId: string,
    data: Buffer,
    isEnd: boolean = false
  ): void {
    const ws = this.nodeConnections.get(nodeId);
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn(`[WebSocket] 无法发送数据，节点 ${nodeId} 未连接`);
      return;
    }

    const message: ProxyDataMessage = {
      type: 'proxy_data',
      requestId,
      data: data.toString('base64'),
      isEnd,
      timestamp: Date.now(),
    };

    try {
      ws.send(JSON.stringify(message));
    } catch (error) {
      console.error(`[WebSocket] 发送代理数据失败: ${requestId}`, error);
    }
  }

  /**
   * 发送代理关闭消息到节点
   */
  public sendProxyClose(nodeId: string, requestId: string, reason?: string): void {
    const ws = this.nodeConnections.get(nodeId);
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const message: ProxyCloseMessage = {
      type: 'proxy_close',
      requestId,
      reason,
      timestamp: Date.now(),
    };

    try {
      ws.send(JSON.stringify(message));
      console.log(`[WebSocket] 发送关闭消息: ${requestId}`);
    } catch (error) {
      console.error(`[WebSocket] 发送关闭消息失败: ${requestId}`, error);
    }
  }

  /**
   * 处理来自节点的代理响应
   */
  private handleProxyResponse(message: ProxyResponseMessage): void {
    const pending = this.pendingProxyRequests.get(message.requestId);
    if (!pending) {
      console.warn(`[WebSocket] 未找到待处理的请求: ${message.requestId}`);
      return;
    }

    clearTimeout(pending.timeout);

    console.log(
      `[WebSocket] 收到代理响应: ${message.requestId} (success: ${message.success})`
    );

    if (message.success) {
      pending.resolve(message);
    } else {
      pending.reject(new Error(message.error || '代理请求失败'));
      this.pendingProxyRequests.delete(message.requestId);
    }
  }

  /**
   * 处理来自节点的代理数据
   */
  private handleProxyData(message: ProxyDataMessage): void {
    console.log(
      `[WebSocket] 收到代理数据: ${message.requestId} (${message.data.length} bytes, end: ${message.isEnd})`
    );

    // 发射数据事件，供代理服务器监听
    this.emit(`proxy_data_${message.requestId}`, {
      data: Buffer.from(message.data, 'base64'),
      isEnd: message.isEnd,
    });

    // 如果是最后一块数据，清理请求
    if (message.isEnd) {
      this.pendingProxyRequests.delete(message.requestId);
    }
  }

  /**
   * 处理来自节点的代理关闭
   */
  private handleProxyClose(message: ProxyCloseMessage): void {
    console.log(`[WebSocket] 收到代理关闭: ${message.requestId}`);

    // 发射关闭事件
    this.emit(`proxy_close_${message.requestId}`, {
      reason: message.reason,
    });

    // 清理请求
    const pending = this.pendingProxyRequests.get(message.requestId);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingProxyRequests.delete(message.requestId);
    }
  }

  /**
   * 处理来自节点的代理错误
   */
  private handleProxyError(message: ProxyErrorMessage): void {
    console.error(`[WebSocket] 收到代理错误: ${message.requestId} - ${message.error}`);

    // 发射错误事件
    this.emit(`proxy_error_${message.requestId}`, {
      error: message.error,
      code: message.code,
    });

    // 清理请求
    const pending = this.pendingProxyRequests.get(message.requestId);
    if (pending) {
      clearTimeout(pending.timeout);
      pending.reject(new Error(message.error));
      this.pendingProxyRequests.delete(message.requestId);
    }
  }

  /**
   * 清理代理请求（超时或断开时调用）
   */
  private cleanupProxyRequest(requestId: string): void {
    const pending = this.pendingProxyRequests.get(requestId);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingProxyRequests.delete(requestId);
    }
  }

  /**
   * 关闭 WebSocket 服务器
   */
  close(): void {
    // 清理所有待处理的代理请求
    for (const [requestId, pending] of this.pendingProxyRequests.entries()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('WebSocket 服务器关闭'));
    }
    this.pendingProxyRequests.clear();

    this.wss.close();
  }
}

