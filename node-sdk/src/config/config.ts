import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { config as dotenvConfig } from 'dotenv';
import { NodeConfig } from '../types';

export type { NodeConfig };

// 加载 .env 文件
const envPath = join(__dirname, '../../.env');
if (existsSync(envPath)) {
  dotenvConfig({ path: envPath });
  console.log('[Config] 已加载 .env 文件');
}

const DEFAULT_CONFIG: NodeConfig = {
  node: {
    name: 'node-001',
    region: 'local',
    httpPort: 8081,
    socks5Port: 1081,
    host: '0.0.0.0',
  },
  master: {
    url: 'http://localhost:3000',
    wsUrl: 'ws://localhost:3000/ws',
    // 默认不使用WSS（向后兼容），但生产环境应使用wss://
  },
  monitor: {
    reportInterval: 30000, // 30秒
  },
};

/**
 * 验证WebSocket URL是否安全
 */
function validateWebSocketUrl(wsUrl: string, requireTLS: boolean = false): void {
  if (requireTLS && wsUrl.startsWith('ws://')) {
    console.error('[Config] 安全警告: 检测到不安全的WebSocket连接(ws://)');
    console.error('[Config] 生产环境必须使用加密连接(wss://)');
    if (process.env.NODE_ENV === 'production') {
      throw new Error('生产环境禁止使用不安全的WebSocket连接(ws://)，请使用wss://');
    }
  } else if (wsUrl.startsWith('ws://') && !wsUrl.includes('localhost') && !wsUrl.includes('127.0.0.1')) {
    console.warn('[Config] 安全警告: 使用不安全的WebSocket连接(ws://)连接到远程服务器');
    console.warn('[Config] 建议使用加密连接(wss://)以保护数据传输安全');
  }
}

export function loadConfig(): NodeConfig {
  const configPath = join(__dirname, '../../config.json');

  try {
    const configFile = readFileSync(configPath, 'utf-8');
    const userConfig = JSON.parse(configFile);

    // 合并默认配置和用户配置
    return {
      ...DEFAULT_CONFIG,
      ...userConfig,
      node: {
        ...DEFAULT_CONFIG.node,
        ...(userConfig.node || {}),
      },
      master: {
        ...DEFAULT_CONFIG.master,
        ...(userConfig.master || {}),
      },
      monitor: {
        ...DEFAULT_CONFIG.monitor,
        ...(userConfig.monitor || {}),
      },
    };
  } catch (error) {
    console.warn(
      `[Config] 无法加载配置文件 ${configPath}，使用默认配置`
    );
    return DEFAULT_CONFIG;
  }
}

export function getConfig(): NodeConfig {
  // 优先从环境变量读取，其次从配置文件，最后使用默认值
  const config = loadConfig();

  // Node 基本配置
  if (process.env.NODE_NAME) {
    config.node.name = process.env.NODE_NAME;
  }
  if (process.env.NODE_REGION) {
    config.node.region = process.env.NODE_REGION;
  }
  if (process.env.NODE_HTTP_PORT) {
    config.node.httpPort = parseInt(process.env.NODE_HTTP_PORT, 10);
  }
  if (process.env.NODE_SOCKS5_PORT) {
    config.node.socks5Port = parseInt(process.env.NODE_SOCKS5_PORT, 10);
  }
  if (process.env.NODE_HOST) {
    config.node.host = process.env.NODE_HOST;
  }
  
  // Master Server 连接配置
  if (process.env.MASTER_URL) {
    config.master.url = process.env.MASTER_URL;
  }
  if (process.env.MASTER_WS_URL) {
    config.master.wsUrl = process.env.MASTER_WS_URL;
  }
  if (process.env.MASTER_API_KEY) {
    config.master.apiKey = process.env.MASTER_API_KEY;
  }
  
  // 监控配置
  if (process.env.MONITOR_REPORT_INTERVAL) {
    config.monitor.reportInterval = parseInt(process.env.MONITOR_REPORT_INTERVAL, 10);
  }

  // 验证WebSocket URL安全性
  const requireTLS = process.env.NODE_REQUIRE_TLS === 'true';
  validateWebSocketUrl(config.master.wsUrl, requireTLS);

  // 安全建议
  if (!config.master.apiKey) {
    console.warn('[Config] 安全警告: 未设置MASTER_API_KEY，节点认证可能失败');
  }

  return config;
}
