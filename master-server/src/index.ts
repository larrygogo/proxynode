import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { join } from 'path';
import { getConfig } from './config/config';
import { NodeManager } from './manager/node-manager';
import { createApiRouter } from './api/routes';
import { MasterWebSocketServer } from './websocket/websocket-server';
import { HttpProxyServer } from './proxy/http-proxy';
import { Socks5ProxyServer } from './proxy/socks5-proxy';

async function startMasterServer() {
  console.log('[MasterServer] 正在启动主服务器...');

  // 加载配置
  const config = getConfig();
  console.log('[MasterServer] 配置加载完成');
  console.log(`[MasterServer] 监听地址: ${config.server.host}`);

  // 创建 Express 应用
  const app = express();
  app.use(cors());
  app.use(express.json());
  
  // 提供静态文件（监控页面）
  app.use(express.static(join(__dirname, '../public')));

  // 创建 HTTP 服务器
  const httpServer = createServer(app);

  // 创建节点管理器
  const nodeManager = new NodeManager(config);
  console.log('[MasterServer] 节点管理器已创建');

  // 创建 API 路由
  app.use('/api', createApiRouter(nodeManager));
  console.log('[MasterServer] API 路由已注册');

  // 创建 WebSocket 服务器
  const wsServer = new MasterWebSocketServer(httpServer, nodeManager);
  console.log('[MasterServer] WebSocket 服务器已创建');

  // 创建代理服务器（通过 WebSocket 隧道转发）
  const httpProxy = new HttpProxyServer(nodeManager, wsServer);
  const socks5Proxy = new Socks5ProxyServer(nodeManager, wsServer);
  console.log('[MasterServer] 代理服务器已创建（WebSocket 隧道模式）');

  // 启动 HTTP 服务器（API + WebSocket）
  httpServer.listen(config.server.port, config.server.host, () => {
    console.log(
      `[MasterServer] HTTP 服务器启动在 ${config.server.host}:${config.server.port}`
    );
    console.log(`[MasterServer] 监控面板: http://localhost:${config.server.port}/dashboard.html`);
    console.log(`[MasterServer] API 地址: http://localhost:${config.server.port}/api`);
    console.log(`[MasterServer] WebSocket 地址: ws://localhost:${config.server.port}/ws`);
  });

  // 启动 HTTP 代理服务器
  httpProxy.listen(config.server.proxyHttpPort, config.server.host, () => {
    console.log(
      `[MasterServer] HTTP 代理服务器启动在 ${config.server.host}:${config.server.proxyHttpPort}`
    );
  });

  // 启动 SOCKS5 代理服务器
  socks5Proxy.listen(config.server.proxySocks5Port, config.server.host, () => {
    console.log(
      `[MasterServer] SOCKS5 代理服务器启动在 ${config.server.host}:${config.server.proxySocks5Port}`
    );
  });

  // 优雅关闭
  process.on('SIGTERM', () => {
    console.log('[MasterServer] 收到 SIGTERM 信号，正在关闭...');
    httpServer.close();
    httpProxy.close();
    socks5Proxy.close();
    nodeManager.stop();
    wsServer.close();
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('[MasterServer] 收到 SIGINT 信号，正在关闭...');
    httpServer.close();
    httpProxy.close();
    socks5Proxy.close();
    nodeManager.stop();
    wsServer.close();
    process.exit(0);
  });

  console.log('[MasterServer] 主服务器启动完成');
}

// 启动服务器
startMasterServer().catch((error) => {
  console.error('[MasterServer] 启动失败:', error);
  process.exit(1);
});

