// 节点配置
export interface NodeConfig {
  node: {
    name: string;
    region: string;
    httpPort: number;
    socks5Port: number;
    host?: string;
  };
  master: {
    url: string;
    wsUrl: string;
    apiKey?: string;
  };
  monitor: {
    reportInterval: number; // 状态上报间隔（毫秒）
  };
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

// ==================== 代理连接管理 ====================

// 活动的代理连接
export interface ActiveProxyConnection {
  requestId: string;
  protocol: string;
  socket: any;              // Socket 或 HTTP ClientRequest
  startTime: number;
}

// 控制指令响应
export interface CommandResponse {
  type: 'response';
  command: string;
  success: boolean;
  message?: string;
  data?: any;
}

// 代理连接信息
export interface ProxyConnection {
  id: string;
  protocol: 'http' | 'socks5';
  target: string;
  port: number;
  startTime: Date;
  bytesUp: number;
  bytesDown: number;
}

// 监控数据
export interface MonitorData {
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

