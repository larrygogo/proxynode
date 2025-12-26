import { Router, Request, Response } from 'express';
import { NodeManager } from '../manager/node-manager';

export function createHealthRouter(nodeManager: NodeManager): Router {
  const router = Router();

  // 健康检查
  router.get('/', (req: Request, res: Response) => {
    try {
      const stats = nodeManager.getStatistics();
      res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        nodes: stats,
      });
    } catch (error: any) {
      console.error('[API] 健康检查错误:', error);
      res.status(500).json({
        success: false,
        status: 'unhealthy',
        message: error.message || '健康检查失败',
      });
    }
  });

  return router;
}

