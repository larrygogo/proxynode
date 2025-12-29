// 节点信息
export interface NodeInfo {
  nodeId: string;
  name: string;
  region: string;
  httpPort: number;
  socks5Port: number;
  capabilities: string[];
  host?: string; // 节点主机地址
  publicIp?: string; // 节点公网IP
  registeredAt: Date;
  lastHeartbeat: Date;
}

// 节点状态
export interface NodeStatus {
  nodeId: string;
  status: 'online' | 'offline' | 'error';
  connections: number;
  bandwidth: {
    upload: number; // bytes/sec
    download: number; // bytes/sec
  };
  load: {
    cpu: number; // percentage
    memory: number; // percentage
  };
  timestamp: Date;
}

// 节点注册请求
export interface NodeRegisterRequest {
  name: string;
  region: string;
  httpPort: number;
  socks5Port: number;
  capabilities: string[];
  host?: string;
  publicIp?: string;
}

// 节点注册响应
export interface NodeRegisterResponse {
  nodeId: string;
  success: boolean;
  message?: string;
}

// 节点状态更新请求
export interface NodeStatusUpdateRequest {
  nodeId: string;
  status: NodeStatus['status'];
  connections: number;
  bandwidth: {
    upload: number;
    download: number;
  };
  load: {
    cpu: number;
    memory: number;
  };
}

// WebSocket 控制指令
export interface ControlCommand {
  type: 'command';
  command: 'enable' | 'disable' | 'update_config' | 'restart';
  payload?: any;
}

// WebSocket 事件
export interface NodeEvent {
  type: 'event';
  event: 'status_changed' | 'connection_count_changed' | 'error';
  data: any;
}

// WebSocket 消息类型
export type WebSocketMessage = ControlCommand | NodeEvent;

// ==================== WebSocket 代理消息类型 ====================

// 基础代理消息
export interface BaseProxyMessage {
  type: string;
  requestId: string;
  timestamp: number;
}

// 代理请求消息（Master → Node）
export interface ProxyRequestMessage extends BaseProxyMessage {
  type: 'proxy_request';
  protocol: 'http' | 'https' | 'socks5';
  method?: string;          // HTTP 方法（仅 HTTP）
  url?: string;             // 完整 URL（仅 HTTP）
  target?: {                // 目标地址（HTTPS/SOCKS5）
    host: string;
    port: number;
  };
  headers?: Record<string, string | string[]>;
  body?: string;            // Base64 编码的请求体
}

// 代理响应消息（Node → Master）
export interface ProxyResponseMessage extends BaseProxyMessage {
  type: 'proxy_response';
  success: boolean;
  statusCode?: number;
  statusMessage?: string;
  headers?: Record<string, string | string[]>;
  error?: string;
}

// 代理数据消息（双向）
export interface ProxyDataMessage extends BaseProxyMessage {
  type: 'proxy_data';
  data: string;             // Base64 编码的数据
  isEnd: boolean;           // 是否是最后一块数据
}

// 代理连接关闭消息（双向）
export interface ProxyCloseMessage extends BaseProxyMessage {
  type: 'proxy_close';
  reason?: string;
}

// 代理错误消息（双向）
export interface ProxyErrorMessage extends BaseProxyMessage {
  type: 'proxy_error';
  error: string;
  code?: string;
}

// 所有代理消息类型
export type ProxyMessage = 
  | ProxyRequestMessage 
  | ProxyResponseMessage 
  | ProxyDataMessage 
  | ProxyCloseMessage 
  | ProxyErrorMessage;

// ==================== 代理请求管理 ====================

// 待处理的代理请求
export interface PendingProxyRequest {
  requestId: string;
  nodeId: string;
  protocol: string;
  resolve: (data: any) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
  dataCallback?: (data: Buffer) => void;
  closeCallback?: () => void;
}

// 节点选择策略
export type NodeSelectionStrategy = 
  | 'round_robin' 
  | 'least_connections' 
  | 'region_priority' 
  | 'manual';

// 完整节点数据（包含状态）
export interface Node extends NodeInfo {
  status: NodeStatus;
}

// 主服务器配置
export interface MasterServerConfig {
  server: {
    host: string; // 监听地址
    port: number;
    proxyHttpPort: number;
    proxySocks5Port: number;
  };
  nodeSelection: {
    strategy: NodeSelectionStrategy;
    fallback?: NodeSelectionStrategy;
    region?: string; // 用于 region_priority 策略
  };
  nodeTimeout: number; // 节点超时时间（毫秒）
  security: {
    apiKey?: string; // API Key用于节点认证
    allowedNodeIds?: string[]; // 白名单节点ID列表
    requireTLS?: boolean; // 是否强制使用TLS/WSS
    enableMessageSigning?: boolean; // 是否启用消息HMAC签名（需要apiKey）
    maxConnectionsPerNode?: number; // 每个节点的最大连接数
    rateLimit?: {
      maxMessagesPerMinute: number; // 每分钟最大消息数
      maxProxyRequestsPerMinute: number; // 每分钟最大代理请求数
    };
  };
}

// 代理请求信息
export interface ProxyRequest {
  protocol: 'http' | 'socks5';
  target: string;
  port: number;
}

