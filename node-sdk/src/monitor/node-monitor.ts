import * as si from 'systeminformation';
import { MonitorData, ProxyConnection } from '../types';

export class NodeMonitor {
  private connections: Map<string, ProxyConnection> = new Map();
  private bandwidthStats: {
    upload: number;
    download: number;
  } = {
    upload: 0,
    download: 0,
  };
  private lastBandwidthCheck: Date = new Date();
  private bandwidthCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startBandwidthMonitoring();
  }

  /**
   * 添加代理连接
   */
  addConnection(connection: ProxyConnection): void {
    this.connections.set(connection.id, connection);
  }

  /**
   * 移除代理连接
   */
  removeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      // 更新带宽统计
      this.bandwidthStats.upload += connection.bytesUp;
      this.bandwidthStats.download += connection.bytesDown;
      this.connections.delete(connectionId);
    }
  }

  /**
   * 更新连接数据量
   */
  updateConnectionBytes(
    connectionId: string,
    bytesUp: number,
    bytesDown: number
  ): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.bytesUp += bytesUp;
      connection.bytesDown += bytesDown;
    }
  }

  /**
   * 获取当前监控数据
   */
  async getMonitorData(): Promise<MonitorData> {
    // 获取连接数
    const connections = this.connections.size;

    // 获取带宽（每秒字节数）
    const bandwidth = this.getCurrentBandwidth();

    // 获取系统负载
    const load = await this.getSystemLoad();

    return {
      connections,
      bandwidth,
      load,
    };
  }

  /**
   * 获取当前带宽（每秒字节数）
   */
  private getCurrentBandwidth(): { upload: number; download: number } {
    const now = new Date();
    const timeDiff = (now.getTime() - this.lastBandwidthCheck.getTime()) / 1000; // 秒

    if (timeDiff <= 0) {
      return { upload: 0, download: 0 };
    }

    // 计算总数据量
    let totalUpload = 0;
    let totalDownload = 0;

    for (const connection of this.connections.values()) {
      totalUpload += connection.bytesUp;
      totalDownload += connection.bytesDown;
    }

    // 加上之前的带宽统计
    totalUpload += this.bandwidthStats.upload;
    totalDownload += this.bandwidthStats.download;

    // 计算每秒速率
    const uploadRate = totalUpload / timeDiff;
    const downloadRate = totalDownload / timeDiff;

    // 重置统计
    this.bandwidthStats.upload = 0;
    this.bandwidthStats.download = 0;
    this.lastBandwidthCheck = now;

    // 重置连接的数据量计数（保留连接但重置计数）
    for (const connection of this.connections.values()) {
      connection.bytesUp = 0;
      connection.bytesDown = 0;
    }

    return {
      upload: Math.round(uploadRate),
      download: Math.round(downloadRate),
    };
  }

  /**
   * 获取系统负载
   */
  private async getSystemLoad(): Promise<{ cpu: number; memory: number }> {
    try {
      const [cpu, mem] = await Promise.all([
        si.currentLoad(),
        si.mem(),
      ]);

      return {
        cpu: Math.round(cpu.currentLoad),
        memory: Math.round((mem.used / mem.total) * 100),
      };
    } catch (error) {
      console.error('[NodeMonitor] 获取系统负载失败:', error);
      return { cpu: 0, memory: 0 };
    }
  }

  /**
   * 启动带宽监控
   */
  private startBandwidthMonitoring(): void {
    // 每秒检查一次
    this.bandwidthCheckInterval = setInterval(() => {
      // 这里主要是为了定期重置统计
      // 实际的带宽计算在 getMonitorData 中完成
    }, 1000);
  }

  /**
   * 停止监控
   */
  stop(): void {
    if (this.bandwidthCheckInterval) {
      clearInterval(this.bandwidthCheckInterval);
      this.bandwidthCheckInterval = null;
    }
  }

  /**
   * 获取连接统计
   */
  getConnectionStats(): {
    total: number;
    byProtocol: { http: number; socks5: number };
  } {
    let httpCount = 0;
    let socks5Count = 0;

    for (const connection of this.connections.values()) {
      if (connection.protocol === 'http') {
        httpCount++;
      } else if (connection.protocol === 'socks5') {
        socks5Count++;
      }
    }

    return {
      total: this.connections.size,
      byProtocol: {
        http: httpCount,
        socks5: socks5Count,
      },
    };
  }
}

