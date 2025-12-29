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
  
  return config;
}
