import { createHmac, randomBytes } from 'crypto';

/**
 * JWT Token数据接口
 */
export interface JWTPayload {
  nodeId: string;
  permissions: string[];
  iat: number; // issued at
  exp: number; // expiration
}

/**
 * JWT认证服务
 * 使用简化的JWT实现（基于Node.js内置crypto）
 */
export class JWTAuthService {
  private secret: string;
  private readonly TOKEN_EXPIRATION = 60 * 60 * 1000; // 1小时
  private readonly REFRESH_THRESHOLD = 5 * 60 * 1000; // 提前5分钟刷新

  constructor(apiKey: string) {
    // 从API Key派生JWT密钥
    this.secret = createHmac('sha256', 'jwt-secret-key')
      .update(apiKey)
      .digest('hex');
  }

  /**
   * 生成JWT Token
   */
  generateToken(nodeId: string, permissions: string[] = ['proxy']): string {
    const now = Date.now();
    const payload: JWTPayload = {
      nodeId,
      permissions,
      iat: now,
      exp: now + this.TOKEN_EXPIRATION,
    };

    return this.createToken(payload);
  }

  /**
   * 验证JWT Token
   */
  verifyToken(token: string): { valid: boolean; payload?: JWTPayload; error?: string; needsRefresh?: boolean } {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return { valid: false, error: 'Token格式无效' };
      }

      const [headerB64, payloadB64, signature] = parts;

      // 验证签名
      const expectedSignature = this.sign(`${headerB64}.${payloadB64}`);
      if (signature !== expectedSignature) {
        return { valid: false, error: '签名验证失败' };
      }

      // 解析payload
      const payload: JWTPayload = JSON.parse(
        Buffer.from(payloadB64, 'base64url').toString('utf-8')
      );

      // 检查过期时间
      const now = Date.now();
      if (now >= payload.exp) {
        return { valid: false, error: 'Token已过期' };
      }

      // 检查是否需要刷新
      const needsRefresh = now >= payload.exp - this.REFRESH_THRESHOLD;

      return { valid: true, payload, needsRefresh };
    } catch (error: any) {
      return { valid: false, error: `Token解析失败: ${error.message}` };
    }
  }

  /**
   * 刷新Token
   */
  refreshToken(oldToken: string): { success: boolean; token?: string; error?: string } {
    const verification = this.verifyToken(oldToken);
    if (!verification.valid || !verification.payload) {
      return { success: false, error: verification.error || '无效的Token' };
    }

    // 生成新Token
    const newToken = this.generateToken(
      verification.payload.nodeId,
      verification.payload.permissions
    );

    return { success: true, token: newToken };
  }

  /**
   * 创建Token
   */
  private createToken(payload: JWTPayload): string {
    const header = {
      alg: 'HS256',
      typ: 'JWT',
    };

    const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');

    const signature = this.sign(`${headerB64}.${payloadB64}`);

    return `${headerB64}.${payloadB64}.${signature}`;
  }

  /**
   * 签名数据
   */
  private sign(data: string): string {
    return createHmac('sha256', this.secret)
      .update(data)
      .digest('base64url');
  }

  /**
   * 检查权限
   */
  hasPermission(payload: JWTPayload, permission: string): boolean {
    return payload.permissions.includes(permission) || payload.permissions.includes('*');
  }
}
