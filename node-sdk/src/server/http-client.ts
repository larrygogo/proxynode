import axios, { AxiosInstance } from 'axios';
import { NodeConfig } from '../types';
import { NodeMonitor } from '../monitor/node-monitor';
import {
  NodeRegisterRequest,
  NodeRegisterResponse,
  NodeStatusUpdateRequest,
} from '../types';
import { getPublicIp } from '../utils/get-public-ip';

export class HttpClient {
  private axiosInstance: AxiosInstance;
  private config: NodeConfig;
  private monitor: NodeMonitor;
  private nodeId: string | null = null;
  private statusReportInterval: NodeJS.Timeout | null = null;
  private publicIp: string | undefined = undefined;

  constructor(config: NodeConfig, monitor: NodeMonitor) {
    this.config = config;
    this.monitor = monitor;
    this.axiosInstance = axios.create({
      baseURL: config.master.url,
      timeout: 10000,
      headers: config.master.apiKey
        ? { 'X-API-Key': config.master.apiKey }
        : {},
    });
  }

  /**
   * 注册节点
   */
  async register(): Promise<string> {
    try {
      // 获取公网IP
      console.log('[HttpClient] 正在获取公网IP...');
      this.publicIp = await getPublicIp();

      const registerRequest: NodeRegisterRequest = {
        name: this.config.node.name,
        region: this.config.node.region,
        httpPort: this.config.node.httpPort,
        socks5Port: this.config.node.socks5Port,
        capabilities: ['http', 'socks5'],
        host: this.config.node.host,
        publicIp: this.publicIp,
      };

      const response = await this.axiosInstance.post<NodeRegisterResponse>(
        '/api/nodes/register',
        registerRequest
      );

      if (response.data.success && response.data.nodeId) {
        this.nodeId = response.data.nodeId;
        console.log(`[HttpClient] 节点注册成功: ${this.nodeId}`);
        return this.nodeId;
      } else {
        throw new Error(response.data.message || '注册失败');
      }
    } catch (error: any) {
      console.error('[HttpClient] 节点注册失败:', error.message);
      throw error;
    }
  }

  /**
   * 上报节点状态
   */
  async reportStatus(): Promise<void> {
    if (!this.nodeId) {
      console.warn('[HttpClient] 节点未注册，无法上报状态');
      return;
    }

    try {
      const monitorData = await this.monitor.getMonitorData();

      const statusUpdate: NodeStatusUpdateRequest = {
        nodeId: this.nodeId,
        status: 'online',
        connections: monitorData.connections,
        bandwidth: monitorData.bandwidth,
        load: monitorData.load,
      };

      await this.axiosInstance.put(
        `/api/nodes/${this.nodeId}/status`,
        statusUpdate
      );

      console.log(
        `[HttpClient] 状态上报成功: 连接数=${monitorData.connections}, CPU=${monitorData.load.cpu}%, 内存=${monitorData.load.memory}%`
      );
    } catch (error: any) {
      console.error('[HttpClient] 状态上报失败:', error.message);
    }
  }

  /**
   * 启动定期状态上报
   */
  startStatusReporting(): void {
    if (this.statusReportInterval) {
      return; // 已经启动
    }

    // 立即上报一次
    this.reportStatus();

    // 定期上报
    this.statusReportInterval = setInterval(() => {
      this.reportStatus();
    }, this.config.monitor.reportInterval);

    console.log(
      `[HttpClient] 状态上报已启动，间隔: ${this.config.monitor.reportInterval}ms`
    );
  }

  /**
   * 停止状态上报
   */
  stopStatusReporting(): void {
    if (this.statusReportInterval) {
      clearInterval(this.statusReportInterval);
      this.statusReportInterval = null;
      console.log('[HttpClient] 状态上报已停止');
    }
  }

  /**
   * 获取节点 ID
   */
  getNodeId(): string | null {
    return this.nodeId;
  }
}

