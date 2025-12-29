# 安全配置指南

本指南介绍如何配置和使用ProxyNode的安全功能。

## 安全功能概览

ProxyNode v2.1提供了以下安全功能：

1. **API Key认证** - 验证节点身份
2. **节点白名单** - 只允许授权的节点连接
3. **TLS/WSS加密** - 加密通信数据
4. **消息HMAC签名** - 防止消息篡改和重放攻击
5. **JWT Token认证** - 更安全的认证机制
6. **速率限制** - 防止滥用和DDoS攻击
7. **审计日志** - 记录所有安全事件
8. **连接数限制** - 限制每个节点的连接数

## 快速开始

### 1. 生成API Key

```bash
# Linux/Mac
openssl rand -hex 32

# Windows PowerShell
$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
[BitConverter]::ToString($bytes) -replace '-','' | Set-Clipboard
```

### 2. 配置Master服务器

编辑 `master-server/.env`：

```bash
# API Key（必需）
MASTER_API_KEY=your-generated-api-key-here

# 节点白名单（可选，留空允许所有节点）
MASTER_ALLOWED_NODE_IDS=node-001,node-002,node-003

# 强制TLS（生产环境推荐）
MASTER_REQUIRE_TLS=true

# 启用消息签名（可选，额外安全层）
MASTER_ENABLE_MESSAGE_SIGNING=false

# 连接数限制
MASTER_MAX_CONNECTIONS_PER_NODE=1

# 速率限制
MASTER_RATE_LIMIT_MESSAGES=1000
MASTER_RATE_LIMIT_PROXY_REQUESTS=500
```

### 3. 配置Node服务器

编辑 `node-sdk/.env`：

```bash
# 节点名称（必须在白名单中）
NODE_NAME=node-001

# API Key（必须与Master相同）
MASTER_API_KEY=your-generated-api-key-here

# Master地址（使用wss://如果启用了TLS）
MASTER_URL=https://your-master-server.com:3000
MASTER_WS_URL=wss://your-master-server.com:3000/ws
```

## 详细配置

### API Key认证

API Key是基本的认证机制，所有节点必须提供正确的API Key才能连接。

**配置：**

```bash
# Master端
MASTER_API_KEY=your-secure-api-key

# Node端
MASTER_API_KEY=your-secure-api-key
```

**安全建议：**
- 使用至少32字符的随机字符串
- 定期更换API Key
- 不要在代码中硬编码API Key
- 使用环境变量或密钥管理服务

### 节点白名单

限制只有授权的节点ID才能连接。

**配置：**

```bash
# 允许的节点ID列表（逗号分隔）
MASTER_ALLOWED_NODE_IDS=node-001,node-002,node-003

# 留空表示允许所有节点（不推荐）
MASTER_ALLOWED_NODE_IDS=
```

**使用场景：**
- 生产环境：强烈推荐配置白名单
- 测试环境：可以留空方便测试
- 动态节点：需要时通过API动态添加

### TLS/WSS加密

强制使用加密连接保护数据传输。

**配置：**

```bash
# Master端
MASTER_REQUIRE_TLS=true

# Node端会自动检测，使用wss://连接
MASTER_WS_URL=wss://your-server.com:3000/ws
```

**证书配置：**

1. 使用Let's Encrypt（推荐）：

```bash
# 安装certbot
sudo apt-get install certbot

# 获取证书
sudo certbot certonly --standalone -d your-domain.com
```

2. Master服务器配置（需要修改代码支持HTTPS）：

```typescript
// 在index.ts中
import { readFileSync } from 'fs';
import { createServer as createHttpsServer } from 'https';

const httpsServer = createHttpsServer({
  key: readFileSync('/etc/letsencrypt/live/your-domain.com/privkey.pem'),
  cert: readFileSync('/etc/letsencrypt/live/your-domain.com/fullchain.pem'),
}, app);
```

### 消息HMAC签名

为消息添加签名防止篡改和重放攻击。

**配置：**

```bash
# 启用消息签名
MASTER_ENABLE_MESSAGE_SIGNING=true

# 需要同时配置API Key
MASTER_API_KEY=your-api-key
```

**工作原理：**
- 每条消息添加HMAC-SHA256签名
- 包含时间戳和nonce防止重放
- 5分钟时间窗口验证
- 自动清理已处理的nonce

**性能影响：**
- 轻微的CPU开销（<1ms/消息）
- 消息大小增加约100字节
- 建议在高安全要求场景启用

### JWT Token认证

更安全和灵活的认证机制，支持权限管理和Token刷新。

**使用流程：**

1. Node申请Token：

```bash
curl -X POST http://master:3000/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{
    "nodeId": "node-001",
    "apiKey": "your-api-key"
  }'
```

响应：

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 3600
}
```

2. 使用Token连接（未来版本支持）：

```javascript
const ws = new WebSocket('wss://master:3000/ws', {
  headers: {
    'Authorization': 'Bearer ' + token
  }
});
```

3. 刷新Token（有效期前5分钟）：

```bash
curl -X POST http://master:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"token": "old-token"}'
```

**优势：**
- 无状态认证
- 支持权限控制
- 自动过期
- 可刷新

### 速率限制

防止滥用和DDoS攻击。

**配置：**

```bash
# 每分钟最大消息数
MASTER_RATE_LIMIT_MESSAGES=1000

# 每分钟最大代理请求数
MASTER_RATE_LIMIT_PROXY_REQUESTS=500
```

**工作机制：**
- 滑动窗口算法（1分钟窗口）
- 每个节点独立计数
- 超限后拒绝请求并记录日志
- 自动清理过期数据

**调优建议：**
- 根据实际流量调整限制
- 监控速率限制日志
- 为高流量节点增加限制

### 连接数限制

限制每个节点的并发连接数。

**配置：**

```bash
# 每个节点最多1个连接（默认）
MASTER_MAX_CONNECTIONS_PER_NODE=1

# 允许多个连接（适用于负载均衡）
MASTER_MAX_CONNECTIONS_PER_NODE=5
```

**使用场景：**
- 单连接：大多数场景
- 多连接：需要负载均衡或故障转移

### 审计日志

记录所有安全相关事件。

**日志位置：**

```
master-server/logs/security-audit.log
```

**日志格式：**

```
时间戳 | 级别 | 事件类型 | NodeID=xxx | IP=xxx | 详细信息
```

**事件类型：**
- `AUTH_SUCCESS` - 认证成功
- `AUTH_FAILURE` - 认证失败
- `NODE_REGISTERED` - 节点注册
- `NODE_REJECTED` - 节点被拒绝
- `NODE_DISCONNECTED` - 节点断开
- `COMMAND_EXECUTED` - 命令执行
- `RATE_LIMIT_EXCEEDED` - 速率超限
- `SUSPICIOUS_ACTIVITY` - 可疑活动
- `TLS_VIOLATION` - TLS违规

**日志管理：**

```bash
# 查看最近的认证失败
grep "AUTH_FAILURE" master-server/logs/security-audit.log

# 查看某个节点的活动
grep "NodeID=node-001" master-server/logs/security-audit.log

# 查看可疑活动
grep "SUSPICIOUS_ACTIVITY\|CRITICAL" master-server/logs/security-audit.log
```

**日志轮转（推荐）：**

```bash
# 使用logrotate
sudo nano /etc/logrotate.d/proxynode

# 配置内容：
/path/to/master-server/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
}
```

## 安全最佳实践

### 生产环境检查清单

部署到生产环境前，确保：

- [ ] 使用强API Key（32+字符随机字符串）
- [ ] 配置节点白名单
- [ ] 启用TLS/WSS加密
- [ ] 配置有效的TLS证书
- [ ] 启用审计日志
- [ ] 设置日志轮转
- [ ] 配置合理的速率限制
- [ ] 定期审查审计日志
- [ ] 设置监控和告警
- [ ] 定期更新依赖包
- [ ] 限制Master服务器的网络访问
- [ ] 使用防火墙规则

### 密钥管理

**不要：**
- ❌ 在代码中硬编码API Key
- ❌ 提交API Key到Git仓库
- ❌ 使用弱密码或简单字符串
- ❌ 多个环境共用同一API Key

**推荐：**
- ✅ 使用环境变量
- ✅ 使用密钥管理服务（AWS Secrets Manager, Azure Key Vault）
- ✅ 定期轮换API Key
- ✅ 每个环境使用不同的Key
- ✅ 使用加密存储

### 网络安全

**防火墙规则：**

```bash
# 只允许已知IP访问Master服务器
sudo ufw allow from 192.168.1.0/24 to any port 3000
sudo ufw allow from 10.0.0.0/8 to any port 3000

# 拒绝其他所有访问
sudo ufw default deny incoming
sudo ufw enable
```

**反向代理（推荐）：**

使用Nginx作为反向代理，提供额外的安全层：

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # WebSocket支持
    location /ws {
        proxy_pass http://localhost:3000/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # 额外安全头
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 速率限制
        limit_req zone=websocket burst=10 nodelay;
    }

    # API端点
    location /api {
        proxy_pass http://localhost:3000/api;
        
        # 速率限制
        limit_req zone=api burst=20 nodelay;
    }
}

# 速率限制配置
limit_req_zone $binary_remote_addr zone=websocket:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=api:10m rate=50r/s;
```

### 监控和告警

**监控指标：**
- 认证失败率
- 速率限制触发次数
- 可疑活动数量
- 节点连接/断开频率
- 代理请求错误率

**告警配置示例（使用prometheus-alertmanager）：**

```yaml
groups:
- name: proxynode_security
  rules:
  - alert: HighAuthFailureRate
    expr: rate(auth_failures[5m]) > 10
    annotations:
      summary: "认证失败率过高"
      
  - alert: SuspiciousActivity
    expr: suspicious_activity_count > 0
    annotations:
      summary: "检测到可疑活动"
```

## 故障排查

### 常见问题

#### 1. 节点无法连接

**症状：** Node报告连接失败

**检查：**
```bash
# 查看审计日志
tail -f master-server/logs/security-audit.log

# 检查API Key
echo $MASTER_API_KEY

# 测试WebSocket连接
wscat -c ws://master:3000/ws -H "X-API-Key: your-api-key"
```

**可能原因：**
- API Key不匹配
- 节点不在白名单中
- 网络防火墙阻止
- TLS证书问题

#### 2. 速率限制过于频繁

**症状：** 大量速率限制错误

**解决：**
```bash
# 增加限制值
MASTER_RATE_LIMIT_MESSAGES=2000
MASTER_RATE_LIMIT_PROXY_REQUESTS=1000

# 或者检查是否有异常流量
grep "RATE_LIMIT" logs/security-audit.log | wc -l
```

#### 3. 消息签名验证失败

**症状：** 消息被拒绝，签名无效

**检查：**
- Master和Node的API Key是否相同
- 系统时间是否同步（NTP）
- 是否有网络延迟导致时间窗口超限

## 升级和迁移

### 从v1.x升级到v2.1

1. 备份当前配置
2. 更新代码到v2.1
3. 添加安全配置到`.env`
4. 重启服务
5. 验证所有节点正常连接
6. 监控审计日志

### 启用新安全功能

可以逐步启用安全功能，避免中断服务：

1. **阶段1**：启用API Key和审计日志
2. **阶段2**：配置节点白名单和速率限制
3. **阶段3**：启用TLS加密
4. **阶段4**：启用消息签名（可选）

## 支持和反馈

如有安全问题或建议，请通过以下方式联系：

- GitHub Issues
- 安全漏洞：security@your-domain.com
- 文档：docs/SECURITY_TESTING.md

## 更新日志

- v2.1.0 (2025-12-29) - 初始安全功能发布
  - API Key认证
  - 节点白名单
  - TLS支持
  - 消息签名
  - JWT认证
  - 速率限制
  - 审计日志
