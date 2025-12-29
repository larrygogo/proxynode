import { Router } from 'express';
import { NodeManager } from '../manager/node-manager';
import { JWTAuthService } from '../security/jwt-auth';
import { AuditLogger } from '../security/audit-logger';
import { createNodesRouter } from './nodes';
import { createHealthRouter } from './health';
import { createDashboardRouter } from './dashboard';
import { createAuthRouter } from './auth';

export function createApiRouter(
  nodeManager: NodeManager,
  jwtService: JWTAuthService | null = null,
  auditLogger: AuditLogger | null = null,
  apiKey?: string
): Router {
  const router = Router();

  // API 路由
  router.use('/nodes', createNodesRouter(nodeManager));
  router.use('/health', createHealthRouter(nodeManager));
  router.use('/dashboard', createDashboardRouter(nodeManager));
  
  // 认证路由（如果启用JWT）
  if (jwtService && auditLogger) {
    router.use('/auth', createAuthRouter(jwtService, auditLogger, apiKey));
  }

  return router;
}

