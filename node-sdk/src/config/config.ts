import { readFileSync } from 'fs';
import { join } from 'path';
import { NodeConfig } from '../types';

export type { NodeConfig };

const DEFAULT_CONFIG: NodeConfig = {
  node: {
    name: 'node-001',
    region: 'us-west',
    httpPort: 8080,
    socks5Port: 1080,
  },
  master: {
    url: 'http://localhost:3000',
    wsUrl: 'ws://localhost:3000/ws',
  },
  monitor: {
    reportInterval: 30000, // 30秒
  },
};

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
  // 也支持从环境变量读取
  const config = loadConfig();

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
  if (process.env.MASTER_URL) {
    config.master.url = process.env.MASTER_URL;
  }
  if (process.env.MASTER_WS_URL) {
    config.master.wsUrl = process.env.MASTER_WS_URL;
  }
  if (process.env.MASTER_API_KEY) {
    config.master.apiKey = process.env.MASTER_API_KEY;
  }
  if (process.env.REPORT_INTERVAL) {
    config.monitor.reportInterval = parseInt(process.env.REPORT_INTERVAL, 10);
  }

  return config;
}

