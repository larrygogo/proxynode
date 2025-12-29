# 安全测试指南

本文档提供了完整的安全测试用例，用于验证主服务器和Node之间通信的安全措施。

## 测试环境准备

### 1. 配置测试环境

创建测试环境的`.env`文件：

```bash
# Master Server配置
MASTER_API_KEY=test-secure-api-key-12345678
MASTER_ALLOWED_NODE_IDS=test-node-001,test-node-002
MASTER_REQUIRE_TLS=false  # 本地测试可以设为false
MASTER_ENABLE_MESSAGE_SIGNING=true
MASTER_MAX_CONNECTIONS_PER_NODE=1
MASTER_RATE_LIMIT_MESSAGES=100
MASTER_RATE_LIMIT_PROXY_REQUESTS=50

# Node配置
NODE_NAME=test-node-001
MASTER_API_KEY=test-secure-api-key-12345678
```

### 2. 启动服务

```bash
# 启动Master服务器
cd master-server
npm start

# 启动Node服务器
cd node-sdk
npm start
```

## 安全测试用例

### 测试1: API Key认证

#### 1.1 无API Key连接（应失败）

```bash
# 使用wscat工具测试
wscat -c ws://localhost:3000/ws

# 预期结果：连接被拒绝，返回401错误
```

#### 1.2 错误的API Key（应失败）

```bash
wscat -c ws://localhost:3000/ws -H "X-API-Key: wrong-api-key"

# 预期结果：连接被拒绝，返回401错误
```

#### 1.3 正确的API Key（应成功）

```bash
wscat -c ws://localhost:3000/ws -H "X-API-Key: test-secure-api-key-12345678"

# 预期结果：连接成功
```

**验证方法：**
- 检查审计日志：`master-server/logs/security-audit.log`
- 应该看到认证失败的记录

### 测试2: Node白名单验证

#### 2.1 未授权的NodeId注册（应失败）

连接成功后，发送：

```json
{
  "type": "node_id",
  "nodeId": "unauthorized-node-999"
}
```

**预期结果：**
- 收到错误消息：`节点ID未授权`
- 连接被关闭

#### 2.2 授权的NodeId注册（应成功）

```json
{
  "type": "node_id",
  "nodeId": "test-node-001"
}
```

**预期结果：**
- 收到确认消息：`节点注册成功`
- 连接保持

**验证方法：**
```bash
# 查看审计日志
tail -f master-server/logs/security-audit.log | grep NODE_REJECTED
```

### 测试3: TLS强制检查

#### 3.1 配置TLS强制

修改`.env`：

```bash
MASTER_REQUIRE_TLS=true
```

#### 3.2 尝试使用ws://连接（应失败）

```bash
wscat -c ws://localhost:3000/ws -H "X-API-Key: test-secure-api-key-12345678"

# 预期结果：连接被拒绝，返回403错误，提示必须使用wss://
```

#### 3.3 使用wss://连接（需要配置证书）

**注意：** 需要先配置TLS证书才能测试wss://连接。

**验证方法：**
```bash
# 查看审计日志
grep "TLS_VIOLATION" master-server/logs/security-audit.log
```

### 测试4: 速率限制

#### 4.1 消息速率限制测试

编写测试脚本 `test-rate-limit.js`：

```javascript
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:3000/ws', {
  headers: {
    'X-API-Key': 'test-secure-api-key-12345678'
  }
});

ws.on('open', () => {
  // 注册节点
  ws.send(JSON.stringify({
    type: 'node_id',
    nodeId: 'test-node-001'
  }));

  // 短时间内发送大量消息
  let count = 0;
  const interval = setInterval(() => {
    if (count < 150) { // 超过限制100条/分钟
      ws.send(JSON.stringify({
        type: 'event',
        event: 'status_changed',
        data: { test: count }
      }));
      count++;
    } else {
      clearInterval(interval);
    }
  }, 100); // 每100ms发送一条
});

ws.on('message', (data) => {
  const message = JSON.parse(data.toString());
  console.log('收到消息:', message);
  
  if (message.type === 'error' && message.message.includes('速率超限')) {
    console.log('✓ 速率限制测试通过：收到速率限制错误');
  }
});
```

运行测试：

```bash
node test-rate-limit.js
```

**预期结果：**
- 前100条消息正常处理
- 第101条开始收到速率限制错误

**验证方法：**
```bash
grep "RATE_LIMIT_EXCEEDED" master-server/logs/security-audit.log
```

#### 4.2 代理请求速率限制

测试脚本会在实际使用中自动触发。

### 测试5: 消息签名验证

#### 5.1 启用消息签名

修改`.env`：

```bash
MASTER_ENABLE_MESSAGE_SIGNING=true
```

#### 5.2 发送未签名消息（应失败）

重启服务后，发送普通消息：

```json
{
  "type": "event",
  "event": "status_changed",
  "data": { status: "online" }
}
```

**预期结果：**
- 收到签名验证失败错误
- 消息被拒绝

**注意：** Node端也需要实现消息签名才能正常工作。

### 测试6: JWT认证

#### 6.1 申请JWT Token

```bash
curl -X POST http://localhost:3000/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{
    "nodeId": "test-node-001",
    "apiKey": "test-secure-api-key-12345678"
  }'
```

**预期结果：**

```json
{
  "success": true,
  "token": "eyJhbGc...",
  "expiresIn": 3600
}
```

#### 6.2 验证Token

```bash
curl -X POST http://localhost:3000/api/auth/verify \
  -H "Content-Type: application/json" \
  -d '{
    "token": "eyJhbGc..."
  }'
```

**预期结果：**

```json
{
  "success": true,
  "payload": {
    "nodeId": "test-node-001",
    "permissions": ["proxy", "status"],
    "iat": 1234567890,
    "exp": 1234571490
  },
  "needsRefresh": false
}
```

#### 6.3 刷新Token

```bash
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "token": "eyJhbGc..."
  }'
```

#### 6.4 使用过期Token（应失败）

等待1小时后，使用旧Token验证：

```bash
# 应该收到"Token已过期"错误
```

### 测试7: 连接数限制

#### 7.1 同一NodeId多次连接

配置：

```bash
MASTER_MAX_CONNECTIONS_PER_NODE=1
```

打开两个WebSocket连接，使用相同的nodeId注册：

**预期结果：**
- 第一个连接成功
- 第二个连接被拒绝，提示"连接数超限"

### 测试8: 审计日志验证

#### 8.1 检查审计日志完整性

```bash
cat master-server/logs/security-audit.log
```

应该包含：
- ✓ 认证成功/失败记录
- ✓ 节点注册/拒绝记录
- ✓ 节点断开连接记录
- ✓ 命令执行记录
- ✓ 速率限制超限记录
- ✓ 可疑活动记录

#### 8.2 日志格式验证

每条日志应包含：
- 时间戳（ISO 8601格式）
- 严重级别（INFO/WARNING/ERROR/CRITICAL）
- 事件类型
- NodeID（如果适用）
- IP地址（如果适用）
- 详细信息

示例：

```
2025-12-29T10:30:45.123Z | WARNING | AUTH_FAILURE | IP=192.168.1.100 | 认证失败: API Key无效或缺失
2025-12-29T10:31:22.456Z | INFO | AUTH_SUCCESS | NodeID=test-node-001 | IP=192.168.1.100 | 节点认证成功
```

### 测试9: 重放攻击防护（消息签名）

如果启用了消息签名，测试重放攻击防护：

1. 捕获一条已签名的消息
2. 尝试重新发送同一条消息

**预期结果：**
- 第一次发送成功
- 第二次发送失败，提示"检测到重放攻击：nonce已使用"

### 测试10: 时间窗口验证

修改系统时间，发送消息：

**预期结果：**
- 如果时间差超过5分钟，消息被拒绝
- 提示"消息时间戳超出有效窗口"

## 自动化测试脚本

创建 `security-test-suite.sh`：

```bash
#!/bin/bash

echo "=== 安全测试套件 ==="

# 测试1: API Key认证
echo "\n[测试1] API Key认证..."
wscat -c ws://localhost:3000/ws --close | grep -q "401" && echo "✓ 无API Key连接被拒绝" || echo "✗ 测试失败"

# 测试2: 审计日志
echo "\n[测试2] 审计日志..."
[ -f master-server/logs/security-audit.log ] && echo "✓ 审计日志文件存在" || echo "✗ 审计日志文件不存在"

# 测试3: JWT API
echo "\n[测试3] JWT认证API..."
curl -s -X POST http://localhost:3000/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{"nodeId":"test-node-001","apiKey":"test-secure-api-key-12345678"}' \
  | grep -q "token" && echo "✓ JWT Token生成成功" || echo "✗ JWT Token生成失败"

echo "\n=== 测试完成 ==="
```

运行：

```bash
chmod +x security-test-suite.sh
./security-test-suite.sh
```

## 性能测试

### 测试签名性能影响

```javascript
// benchmark-signing.js
const { MessageSigner } = require('./master-server/dist/security/message-signer');

const signer = new MessageSigner('test-api-key');
const message = {
  type: 'proxy_request',
  requestId: 'test-123',
  protocol: 'http',
  url: 'http://example.com',
};

console.time('签名1000条消息');
for (let i = 0; i < 1000; i++) {
  const signed = signer.signMessage(message);
  signer.verifyMessage(signed);
}
console.timeEnd('签名1000条消息');
```

**预期性能：**
- 签名+验证应在 < 500ms 内完成1000条消息

## 故障排查

### 常见问题

1. **连接被拒绝但应该成功**
   - 检查API Key是否正确
   - 检查nodeId是否在白名单中
   - 查看审计日志了解拒绝原因

2. **速率限制过于严格**
   - 调整环境变量中的限制值
   - 检查是否有多个连接共用同一nodeId

3. **消息签名验证失败**
   - 确保Master和Node使用相同的API Key
   - 检查系统时间是否同步
   - 验证消息格式是否正确

## 安全审计清单

在生产环境部署前，确保：

- [ ] 设置了强API Key（至少32字符随机字符串）
- [ ] 配置了Node白名单
- [ ] 启用了TLS/WSS加密连接
- [ ] 配置了合理的速率限制
- [ ] 启用了审计日志
- [ ] 定期审查审计日志
- [ ] 配置了JWT认证（推荐）
- [ ] 测试了所有安全功能
- [ ] 设置了日志轮转和归档
- [ ] 配置了异常告警

## 参考文档

- [安全改进计划](通信安全问题分析_86c128d9.plan.md)
- [WebSocket安全最佳实践](https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html)
- [JWT安全指南](https://tools.ietf.org/html/rfc8725)
