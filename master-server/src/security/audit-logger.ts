import { writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export enum AuditEventType {
  AUTH_SUCCESS = 'AUTH_SUCCESS',
  AUTH_FAILURE = 'AUTH_FAILURE',
  NODE_REGISTERED = 'NODE_REGISTERED',
  NODE_REJECTED = 'NODE_REJECTED',
  NODE_DISCONNECTED = 'NODE_DISCONNECTED',
  COMMAND_EXECUTED = 'COMMAND_EXECUTED',
  COMMAND_REJECTED = 'COMMAND_REJECTED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  TLS_VIOLATION = 'TLS_VIOLATION',
}

export interface AuditEvent {
  timestamp: Date;
  type: AuditEventType;
  nodeId?: string;
  ip?: string;
  details: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

export class AuditLogger {
  private logDir: string;
  private logFile: string;

  constructor(logDir: string = 'logs') {
    this.logDir = join(process.cwd(), logDir);
    this.logFile = join(this.logDir, 'security-audit.log');
    
    // 确保日志目录存在
    if (!existsSync(this.logDir)) {
      mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * 记录审计事件
   */
  log(event: Omit<AuditEvent, 'timestamp'>): void {
    const fullEvent: AuditEvent = {
      timestamp: new Date(),
      ...event,
    };

    const logLine = this.formatLogLine(fullEvent);
    
    // 写入文件
    try {
      appendFileSync(this.logFile, logLine + '\n', 'utf-8');
    } catch (error) {
      console.error('[AuditLogger] 写入日志失败:', error);
    }

    // 如果是严重事件，同时输出到控制台
    if (event.severity === 'error' || event.severity === 'critical') {
      console.error(`[SECURITY AUDIT] ${logLine}`);
    } else if (event.severity === 'warning') {
      console.warn(`[SECURITY AUDIT] ${logLine}`);
    }
  }

  /**
   * 格式化日志行
   */
  private formatLogLine(event: AuditEvent): string {
    const parts = [
      event.timestamp.toISOString(),
      event.severity.toUpperCase(),
      event.type,
    ];

    if (event.nodeId) {
      parts.push(`NodeID=${event.nodeId}`);
    }

    if (event.ip) {
      parts.push(`IP=${event.ip}`);
    }

    parts.push(event.details);

    return parts.join(' | ');
  }

  /**
   * 记录认证成功
   */
  logAuthSuccess(nodeId: string, ip: string): void {
    this.log({
      type: AuditEventType.AUTH_SUCCESS,
      nodeId,
      ip,
      details: '节点认证成功',
      severity: 'info',
    });
  }

  /**
   * 记录认证失败
   */
  logAuthFailure(ip: string, reason: string): void {
    this.log({
      type: AuditEventType.AUTH_FAILURE,
      ip,
      details: `认证失败: ${reason}`,
      severity: 'warning',
    });
  }

  /**
   * 记录节点注册
   */
  logNodeRegistered(nodeId: string, ip: string): void {
    this.log({
      type: AuditEventType.NODE_REGISTERED,
      nodeId,
      ip,
      details: '节点注册成功',
      severity: 'info',
    });
  }

  /**
   * 记录节点被拒绝
   */
  logNodeRejected(nodeId: string, ip: string, reason: string): void {
    this.log({
      type: AuditEventType.NODE_REJECTED,
      nodeId,
      ip,
      details: `节点被拒绝: ${reason}`,
      severity: 'warning',
    });
  }

  /**
   * 记录节点断开
   */
  logNodeDisconnected(nodeId: string, reason?: string): void {
    this.log({
      type: AuditEventType.NODE_DISCONNECTED,
      nodeId,
      details: reason ? `节点断开: ${reason}` : '节点断开',
      severity: 'info',
    });
  }

  /**
   * 记录命令执行
   */
  logCommandExecuted(nodeId: string, command: string): void {
    this.log({
      type: AuditEventType.COMMAND_EXECUTED,
      nodeId,
      details: `执行命令: ${command}`,
      severity: 'info',
    });
  }

  /**
   * 记录命令被拒绝
   */
  logCommandRejected(nodeId: string, command: string, reason: string): void {
    this.log({
      type: AuditEventType.COMMAND_REJECTED,
      nodeId,
      details: `命令被拒绝: ${command} - ${reason}`,
      severity: 'warning',
    });
  }

  /**
   * 记录速率限制超限
   */
  logRateLimitExceeded(nodeId: string, limitType: string): void {
    this.log({
      type: AuditEventType.RATE_LIMIT_EXCEEDED,
      nodeId,
      details: `速率限制超限: ${limitType}`,
      severity: 'warning',
    });
  }

  /**
   * 记录可疑活动
   */
  logSuspiciousActivity(nodeId: string, ip: string, activity: string): void {
    this.log({
      type: AuditEventType.SUSPICIOUS_ACTIVITY,
      nodeId,
      ip,
      details: `可疑活动: ${activity}`,
      severity: 'error',
    });
  }

  /**
   * 记录TLS违规
   */
  logTLSViolation(ip: string, reason: string): void {
    this.log({
      type: AuditEventType.TLS_VIOLATION,
      ip,
      details: `TLS违规: ${reason}`,
      severity: 'error',
    });
  }
}
