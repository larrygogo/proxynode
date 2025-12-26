import { Router, Request, Response } from 'express';
import { NodeManager } from '../manager/node-manager';

export function createDashboardRouter(nodeManager: NodeManager): Router {
  const router = Router();

  // 获取仪表板数据
  router.get('/stats', (req: Request, res: Response) => {
    try {
      const nodes = nodeManager.getAllNodes();
      const stats = nodeManager.getStatistics();

      // 计算总带宽和连接数
      let totalConnections = 0;
      let totalBandwidthUp = 0;
      let totalBandwidthDown = 0;

      const nodeDetails = nodes.map((node) => {
        totalConnections += node.status.connections;
        totalBandwidthUp += node.status.bandwidth.upload;
        totalBandwidthDown += node.status.bandwidth.download;

        return {
          nodeId: node.nodeId,
          name: node.name,
          region: node.region,
          status: node.status.status,
          host: node.host,
          publicIp: node.publicIp,
          httpPort: node.httpPort,
          socks5Port: node.socks5Port,
          connections: node.status.connections,
          bandwidth: {
            upload: node.status.bandwidth.upload,
            download: node.status.bandwidth.download,
          },
          load: {
            cpu: node.status.load.cpu,
            memory: node.status.load.memory,
          },
          lastHeartbeat: node.lastHeartbeat,
          uptime: Date.now() - new Date(node.registeredAt).getTime(),
        };
      });

      res.json({
        success: true,
        data: {
          summary: {
            totalNodes: stats.total,
            onlineNodes: stats.online,
            offlineNodes: stats.offline,
            totalConnections,
            totalBandwidth: {
              upload: totalBandwidthUp,
              download: totalBandwidthDown,
            },
          },
          nodes: nodeDetails,
          byRegion: stats.byRegion,
        },
      });
    } catch (error: any) {
      console.error('[Dashboard] 获取统计数据错误:', error);
      res.status(500).json({
        success: false,
        message: error.message || '获取统计数据失败',
      });
    }
  });

  return router;
}

