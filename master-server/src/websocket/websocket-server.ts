import { WebSocketServer, WebSocket } from 'ws';
import { Server as HttpServer } from 'http';
import { NodeManager } from '../manager/node-manager';
import { ControlCommand, NodeEvent, WebSocketMessage } from '../types';

interface NodeWebSocket extends WebSocket {
  nodeId?: string;
  isAlive?: boolean;
}

export class MasterWebSocketServer {
  private wss: WebSocketServer;
  private nodeManager: NodeManager;
  private nodeConnections: Map<string, NodeWebSocket> = new Map();

  constructor(server: HttpServer, nodeManager: NodeManager) {
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

  private handleMessage(ws: NodeWebSocket, message: WebSocketMessage): void {
    if (message.type === 'event') {
      // 处理节点事件
      this.handleNodeEvent(ws, message as NodeEvent);
    } else {
      console.warn('[WebSocket] 未知消息类型:', message);
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

  /**
   * 关闭 WebSocket 服务器
   */
  close(): void {
    this.wss.close();
  }
}

