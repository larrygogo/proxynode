/**
 * 速率限制器
 * 使用滑动窗口算法限制消息和请求频率
 */
export class RateLimiter {
  private messageCounters: Map<string, number[]> = new Map();
  private proxyRequestCounters: Map<string, number[]> = new Map();
  private maxMessagesPerMinute: number;
  private maxProxyRequestsPerMinute: number;

  constructor(maxMessagesPerMinute: number, maxProxyRequestsPerMinute: number) {
    this.maxMessagesPerMinute = maxMessagesPerMinute;
    this.maxProxyRequestsPerMinute = maxProxyRequestsPerMinute;

    // 每分钟清理一次过期数据
    setInterval(() => this.cleanup(), 60000);
  }

  /**
   * 检查消息速率是否超限
   */
  checkMessageRate(nodeId: string): boolean {
    const now = Date.now();
    const timestamps = this.messageCounters.get(nodeId) || [];
    
    // 移除1分钟之前的记录
    const recent = timestamps.filter(ts => now - ts < 60000);
    
    if (recent.length >= this.maxMessagesPerMinute) {
      return false; // 超限
    }

    // 记录此次消息
    recent.push(now);
    this.messageCounters.set(nodeId, recent);
    return true;
  }

  /**
   * 检查代理请求速率是否超限
   */
  checkProxyRequestRate(nodeId: string): boolean {
    const now = Date.now();
    const timestamps = this.proxyRequestCounters.get(nodeId) || [];
    
    // 移除1分钟之前的记录
    const recent = timestamps.filter(ts => now - ts < 60000);
    
    if (recent.length >= this.maxProxyRequestsPerMinute) {
      return false; // 超限
    }

    // 记录此次请求
    recent.push(now);
    this.proxyRequestCounters.set(nodeId, recent);
    return true;
  }

  /**
   * 获取节点当前消息速率
   */
  getMessageRate(nodeId: string): number {
    const now = Date.now();
    const timestamps = this.messageCounters.get(nodeId) || [];
    const recent = timestamps.filter(ts => now - ts < 60000);
    return recent.length;
  }

  /**
   * 获取节点当前代理请求速率
   */
  getProxyRequestRate(nodeId: string): number {
    const now = Date.now();
    const timestamps = this.proxyRequestCounters.get(nodeId) || [];
    const recent = timestamps.filter(ts => now - ts < 60000);
    return recent.length;
  }

  /**
   * 重置节点的速率限制计数器
   */
  reset(nodeId: string): void {
    this.messageCounters.delete(nodeId);
    this.proxyRequestCounters.delete(nodeId);
  }

  /**
   * 清理过期数据
   */
  private cleanup(): void {
    const now = Date.now();

    // 清理消息计数器
    for (const [nodeId, timestamps] of this.messageCounters.entries()) {
      const recent = timestamps.filter(ts => now - ts < 60000);
      if (recent.length === 0) {
        this.messageCounters.delete(nodeId);
      } else {
        this.messageCounters.set(nodeId, recent);
      }
    }

    // 清理代理请求计数器
    for (const [nodeId, timestamps] of this.proxyRequestCounters.entries()) {
      const recent = timestamps.filter(ts => now - ts < 60000);
      if (recent.length === 0) {
        this.proxyRequestCounters.delete(nodeId);
      } else {
        this.proxyRequestCounters.set(nodeId, recent);
      }
    }
  }

  /**
   * 获取所有节点的速率统计
   */
  getStats(): { nodeId: string; messageRate: number; proxyRequestRate: number }[] {
    const stats: { nodeId: string; messageRate: number; proxyRequestRate: number }[] = [];
    const allNodeIds = new Set([
      ...this.messageCounters.keys(),
      ...this.proxyRequestCounters.keys(),
    ]);

    for (const nodeId of allNodeIds) {
      stats.push({
        nodeId,
        messageRate: this.getMessageRate(nodeId),
        proxyRequestRate: this.getProxyRequestRate(nodeId),
      });
    }

    return stats;
  }
}
