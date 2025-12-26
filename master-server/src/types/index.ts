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
}

// 代理请求信息
export interface ProxyRequest {
  protocol: 'http' | 'socks5';
  target: string;
  port: number;
}

