import { createHmac, randomBytes } from 'crypto';

/**
 * WebSocket消息签名和验证工具
 * 使用HMAC-SHA256算法
 */
export class MessageSigner {
  private secretKey: string;
  private readonly NONCE_SIZE = 16; // 16字节随机数
  private readonly TIME_WINDOW = 5 * 60 * 1000; // 5分钟时间窗口
  private processedNonces: Set<string> = new Set();

  constructor(apiKey: string) {
    // 从API Key派生签名密钥
    this.secretKey = createHmac('sha256', 'message-signing-key')
      .update(apiKey)
      .digest('hex');

    // 每10分钟清理一次已处理的nonce
    setInterval(() => this.cleanupNonces(), 10 * 60 * 1000);
  }

  /**
   * 签名消息
   */
  signMessage(message: any): any {
    const timestamp = Date.now();
    const nonce = randomBytes(this.NONCE_SIZE).toString('hex');

    // 创建签名数据
    const messageWithMeta = {
      ...message,
      _timestamp: timestamp,
      _nonce: nonce,
    };

    // 计算HMAC签名
    const signature = this.calculateSignature(messageWithMeta);

    return {
      ...messageWithMeta,
      _signature: signature,
    };
  }

  /**
   * 验证消息签名
   */
  verifyMessage(message: any): { valid: boolean; error?: string } {
    // 检查必需字段
    if (!message._signature || !message._timestamp || !message._nonce) {
      return { valid: false, error: '消息缺少签名元数据' };
    }

    // 检查时间窗口
    const now = Date.now();
    const timestamp = message._timestamp;
    if (Math.abs(now - timestamp) > this.TIME_WINDOW) {
      return { valid: false, error: '消息时间戳超出有效窗口' };
    }

    // 检查nonce是否已使用（防重放攻击）
    const nonce = message._nonce;
    if (this.processedNonces.has(nonce)) {
      return { valid: false, error: '检测到重放攻击：nonce已使用' };
    }

    // 验证签名
    const receivedSignature = message._signature;
    const expectedSignature = this.calculateSignature(message);

    if (receivedSignature !== expectedSignature) {
      return { valid: false, error: '签名验证失败' };
    }

    // 记录已处理的nonce
    this.processedNonces.add(nonce);

    return { valid: true };
  }

  /**
   * 从消息中移除签名元数据
   */
  stripSignature(message: any): any {
    const { _signature, _timestamp, _nonce, ...cleanMessage } = message;
    return cleanMessage;
  }

  /**
   * 计算消息的HMAC签名
   */
  private calculateSignature(message: any): string {
    // 创建消息副本，排除签名字段
    const { _signature, ...messageToSign } = message;

    // 将消息转换为规范化的JSON字符串
    const canonicalJson = JSON.stringify(this.sortObject(messageToSign));

    // 计算HMAC-SHA256
    return createHmac('sha256', this.secretKey)
      .update(canonicalJson)
      .digest('hex');
  }

  /**
   * 对象键排序（确保签名一致性）
   */
  private sortObject(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sortObject(item));
    }

    const sorted: any = {};
    Object.keys(obj)
      .sort()
      .forEach(key => {
        sorted[key] = this.sortObject(obj[key]);
      });

    return sorted;
  }

  /**
   * 清理过期的nonce
   */
  private cleanupNonces(): void {
    // 简单策略：定期清空所有nonce
    // 更好的策略是记录nonce的时间戳，只清理过期的
    this.processedNonces.clear();
  }
}
