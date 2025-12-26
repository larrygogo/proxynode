import { Router, Request, Response } from 'express';
import { NodeManager } from '../manager/node-manager';
import {
  NodeRegisterRequest,
  NodeRegisterResponse,
  NodeStatusUpdateRequest,
} from '../types';

export function createNodesRouter(nodeManager: NodeManager): Router {
  const router = Router();

  // 节点注册
  router.post('/register', (req: Request, res: Response) => {
    try {
      const registerRequest: NodeRegisterRequest = req.body;

      // 验证必需字段
      if (
        !registerRequest.name ||
        !registerRequest.region ||
        !registerRequest.httpPort ||
        !registerRequest.socks5Port ||
        !registerRequest.capabilities
      ) {
        return res.status(400).json({
          success: false,
          message: '缺少必需字段',
        });
      }

      const nodeId = nodeManager.registerNode(registerRequest);

      const response: NodeRegisterResponse = {
        nodeId,
        success: true,
        message: '节点注册成功',
      };

      res.json(response);
    } catch (error: any) {
      console.error('[API] 节点注册错误:', error);
      res.status(500).json({
        success: false,
        message: error.message || '节点注册失败',
      });
    }
  });

  // 更新节点状态
  router.put('/:nodeId/status', (req: Request, res: Response) => {
    try {
      const { nodeId } = req.params;
      const statusUpdate: NodeStatusUpdateRequest = req.body;

      if (!nodeId || statusUpdate.nodeId !== nodeId) {
        return res.status(400).json({
          success: false,
          message: '节点ID不匹配',
        });
      }

      const success = nodeManager.updateNodeStatus(nodeId, {
        status: statusUpdate.status,
        connections: statusUpdate.connections,
        bandwidth: statusUpdate.bandwidth,
        load: statusUpdate.load,
      });

      if (!success) {
        return res.status(404).json({
          success: false,
          message: '节点不存在',
        });
      }

      res.json({
        success: true,
        message: '状态更新成功',
      });
    } catch (error: any) {
      console.error('[API] 状态更新错误:', error);
      res.status(500).json({
        success: false,
        message: error.message || '状态更新失败',
      });
    }
  });

  // 获取所有节点
  router.get('/', (req: Request, res: Response) => {
    try {
      const nodes = nodeManager.getAllNodes();
      res.json({
        success: true,
        data: nodes,
        count: nodes.length,
      });
    } catch (error: any) {
      console.error('[API] 获取节点列表错误:', error);
      res.status(500).json({
        success: false,
        message: error.message || '获取节点列表失败',
      });
    }
  });

  // 获取特定节点
  router.get('/:nodeId', (req: Request, res: Response) => {
    try {
      const { nodeId } = req.params;
      const node = nodeManager.getNode(nodeId);

      if (!node) {
        return res.status(404).json({
          success: false,
          message: '节点不存在',
        });
      }

      res.json({
        success: true,
        data: node,
      });
    } catch (error: any) {
      console.error('[API] 获取节点错误:', error);
      res.status(500).json({
        success: false,
        message: error.message || '获取节点失败',
      });
    }
  });

  // 获取节点状态
  router.get('/:nodeId/status', (req: Request, res: Response) => {
    try {
      const { nodeId } = req.params;
      const node = nodeManager.getNode(nodeId);

      if (!node) {
        return res.status(404).json({
          success: false,
          message: '节点不存在',
        });
      }

      res.json({
        success: true,
        data: node.status,
      });
    } catch (error: any) {
      console.error('[API] 获取节点状态错误:', error);
      res.status(500).json({
        success: false,
        message: error.message || '获取节点状态失败',
      });
    }
  });

  return router;
}

