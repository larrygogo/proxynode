import { WebSocketServer, WebSocket } from 'ws';
import { Server as HttpServer } from 'http';
import { EventEmitter } from 'events';
import { IncomingMessage } from 'http';
import { NodeManager } from '../manager/node-manager';
import { AuditLogger } from '../security/audit-logger';
import { RateLimiter } from '../security/rate-limiter';
import { MessageSigner } from '../security/message-signer';
import { MasterServerConfig } from '../types';
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
  ip?: string;
  connectionCount?: number;
}

export class MasterWebSocketServer extends EventEmitter {
  private wss: WebSocketServer;
  private nodeManager: NodeManager;
  private config: MasterServerConfig;
  private auditLogger: AuditLogger;
  private rateLimiter: RateLimiter;
  private messageSigner: MessageSigner | null = null;
  private nodeConnections: Map<string, NodeWebSocket> = new Map();
  private nodeConnectionCounts: Map<string, number> = new Map();
  private pendingProxyRequests: Map<string, PendingProxyRequest> = new Map();
  private readonly PROXY_TIMEOUT = 60000; // 代理请求超时时间：60秒

  constructor(server: HttpServer, nodeManager: NodeManager, config: MasterServerConfig) {
    super();
    this.nodeManager = nodeManager;
    this.config = config;
    this.auditLogger = new AuditLogger();
    this.rateLimiter = new RateLimiter(
      config.security.rateLimit!.maxMessagesPerMinute,
      config.security.rateLimit!.maxProxyRequestsPerMinute
    );
    
    // 如果启用消息签名且有API Key，创建MessageSigner
    if (config.security.enableMessageSigning && config.security.apiKey) {
      this.messageSigner = new MessageSigner(config.security.apiKey);
    }
    
    this.wss = new WebSocketServer({ 
      server, 
      path: '/ws',
      verifyClient: this.verifyClient.bind(this),
    });

    this.setupWebSocketServer();
    this.startHeartbeat();
    
    console.log('[WebSocket] 安全功能已启用:');
    console.log(`  - API Key认证: ${config.security.apiKey ? '✓' : '✗'}`);
    console.log(`  - 节点白名单: ${config.security.allowedNodeIds ? '✓' : '✗'}`);
    console.log(`  - TLS强制: ${config.security.requireTLS ? '✓' : '✗'}`);
    console.log(`  - 消息签名: ${this.messageSigner ? '✓' : '✗'}`);
    console.log(`  - 速率限制: ✓`);
  }

  /**
   * 验证客户端连接
   */
  private verifyClient(
    info: { origin: string; secure: boolean; req: IncomingMessage },
    callback: (result: boolean, code?: number, message?: string) => void
  ): void {
    const req = info.req;
    const ip = req.socket.remoteAddress || 'unknown';

    // 1. 检查TLS要求
    if (this.config.security.requireTLS && !info.secure) {
      this.auditLogger.logTLSViolation(ip, '尝试使用非加密连接(ws://)');
      callback(false, 403, '必须使用加密连接(wss://)');
      return;
    }

    // 2. 验证API Key
    if (this.config.security.apiKey) {
      const clientApiKey = req.headers['x-api-key'] as string;
      if (!clientApiKey || clientApiKey !== this.config.security.apiKey) {
        this.auditLogger.logAuthFailure(ip, 'API Key无效或缺失');
        callback(false, 401, 'API Key验证失败');
        return;
      }
    }

    // 验证通过
    callback(true);
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: NodeWebSocket, req: IncomingMessage) => {
      const ip = req.socket.remoteAddress || 'unknown';
      ws.ip = ip;
      console.log(`[WebSocket] 新连接建立 IP: ${ip}`);

      ws.isAlive = true;

      // 处理 ping/pong 心跳
      ws.on('pong', () => {
        ws.isAlive = true;
      });

      // 处理消息
      ws.on('message', (data: Buffer) => {
        try {
          let message: any = JSON.parse(data.toString());
          
          // 验证消息签名（如果启用）
          if (this.messageSigner && ws.nodeId) {
            const verification = this.messageSigner.verifyMessage(message);
            if (!verification.valid) {
              console.error(`[WebSocket] 消息签名验证失败: ${verification.error}`);
              this.auditLogger.logSuspiciousActivity(
                ws.nodeId,
                ws.ip || 'unknown',
                `消息签名验证失败: ${verification.error}`
              );
              ws.send(
                JSON.stringify({
                  type: 'error',
                  message: '消息签名验证失败',
                })
              );
              return;
            }
            // 移除签名元数据
            message = this.messageSigner.stripSignature(message);
          }
          
          // 处理节点 ID 注册消息
          if (message.type === 'node_id' && message.nodeId) {
            this.registerNodeConnection(message.nodeId, ws);
            return;
          }
          
          // 速率限制检查（只对已注册的节点和控制消息检查）
          // 代理数据消息（proxy_data、proxy_response、proxy_close）不应被限制
          if (ws.nodeId) {
            const isProxyDataMessage = ['proxy_data', 'proxy_response', 'proxy_close', 'proxy_error'].includes(message.type);
            
            if (!isProxyDataMessage && !this.rateLimiter.checkMessageRate(ws.nodeId)) {
              this.auditLogger.logRateLimitExceeded(ws.nodeId, '消息速率');
              ws.send(
                JSON.stringify({
                  type: 'error',
                  message: '消息速率超限，请稍后重试',
                })
              );
              return;
            }
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
          this.auditLogger.logNodeDisconnected(ws.nodeId);
          this.nodeConnections.delete(ws.nodeId);
          
          // 减少连接计数
          const count = this.nodeConnectionCounts.get(ws.nodeId) || 1;
          if (count <= 1) {
            this.nodeConnectionCounts.delete(ws.nodeId);
            this.rateLimiter.reset(ws.nodeId);
          } else {
            this.nodeConnectionCounts.set(ws.nodeId, count - 1);
          }
        }
      });

      // 处理错误
      ws.on('error', (error) => {
        console.error('[WebSocket] 连接错误:', error);
        if (ws.nodeId) {
          this.auditLogger.logNodeDisconnected(ws.nodeId, `连接错误: ${error.message}`);
          this.nodeConnections.delete(ws.nodeId);
          
          // 减少连接计数
          const count = this.nodeConnectionCounts.get(ws.nodeId) || 1;
          if (count <= 1) {
            this.nodeConnectionCounts.delete(ws.nodeId);
            this.rateLimiter.reset(ws.nodeId);
          } else {
            this.nodeConnectionCounts.set(ws.nodeId, count - 1);
          }
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
    const ip = ws.ip || 'unknown';

    // 1. 验证节点白名单
    if (this.config.security.allowedNodeIds && 
        this.config.security.allowedNodeIds.length > 0) {
      if (!this.config.security.allowedNodeIds.includes(nodeId)) {
        this.auditLogger.logNodeRejected(nodeId, ip, '不在白名单中');
        ws.send(
          JSON.stringify({
            type: 'error',
            message: '节点ID未授权',
          })
        );
        ws.close(1008, '节点ID未授权');
        return;
      }
    }

    // 2. 检查该节点的连接数限制
    const currentConnections = this.nodeConnectionCounts.get(nodeId) || 0;
    const maxConnections = this.config.security.maxConnectionsPerNode || 1;
    
    if (currentConnections >= maxConnections) {
      this.auditLogger.logNodeRejected(nodeId, ip, `超过最大连接数限制(${maxConnections})`);
      ws.send(
        JSON.stringify({
          type: 'error',
          message: `节点连接数超限，最多允许${maxConnections}个连接`,
        })
      );
      ws.close(1008, '连接数超限');
      return;
    }

    // 3. 检查是否已有同nodeId的连接（如果限制为1，则关闭旧连接）
    if (maxConnections === 1 && this.nodeConnections.has(nodeId)) {
      const oldWs = this.nodeConnections.get(nodeId);
      if (oldWs && oldWs !== ws) {
        console.log(`[WebSocket] 关闭旧连接，nodeId: ${nodeId}`);
        oldWs.close(1000, '新连接已建立');
        this.nodeConnections.delete(nodeId);
      }
    }

    // 4. 注册连接
    ws.nodeId = nodeId;
    this.nodeConnections.set(nodeId, ws);
    this.nodeConnectionCounts.set(nodeId, currentConnections + 1);
    
    // 5. 记录审计日志
    this.auditLogger.logAuthSuccess(nodeId, ip);
    this.auditLogger.logNodeRegistered(nodeId, ip);
    
    console.log(`[WebSocket] 节点连接已注册: ${nodeId} (IP: ${ip})`);
    
    // 6. 发送确认消息
    ws.send(
      JSON.stringify({
        type: 'registered',
        nodeId: nodeId,
        message: '节点注册成功',
      })
    );
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
      // 如果启用了消息签名，对消息进行签名
      const messageToSend = this.messageSigner 
        ? this.messageSigner.signMessage(command)
        : command;
      
      ws.send(JSON.stringify(messageToSend));
      this.auditLogger.logCommandExecuted(nodeId, command.command);
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
    // 1. 检查代理请求速率限制
    if (!this.rateLimiter.checkProxyRequestRate(nodeId)) {
      this.auditLogger.logRateLimitExceeded(nodeId, '代理请求速率');
      throw new Error(`节点 ${nodeId} 代理请求速率超限`);
    }

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
        // 如果启用了消息签名，对消息进行签名
        const messageToSend = this.messageSigner 
          ? this.messageSigner.signMessage(request)
          : request;
        
        ws.send(JSON.stringify(messageToSend));
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

