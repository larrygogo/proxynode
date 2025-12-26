import { readFileSync } from 'fs';
import { join } from 'path';
import { MasterServerConfig } from '../types';

const DEFAULT_CONFIG: MasterServerConfig = {
  server: {
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
  // 也支持从环境变量读取
  const config = loadConfig();
  
  if (process.env.MASTER_PORT) {
    config.server.port = parseInt(process.env.MASTER_PORT, 10);
  }
  if (process.env.PROXY_HTTP_PORT) {
    config.server.proxyHttpPort = parseInt(process.env.PROXY_HTTP_PORT, 10);
  }
  if (process.env.PROXY_SOCKS5_PORT) {
    config.server.proxySocks5Port = parseInt(
      process.env.PROXY_SOCKS5_PORT,
      10
    );
  }
  if (process.env.NODE_TIMEOUT) {
    config.nodeTimeout = parseInt(process.env.NODE_TIMEOUT, 10);
  }
  if (process.env.NODE_SELECTION_STRATEGY) {
    config.nodeSelection.strategy = process.env
      .NODE_SELECTION_STRATEGY as any;
  }
  
  return config;
}

