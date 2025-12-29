import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { config as dotenvConfig } from 'dotenv';
import { MasterServerConfig } from '../types';

// 加载 .env 文件
const envPath = join(__dirname, '../../.env');
if (existsSync(envPath)) {
  dotenvConfig({ path: envPath });
  console.log('[Config] 已加载 .env 文件');
}

const DEFAULT_CONFIG: MasterServerConfig = {
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxyHttpPort: 8080,
    proxySocks5Port: 1080,
  },
  nodeSelection: {
    strategy: 'least_connections',
    fallback: 'round_robin',
  },
  nodeTimeout: 30000, // 30秒
  security: {
    requireTLS: false, // 默认不强制TLS（向后兼容）
    enableMessageSigning: false, // 默认不启用消息签名（向后兼容）
    maxConnectionsPerNode: 1, // 每个节点默认只允许1个连接
    rateLimit: {
      maxMessagesPerMinute: 1000,
      maxProxyRequestsPerMinute: 500,
    },
  },
};

export function loadConfig(): MasterServerConfig {
  const configPath = join(__dirname, '../../config.json');
  
  try {
    const configFile = readFileSync(configPath, 'utf-8');
    const userConfig = JSON.parse(configFile);
    
    // 合并默认配置和用户配置
    return {
      ...DEFAULT_CONFIG,
      ...userConfig,
      server: {
        ...DEFAULT_CONFIG.server,
        ...(userConfig.server || {}),
      },
      nodeSelection: {
        ...DEFAULT_CONFIG.nodeSelection,
        ...(userConfig.nodeSelection || {}),
      },
      security: {
        ...DEFAULT_CONFIG.security,
        ...(userConfig.security || {}),
        rateLimit: {
          ...DEFAULT_CONFIG.security.rateLimit,
          ...(userConfig.security?.rateLimit || {}),
        },
      },
    };
  } catch (error) {
    console.warn(
      `[Config] 无法加载配置文件 ${configPath}，使用默认配置`
    );
    return DEFAULT_CONFIG;
  }
}

export function getConfig(): MasterServerConfig {
  // 优先从环境变量读取，其次从配置文件，最后使用默认值
  const config = loadConfig();
  
  // Master Server 地址和端口配置
  if (process.env.MASTER_HOST) {
    config.server.host = process.env.MASTER_HOST;
  }
  if (process.env.MASTER_PORT) {
    config.server.port = parseInt(process.env.MASTER_PORT, 10);
  }
  if (process.env.MASTER_HTTP_PROXY_PORT) {
    config.server.proxyHttpPort = parseInt(process.env.MASTER_HTTP_PROXY_PORT, 10);
  }
  if (process.env.MASTER_SOCKS5_PROXY_PORT) {
    config.server.proxySocks5Port = parseInt(process.env.MASTER_SOCKS5_PROXY_PORT, 10);
  }
  
  // 节点管理配置
  if (process.env.NODE_TIMEOUT) {
    config.nodeTimeout = parseInt(process.env.NODE_TIMEOUT, 10);
  }
  if (process.env.NODE_SELECTION_STRATEGY) {
    config.nodeSelection.strategy = process.env.NODE_SELECTION_STRATEGY as any;
  }
  if (process.env.NODE_SELECTION_FALLBACK) {
    config.nodeSelection.fallback = process.env.NODE_SELECTION_FALLBACK as any;
  }
  
  // 安全配置
  if (process.env.MASTER_API_KEY) {
    config.security.apiKey = process.env.MASTER_API_KEY;
  }
  if (process.env.MASTER_ALLOWED_NODE_IDS) {
    config.security.allowedNodeIds = process.env.MASTER_ALLOWED_NODE_IDS.split(',').map(id => id.trim());
  }
  if (process.env.MASTER_REQUIRE_TLS) {
    config.security.requireTLS = process.env.MASTER_REQUIRE_TLS === 'true';
  }
  if (process.env.MASTER_ENABLE_MESSAGE_SIGNING) {
    config.security.enableMessageSigning = process.env.MASTER_ENABLE_MESSAGE_SIGNING === 'true';
  }
  if (process.env.MASTER_MAX_CONNECTIONS_PER_NODE) {
    config.security.maxConnectionsPerNode = parseInt(process.env.MASTER_MAX_CONNECTIONS_PER_NODE, 10);
  }
  if (process.env.MASTER_RATE_LIMIT_MESSAGES) {
    config.security.rateLimit!.maxMessagesPerMinute = parseInt(process.env.MASTER_RATE_LIMIT_MESSAGES, 10);
  }
  if (process.env.MASTER_RATE_LIMIT_PROXY_REQUESTS) {
    config.security.rateLimit!.maxProxyRequestsPerMinute = parseInt(process.env.MASTER_RATE_LIMIT_PROXY_REQUESTS, 10);
  }
  
  // 验证配置
  if (config.security.enableMessageSigning && !config.security.apiKey) {
    console.warn('[Config] 警告: 启用了消息签名但未设置API Key，消息签名将无法工作');
  }
  
  return config;
}
