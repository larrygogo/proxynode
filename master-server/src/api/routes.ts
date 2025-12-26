import { Router } from 'express';
import { NodeManager } from '../manager/node-manager';
import { createNodesRouter } from './nodes';
import { createHealthRouter } from './health';
import { createDashboardRouter } from './dashboard';

export function createApiRouter(nodeManager: NodeManager): Router {
  const router = Router();

  // API 路由
  router.use('/nodes', createNodesRouter(nodeManager));
  router.use('/health', createHealthRouter(nodeManager));
  router.use('/dashboard', createDashboardRouter(nodeManager));

  return router;
}

