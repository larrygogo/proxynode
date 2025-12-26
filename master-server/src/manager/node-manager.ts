import { v4 as uuidv4 } from 'uuid';
import {
  Node,
  NodeInfo,
  NodeStatus,
  NodeRegisterRequest,
  NodeSelectionStrategy,
  MasterServerConfig,
} from '../types';

export class NodeManager {
  private nodes: Map<string, Node> = new Map();
  private roundRobinIndex: Map<string, number> = new Map(); // 用于轮询策略
  private config: MasterServerConfig;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: MasterServerConfig) {
    this.config = config;
    this.startCleanupTimer();
  }

  /**
   * 注册节点
   */
  registerNode(request: NodeRegisterRequest): string {
    const nodeId = uuidv4();
    const now = new Date();

    const nodeInfo: NodeInfo = {
      nodeId,
      name: request.name,
      region: request.region,
      httpPort: request.httpPort,
      socks5Port: request.socks5Port,
      capabilities: request.capabilities,
      host: request.host || 'localhost',
      publicIp: request.publicIp,
      registeredAt: now,
      lastHeartbeat: now,
    };

    const initialStatus: NodeStatus = {
      nodeId,
      status: 'online',
      connections: 0,
      bandwidth: {
        upload: 0,
        download: 0,
      },
      load: {
        cpu: 0,
        memory: 0,
      },
      timestamp: now,
    };

    const node: Node = {
      ...nodeInfo,
      status: initialStatus,
    };

    this.nodes.set(nodeId, node);
    this.roundRobinIndex.set(request.region, 0);

    console.log(`[NodeManager] 节点已注册: ${nodeId} (${request.name})`);
    return nodeId;
  }

  /**
   * 更新节点状态
   */
  updateNodeStatus(nodeId: string, statusUpdate: Partial<NodeStatus>): boolean {
    const node = this.nodes.get(nodeId);
    if (!node) {
      return false;
    }

    node.status = {
      ...node.status,
      ...statusUpdate,
      nodeId,
      timestamp: new Date(),
    };
    node.lastHeartbeat = new Date();

    return true;
  }

  /**
   * 获取节点
   */
  getNode(nodeId: string): Node | undefined {
    return this.nodes.get(nodeId);
  }

  /**
   * 获取所有节点
   */
  getAllNodes(): Node[] {
    return Array.from(this.nodes.values());
  }

  /**
   * 获取在线节点
   */
  getOnlineNodes(): Node[] {
    return this.getAllNodes().filter(
      (node) => node.status.status === 'online'
    );
  }

  /**
   * 根据协议获取可用节点
   */
  getAvailableNodes(protocol: 'http' | 'socks5'): Node[] {
    return this.getOnlineNodes().filter((node) =>
      node.capabilities.includes(protocol)
    );
  }

  /**
   * 选择节点（根据策略）
   */
  selectNode(
    protocol: 'http' | 'socks5',
    strategy?: NodeSelectionStrategy
  ): Node | null {
    const availableNodes = this.getAvailableNodes(protocol);
    if (availableNodes.length === 0) {
      return null;
    }

    const selectionStrategy =
      strategy || this.config.nodeSelection.strategy;

    switch (selectionStrategy) {
      case 'round_robin':
        return this.selectNodeRoundRobin(availableNodes);
      case 'least_connections':
        return this.selectNodeLeastConnections(availableNodes);
      case 'region_priority':
        return this.selectNodeRegionPriority(availableNodes);
      case 'manual':
        // 手动选择需要指定 nodeId，这里返回第一个可用节点
        return availableNodes[0];
      default:
        return availableNodes[0];
    }
  }

  /**
   * 轮询选择节点
   */
  private selectNodeRoundRobin(nodes: Node[]): Node {
    if (nodes.length === 0) {
      throw new Error('没有可用节点');
    }

    // 按区域分组
    const regionGroups = new Map<string, Node[]>();
    for (const node of nodes) {
      if (!regionGroups.has(node.region)) {
        regionGroups.set(node.region, []);
      }
      regionGroups.get(node.region)!.push(node);
    }

    // 如果只有一个区域，直接轮询
    if (regionGroups.size === 1) {
      const regionNodes = Array.from(regionGroups.values())[0];
      const index =
        this.roundRobinIndex.get(regionNodes[0].region) || 0;
      const selectedNode = regionNodes[index % regionNodes.length];
      this.roundRobinIndex.set(
        regionNodes[0].region,
        (index + 1) % regionNodes.length
      );
      return selectedNode;
    }

    // 多个区域，先按区域轮询，再在区域内轮询
    const regions = Array.from(regionGroups.keys());
    const defaultRegion = regions[0];
    const regionIndex =
      this.roundRobinIndex.get('_default_region') || 0;
    const selectedRegion = regions[regionIndex % regions.length];
    this.roundRobinIndex.set(
      '_default_region',
      (regionIndex + 1) % regions.length
    );

    const regionNodes = regionGroups.get(selectedRegion)!;
    const nodeIndex = this.roundRobinIndex.get(selectedRegion) || 0;
    const selectedNode = regionNodes[nodeIndex % regionNodes.length];
    this.roundRobinIndex.set(
      selectedRegion,
      (nodeIndex + 1) % regionNodes.length
    );

    return selectedNode;
  }

  /**
   * 选择连接数最少的节点
   */
  private selectNodeLeastConnections(nodes: Node[]): Node {
    if (nodes.length === 0) {
      throw new Error('没有可用节点');
    }

    return nodes.reduce((prev, current) => {
      return prev.status.connections < current.status.connections
        ? prev
        : current;
    });
  }

  /**
   * 区域优先选择节点
   */
  private selectNodeRegionPriority(nodes: Node[]): Node {
    if (nodes.length === 0) {
      throw new Error('没有可用节点');
    }

    const preferredRegion = this.config.nodeSelection.region;
    if (preferredRegion) {
      const regionNodes = nodes.filter(
        (node) => node.region === preferredRegion
      );
      if (regionNodes.length > 0) {
        return this.selectNodeLeastConnections(regionNodes);
      }
    }

    // 如果没有首选区域的节点，使用备用策略
    if (this.config.nodeSelection.fallback) {
      const fallbackStrategy = this.config.nodeSelection.fallback;
      switch (fallbackStrategy) {
        case 'round_robin':
          return this.selectNodeRoundRobin(nodes);
        case 'least_connections':
          return this.selectNodeLeastConnections(nodes);
        default:
          return nodes[0];
      }
    }

    return this.selectNodeLeastConnections(nodes);
  }

  /**
   * 注销节点
   */
  unregisterNode(nodeId: string): boolean {
    const node = this.nodes.get(nodeId);
    if (!node) {
      return false;
    }

    this.nodes.delete(nodeId);
    console.log(`[NodeManager] 节点已注销: ${nodeId} (${node.name})`);
    return true;
  }

  /**
   * 启动清理定时器（清理超时节点）
   */
  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupTimeoutNodes();
    }, 10000); // 每10秒检查一次
  }

  /**
   * 清理超时节点
   */
  private cleanupTimeoutNodes(): void {
    const now = new Date();
    const timeout = this.config.nodeTimeout;

    for (const [nodeId, node] of this.nodes.entries()) {
      const timeSinceHeartbeat =
        now.getTime() - node.lastHeartbeat.getTime();
      if (timeSinceHeartbeat > timeout) {
        console.log(
          `[NodeManager] 节点超时，标记为离线: ${nodeId} (${node.name})`
        );
        this.updateNodeStatus(nodeId, { status: 'offline' });
      }
    }
  }

  /**
   * 停止清理定时器
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * 获取节点统计信息
   */
  getStatistics(): {
    total: number;
    online: number;
    offline: number;
    byRegion: Record<string, number>;
  } {
    const nodes = this.getAllNodes();
    const onlineNodes = this.getOnlineNodes();
    const byRegion: Record<string, number> = {};

    for (const node of nodes) {
      byRegion[node.region] = (byRegion[node.region] || 0) + 1;
    }

    return {
      total: nodes.length,
      online: onlineNodes.length,
      offline: nodes.length - onlineNodes.length,
      byRegion,
    };
  }
}

