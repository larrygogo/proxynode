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

