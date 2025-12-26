import { getConfig } from './config/config';
import { NodeMonitor } from './monitor/node-monitor';
import { HttpProxyServer } from './proxy/http-proxy';
import { Socks5ProxyServer } from './proxy/socks5-proxy';
import { HttpClient } from './server/http-client';
import { WebSocketClient } from './server/websocket-client';

async function startNodeServer() {
  console.log('[NodeServer] 正在启动节点服务器...');

  // 加载配置
  const config = getConfig();
  console.log('[NodeServer] 配置加载完成');

  // 创建监控器
  const monitor = new NodeMonitor();
  console.log('[NodeServer] 监控器已创建');

  // 创建代理服务器
  const httpProxy = new HttpProxyServer(monitor);
  const socks5Proxy = new Socks5ProxyServer(monitor);
  console.log('[NodeServer] 代理服务器已创建');

  // 启动代理服务器
  httpProxy.listen(config.node.httpPort, () => {
    console.log(
      `[NodeServer] HTTP 代理服务器启动在端口 ${config.node.httpPort}`
    );
  });

  socks5Proxy.listen(config.node.socks5Port, () => {
    console.log(
      `[NodeServer] SOCKS5 代理服务器启动在端口 ${config.node.socks5Port}`
    );
  });

  // 创建 HTTP 客户端
  const httpClient = new HttpClient(config, monitor);

  // 注册节点到主服务器
  let nodeId: string;
  try {
    nodeId = await httpClient.register();
    console.log(`[NodeServer] 节点已注册: ${nodeId}`);
  } catch (error: any) {
    console.error('[NodeServer] 节点注册失败:', error.message);
    process.exit(1);
  }

  // 创建 WebSocket 客户端
  const wsClient = new WebSocketClient(
    config,
    nodeId,
    httpProxy,
    socks5Proxy
  );

  // 连接到主服务器
  try {
    await wsClient.connect();
    console.log('[NodeServer] WebSocket 连接已建立');
  } catch (error: any) {
    console.error('[NodeServer] WebSocket 连接失败:', error.message);
    // WebSocket 连接失败不影响节点运行，但会失去实时控制能力
  }

  // 启动状态上报
  httpClient.startStatusReporting();

  // 优雅关闭
  process.on('SIGTERM', () => {
    console.log('[NodeServer] 收到 SIGTERM 信号，正在关闭...');
    httpClient.stopStatusReporting();
    wsClient.disconnect();
    httpProxy.close();
    socks5Proxy.close();
    monitor.stop();
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('[NodeServer] 收到 SIGINT 信号，正在关闭...');
    httpClient.stopStatusReporting();
    wsClient.disconnect();
    httpProxy.close();
    socks5Proxy.close();
    monitor.stop();
    process.exit(0);
  });

  console.log('[NodeServer] 节点服务器启动完成');
  console.log(`[NodeServer] 节点名称: ${config.node.name}`);
  console.log(`[NodeServer] 节点区域: ${config.node.region}`);
  console.log(`[NodeServer] HTTP 代理端口: ${config.node.httpPort}`);
  console.log(`[NodeServer] SOCKS5 代理端口: ${config.node.socks5Port}`);
}

// 启动服务器
startNodeServer().catch((error) => {
  console.error('[NodeServer] 启动失败:', error);
  process.exit(1);
});

