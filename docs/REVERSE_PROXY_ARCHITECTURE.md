# 反向连接架构设计

## 问题背景

**当前架构缺陷：**
- Node 可能没有稳定的公网 IP
- Node 可能在多层 NAT/路由器后面
- Master 无法主动连接到 Node

**解决方案：** 采用反向连接架构，Node 主动连接 Master，所有代理流量通过 WebSocket 隧道转发。

---

## 架构对比

### ❌ 旧架构：Master 主动连接 Node

```
客户端 → Master (HTTP/SOCKS5)
          ↓ 直接连接
        Node (无法穿透 NAT)
          ↓
        目标网站
```

**问题：** Master 无法连接到 NAT 后的 Node

### ✅ 新架构：WebSocket 隧道

```
客户端 → Master (HTTP/SOCKS5)
          ↓ WebSocket 消息
        Node (主动连接 Master)
          ↓ 实际代理请求
        目标网站
```

**优势：** Node 主动连接，可穿透 NAT

---

## WebSocket 消息协议

### 消息类型

```typescript
// 基础消息结构
interface WebSocketMessage {
  type: string;
  timestamp: number;
}

// 1. 代理请求（Master → Node）
interface ProxyRequestMessage extends WebSocketMessage {
  type: 'proxy_request';
  requestId: string;       // 唯一请求 ID
  protocol: 'http' | 'https' | 'socks5';
  method?: string;         // HTTP 方法
  url?: string;            // 完整 URL (HTTP)
  target?: {               // 目标地址 (HTTPS/SOCKS5)
    host: string;
    port: number;
  };
  headers?: Record<string, string>;
  body?: string;           // Base64 编码的请求体
}

// 2. 代理响应头（Node → Master）
interface ProxyResponseMessage extends WebSocketMessage {
  type: 'proxy_response';
  requestId: string;
  success: boolean;
  statusCode?: number;
  statusMessage?: string;
  headers?: Record<string, string>;
  error?: string;
}

// 3. 数据流（双向）
interface ProxyDataMessage extends WebSocketMessage {
  type: 'proxy_data';
  requestId: string;
  data: string;            // Base64 编码的数据块
  isEnd: boolean;          // 是否是最后一块
}

// 4. 连接关闭（双向）
interface ProxyCloseMessage extends WebSocketMessage {
  type: 'proxy_close';
  requestId: string;
  reason?: string;
}

// 5. 错误消息（双向）
interface ProxyErrorMessage extends WebSocketMessage {
  type: 'proxy_error';
  requestId: string;
  error: string;
  code?: string;
}
```

### 消息流程

#### HTTP 代理请求

```
1. 客户端 → Master: GET http://example.com/api
2. Master → Node (WebSocket):
   {
     type: 'proxy_request',
     requestId: 'req-001',
     protocol: 'http',
     method: 'GET',
     url: 'http://example.com/api',
     headers: { ... }
   }
3. Node 处理请求
4. Node → Master (WebSocket):
   {
     type: 'proxy_response',
     requestId: 'req-001',
     statusCode: 200,
     headers: { ... }
   }
5. Node → Master (WebSocket):
   {
     type: 'proxy_data',
     requestId: 'req-001',
     data: '<base64 encoded data>',
     isEnd: true
   }
6. Master → 客户端: 返回响应
```

#### HTTPS 代理请求 (CONNECT)

```
1. 客户端 → Master: CONNECT example.com:443
2. Master → 客户端: 200 Connection Established
3. Master → Node (WebSocket):
   {
     type: 'proxy_request',
     requestId: 'req-002',
     protocol: 'https',
     target: { host: 'example.com', port: 443 }
   }
4. Node 建立到 example.com:443 的连接
5. Node → Master (WebSocket):
   {
     type: 'proxy_response',
     requestId: 'req-002',
     success: true
   }
6. 双向数据流：
   - 客户端数据 → Master → Node (proxy_data) → 目标
   - 目标数据 → Node → Master (proxy_data) → 客户端
```

#### SOCKS5 代理请求

```
1. 客户端 → Master: SOCKS5 握手
2. Master 完成 SOCKS5 握手
3. Master → Node (WebSocket):
   {
     type: 'proxy_request',
     requestId: 'req-003',
     protocol: 'socks5',
     target: { host: 'example.com', port: 80 }
   }
4. Node 建立连接
5. Node → Master: proxy_response (success)
6. 双向数据流传输
```

---

## 实现细节

### Master Server 修改

#### 1. `master-server/src/websocket/websocket-server.ts`

添加代理请求管理：

```typescript
export class MasterWebSocketServer {
  private wss: WebSocket.Server;
  private nodeManager: NodeManager;
  private connections: Map<string, WebSocket> = new Map();
  private proxyRequests: Map<string, ProxyRequest> = new Map(); // 新增

  // 新增：存储待处理的代理请求
  interface ProxyRequest {
    requestId: string;
    nodeId: string;
    clientSocket: Socket;
    resolve: (data: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }

  // 新增：通过 WebSocket 发送代理请求
  public async sendProxyRequest(
    nodeId: string,
    request: ProxyRequestMessage
  ): Promise<any> {
    const ws = this.connections.get(nodeId);
    if (!ws) {
      throw new Error(`节点 ${nodeId} 未连接`);
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.proxyRequests.delete(request.requestId);
        reject(new Error('代理请求超时'));
      }, 30000);

      this.proxyRequests.set(request.requestId, {
        requestId: request.requestId,
        nodeId,
        clientSocket: null as any,
        resolve,
        reject,
        timeout,
      });

      ws.send(JSON.stringify(request));
    });
  }

  // 新增：处理来自 Node 的代理响应
  private handleProxyResponse(message: ProxyResponseMessage): void {
    const request = this.proxyRequests.get(message.requestId);
    if (!request) {
      console.warn(`[WebSocket] 未找到请求: ${message.requestId}`);
      return;
    }

    clearTimeout(request.timeout);
    
    if (message.success) {
      request.resolve(message);
    } else {
      request.reject(new Error(message.error || '代理请求失败'));
    }
  }

  // 扩展：处理消息
  private handleMessage(ws: WebSocket, nodeId: string, data: string): void {
    const message = JSON.parse(data);

    switch (message.type) {
      case 'heartbeat':
        // 现有逻辑
        break;
      case 'status':
        // 现有逻辑
        break;
      case 'proxy_response':
        this.handleProxyResponse(message);
        break;
      case 'proxy_data':
        this.handleProxyData(message);
        break;
      case 'proxy_close':
        this.handleProxyClose(message);
        break;
      case 'proxy_error':
        this.handleProxyError(message);
        break;
      default:
        console.warn(`[WebSocket] 未知消息类型: ${message.type}`);
    }
  }
}
```

#### 2. `master-server/src/proxy/http-proxy.ts`

修改为通过 WebSocket 转发：

```typescript
export class HttpProxyServer {
  constructor(
    private nodeManager: NodeManager,
    private wsServer: MasterWebSocketServer // 新增
  ) {
    // ...
  }

  private async handleHttp(
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    
    const node = this.nodeManager.selectNode('http');
    if (!node) {
      res.writeHead(502, 'No available nodes');
      res.end();
      return;
    }

    const requestId = uuidv4();

    try {
      // 通过 WebSocket 发送代理请求
      const proxyRequest: ProxyRequestMessage = {
        type: 'proxy_request',
        requestId,
        protocol: 'http',
        method: req.method,
        url: req.url,
        headers: req.headers as Record<string, string>,
        timestamp: Date.now(),
      };

      // 如果有请求体，读取并编码
      if (req.method === 'POST' || req.method === 'PUT') {
        const body = await this.readRequestBody(req);
        proxyRequest.body = body.toString('base64');
      }

      // 发送请求
      const response = await this.wsServer.sendProxyRequest(
        node.nodeId,
        proxyRequest
      );

      // 写入响应头
      res.writeHead(
        response.statusCode,
        response.statusMessage,
        response.headers
      );

      // 等待数据流
      await this.receiveProxyData(requestId, res);
    } catch (error: any) {
      console.error(`[HttpProxy] 代理请求失败:`, error);
      res.writeHead(502, 'Proxy Error');
      res.end();
    }
  }

  private async handleConnect(
    req: IncomingMessage,
    socket: Socket,
    head: Buffer
  ): Promise<void> {
    const url = new URL(`https://${req.url}`);
    
    const node = this.nodeManager.selectNode('http');
    if (!node) {
      socket.write('HTTP/1.1 502 No available nodes\r\n\r\n');
      socket.end();
      return;
    }

    const requestId = uuidv4();

    try {
      const proxyRequest: ProxyRequestMessage = {
        type: 'proxy_request',
        requestId,
        protocol: 'https',
        target: {
          host: url.hostname,
          port: parseInt(url.port || '443', 10),
        },
        timestamp: Date.now(),
      };

      const response = await this.wsServer.sendProxyRequest(
        node.nodeId,
        proxyRequest
      );

      if (response.success) {
        socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        
        // 建立双向数据流
        this.setupTunnel(requestId, socket, node.nodeId);
      } else {
        socket.write('HTTP/1.1 502 Proxy Error\r\n\r\n');
        socket.end();
      }
    } catch (error: any) {
      console.error(`[HttpProxy] CONNECT 失败:`, error);
      socket.write('HTTP/1.1 502 Proxy Error\r\n\r\n');
      socket.end();
    }
  }

  private setupTunnel(
    requestId: string,
    clientSocket: Socket,
    nodeId: string
  ): void {
    // 客户端 → Master → Node
    clientSocket.on('data', (data: Buffer) => {
      this.wsServer.sendProxyData(nodeId, requestId, data);
    });

    // Node → Master → 客户端（通过 WebSocket 接收）
    this.wsServer.on(`proxy_data_${requestId}`, (data: Buffer) => {
      clientSocket.write(data);
    });

    clientSocket.on('close', () => {
      this.wsServer.sendProxyClose(nodeId, requestId);
    });

    this.wsServer.on(`proxy_close_${requestId}`, () => {
      clientSocket.end();
    });
  }
}
```

#### 3. `master-server/src/proxy/socks5-proxy.ts`

类似修改，通过 WebSocket 转发 SOCKS5 请求。

### Node Server 修改

#### 1. `node-sdk/src/websocket/websocket-client.ts`

添加代理请求处理：

```typescript
export class WebSocketClient {
  private ws: WebSocket | null = null;
  private proxyConnections: Map<string, ProxyConnection> = new Map();

  interface ProxyConnection {
    requestId: string;
    socket: Socket;
    protocol: string;
  }

  private setupMessageHandler(): void {
    if (!this.ws) return;

    this.ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());

        switch (message.type) {
          case 'proxy_request':
            await this.handleProxyRequest(message);
            break;
          case 'proxy_data':
            this.handleProxyData(message);
            break;
          case 'proxy_close':
            this.handleProxyClose(message);
            break;
          // ... 现有的 heartbeat, command 等
        }
      } catch (error) {
        console.error('[WebSocket] 消息处理错误:', error);
      }
    });
  }

  private async handleProxyRequest(
    message: ProxyRequestMessage
  ): Promise<void> {
    console.log(
      `[WebSocket] 收到代理请求: ${message.protocol} ${message.requestId}`
    );

    try {
      if (message.protocol === 'http') {
        await this.handleHttpProxyRequest(message);
      } else if (message.protocol === 'https') {
        await this.handleHttpsProxyRequest(message);
      } else if (message.protocol === 'socks5') {
        await this.handleSocks5ProxyRequest(message);
      }
    } catch (error: any) {
      console.error('[WebSocket] 代理请求处理失败:', error);
      this.sendProxyError(message.requestId, error.message);
    }
  }

  private async handleHttpProxyRequest(
    message: ProxyRequestMessage
  ): Promise<void> {
    const url = new URL(message.url!);
    const options = {
      method: message.method,
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      headers: message.headers,
    };

    const targetReq = http.request(options, (targetRes) => {
      // 发送响应头
      this.sendProxyResponse(message.requestId, {
        statusCode: targetRes.statusCode!,
        statusMessage: targetRes.statusMessage!,
        headers: targetRes.headers as Record<string, string>,
      });

      // 转发响应数据
      targetRes.on('data', (chunk: Buffer) => {
        this.sendProxyData(message.requestId, chunk, false);
      });

      targetRes.on('end', () => {
        this.sendProxyData(message.requestId, Buffer.from(''), true);
      });
    });

    targetReq.on('error', (error) => {
      this.sendProxyError(message.requestId, error.message);
    });

    // 发送请求体
    if (message.body) {
      const body = Buffer.from(message.body, 'base64');
      targetReq.write(body);
    }

    targetReq.end();
  }

  private async handleHttpsProxyRequest(
    message: ProxyRequestMessage
  ): Promise<void> {
    const { host, port } = message.target!;

    const socket = createConnection({ host, port }, () => {
      console.log(`[WebSocket] HTTPS 隧道已建立: ${host}:${port}`);
      
      this.proxyConnections.set(message.requestId, {
        requestId: message.requestId,
        socket,
        protocol: 'https',
      });

      this.sendProxyResponse(message.requestId, { success: true });
    });

    socket.on('data', (data: Buffer) => {
      this.sendProxyData(message.requestId, data, false);
    });

    socket.on('close', () => {
      this.proxyConnections.delete(message.requestId);
      this.sendProxyClose(message.requestId);
    });

    socket.on('error', (error) => {
      this.sendProxyError(message.requestId, error.message);
    });
  }

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
    this.ws?.send(JSON.stringify(message));
  }

  private sendProxyData(
    requestId: string,
    data: Buffer,
    isEnd: boolean
  ): void {
    const message: ProxyDataMessage = {
      type: 'proxy_data',
      requestId,
      data: data.toString('base64'),
      isEnd,
      timestamp: Date.now(),
    };
    this.ws?.send(JSON.stringify(message));
  }

  private sendProxyError(requestId: string, error: string): void {
    const message: ProxyErrorMessage = {
      type: 'proxy_error',
      requestId,
      error,
      timestamp: Date.now(),
    };
    this.ws?.send(JSON.stringify(message));
  }
}
```

---

## 部署方案

### 方案 A：Node 在任意位置（推荐）⭐

```
互联网
  ↑ WebSocket
Master (服务器: 47.110.58.130)
  ↑
多层 NAT/路由器
  ↑
Node (家庭/公司/任意网络)
```

**适用场景：**
- Node 没有公网 IP
- Node 在 NAT/路由器后面
- Node 使用动态 IP
- 家庭宽带、公司内网等

### 方案 B：混合部署

```
Master (服务器)
  ↕ WebSocket      ↕ 直接连接
Node (NAT 后)   Node (有公网 IP)
```

**适用场景：**
- 部分 Node 有公网 IP（直接连接，低延迟）
- 部分 Node 无公网 IP（WebSocket 隧道）

---

## 性能考虑

### WebSocket 隧道性能

**优势：**
- ✅ 单一 TCP 连接，减少握手开销
- ✅ 二进制帧支持，高效传输
- ✅ 长连接，无需反复建立连接

**劣势：**
- ❌ 相比直连有额外延迟（+5-20ms）
- ❌ 所有流量经过 Master 转发

**优化：**
- 使用二进制 WebSocket 消息（`ws.send(buffer)`）
- 启用压缩扩展（permessage-deflate）
- 设置合理的缓冲区大小

### 流量控制

```typescript
// 背压控制
if (ws.bufferedAmount > MAX_BUFFER_SIZE) {
  // 暂停读取客户端数据
  clientSocket.pause();
  
  ws.once('drain', () => {
    clientSocket.resume();
  });
}
```

---

## 安全考虑

1. **认证机制**
   - Node 连接时需要提供 API Key
   - 定期刷新 Token

2. **加密传输**
   - 使用 WSS (WebSocket over TLS)
   - 配置: `wss://master.example.com/ws`

3. **流量隔离**
   - 每个代理请求独立的 requestId
   - 超时自动清理

4. **DDoS 防护**
   - 限制每个 Node 的并发请求数
   - 限制消息大小

---

## 迁移步骤

1. **实现新的 WebSocket 协议**（向后兼容）
2. **测试 WebSocket 隧道功能**
3. **逐步切换流量到新架构**
4. **移除旧的直连代码**

---

## 示例：完整的代理请求流程

```typescript
// 客户端请求
curl -x http://47.110.58.130:8080 http://example.com

// Master Server 日志
[HttpProxy] 收到请求: GET http://example.com
[HttpProxy] 选择节点: node-001
[WebSocket] 发送代理请求: req-123 → node-001

// Node Server 日志
[WebSocket] 收到代理请求: req-123
[ProxyHandler] 建立连接: example.com:80
[ProxyHandler] 发送响应头: 200 OK
[ProxyHandler] 转发数据: 1024 bytes
[ProxyHandler] 请求完成: req-123

// Master Server 日志
[WebSocket] 收到响应: req-123
[HttpProxy] 转发响应给客户端
[HttpProxy] 请求完成
```

---

这种架构是业界标准方案，frp、ngrok、CloudFlare Tunnel 等都使用类似原理！
