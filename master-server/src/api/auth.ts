import { Router, Request, Response } from 'express';
import { JWTAuthService } from '../security/jwt-auth';
import { AuditLogger } from '../security/audit-logger';

/**
 * 创建认证相关的API路由
 */
export function createAuthRouter(
  jwtService: JWTAuthService | null,
  auditLogger: AuditLogger,
  apiKey?: string
): Router {
  const router = Router();

  /**
   * POST /api/auth/token
   * 申请JWT Token
   */
  router.post('/token', (req: Request, res: Response) => {
    try {
      // 检查是否启用JWT认证
      if (!jwtService) {
        return res.status(501).json({
          success: false,
          message: 'JWT认证未启用',
        });
      }

      const { nodeId, apiKey: clientApiKey } = req.body;

      // 验证必需参数
      if (!nodeId || !clientApiKey) {
        return res.status(400).json({
          success: false,
          message: '缺少nodeId或apiKey参数',
        });
      }

      // 验证API Key
      if (apiKey && clientApiKey !== apiKey) {
        const ip = req.ip || req.socket.remoteAddress || 'unknown';
        auditLogger.logAuthFailure(ip, `JWT Token申请失败: API Key无效 (nodeId: ${nodeId})`);
        
        return res.status(401).json({
          success: false,
          message: 'API Key验证失败',
        });
      }

      // 生成JWT Token
      const token = jwtService.generateToken(nodeId, ['proxy', 'status']);

      // 记录审计日志
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      auditLogger.log({
        type: 'AUTH_SUCCESS' as any,
        nodeId,
        ip,
        details: 'JWT Token生成成功',
        severity: 'info',
      });

      res.json({
        success: true,
        token,
        expiresIn: 3600, // 1小时
      });
    } catch (error: any) {
      console.error('[Auth API] Token生成失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误',
      });
    }
  });

  /**
   * POST /api/auth/refresh
   * 刷新JWT Token
   */
  router.post('/refresh', (req: Request, res: Response) => {
    try {
      // 检查是否启用JWT认证
      if (!jwtService) {
        return res.status(501).json({
          success: false,
          message: 'JWT认证未启用',
        });
      }

      const { token } = req.body;

      if (!token) {
        return res.status(400).json({
          success: false,
          message: '缺少token参数',
        });
      }

      // 刷新Token
      const result = jwtService.refreshToken(token);

      if (!result.success) {
        return res.status(401).json({
          success: false,
          message: result.error || 'Token刷新失败',
        });
      }

      res.json({
        success: true,
        token: result.token,
        expiresIn: 3600,
      });
    } catch (error: any) {
      console.error('[Auth API] Token刷新失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误',
      });
    }
  });

  /**
   * POST /api/auth/verify
   * 验证JWT Token（用于测试）
   */
  router.post('/verify', (req: Request, res: Response) => {
    try {
      // 检查是否启用JWT认证
      if (!jwtService) {
        return res.status(501).json({
          success: false,
          message: 'JWT认证未启用',
        });
      }

      const { token } = req.body;

      if (!token) {
        return res.status(400).json({
          success: false,
          message: '缺少token参数',
        });
      }

      // 验证Token
      const result = jwtService.verifyToken(token);

      if (!result.valid) {
        return res.status(401).json({
          success: false,
          message: result.error || 'Token验证失败',
        });
      }

      res.json({
        success: true,
        payload: result.payload,
        needsRefresh: result.needsRefresh,
      });
    } catch (error: any) {
      console.error('[Auth API] Token验证失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误',
      });
    }
  });

  return router;
}
