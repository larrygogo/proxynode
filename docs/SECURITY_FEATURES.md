# ProxyNode 安全功能 🔒

ProxyNode v2.1引入了全面的安全功能，保护主服务器和节点之间的通信安全。

## 🚀 快速开始

### 1. 生成API Key

```bash
# Linux/Mac
openssl rand -hex 32

# Windows PowerShell
$bytes = New-Object byte[] 32; [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes); [BitConverter]::ToString($bytes) -replace '-',''
```

### 2. 配置Master服务器

在 `master-server/.env` 中添加：

```bash
MASTER_API_KEY=your-generated-api-key
MASTER_ALLOWED_NODE_IDS=node-001,node-002
MASTER_REQUIRE_TLS=true
```

### 3. 配置Node服务器

在 `node-sdk/.env` 中添加：

```bash
NODE_NAME=node-001
MASTER_API_KEY=your-generated-api-key
MASTER_WS_URL=wss://your-master-server.com:3000/ws
```

## 📋 安全功能列表

### ✅ 1. API Key认证
验证每个连接的节点身份，防止未授权访问。

**优势：**
- 简单易用
- 零配置开销
- 快速验证

**配置：**
```bash
MASTER_API_KEY=your-secure-key
```

### ✅ 2. 节点白名单
只允许授权的节点ID连接，防止恶意节点注册。

**优势：**
- 精确控制
- 防止节点伪造
- 审计追踪

**配置：**
```bash
MASTER_ALLOWED_NODE_IDS=node-001,node-002,node-003
```

### ✅ 3. TLS/WSS加密
强制使用加密连接，防止中间人攻击和数据窃听。

**优势：**
- 端到端加密
- 防止嗅探
- 行业标准

**配置：**
```bash
MASTER_REQUIRE_TLS=true
MASTER_WS_URL=wss://your-server.com:3000/ws
```

### ✅ 4. 速率限制
防止DDoS攻击和资源滥用。

**优势：**
- 防止滥用
- 保护资源
- 公平使用

**配置：**
```bash
MASTER_RATE_LIMIT_MESSAGES=1000
MASTER_RATE_LIMIT_PROXY_REQUESTS=500
```

### ✅ 5. 审计日志
记录所有安全事件，便于追踪和分析。

**记录内容：**
- 认证尝试
- 节点注册/拒绝
- 命令执行
- 速率限制触发
- 可疑活动

**日志位置：**
```
master-server/logs/security-audit.log
```

### ✅ 6. 消息HMAC签名
防止消息篡改和重放攻击（可选功能）。

**优势：**
- 消息完整性
- 防重放攻击
- 时间窗口验证

**配置：**
```bash
MASTER_ENABLE_MESSAGE_SIGNING=true
```

### ✅ 7. JWT Token认证
支持权限管理的高级认证机制。

**优势：**
- 细粒度权限
- 自动过期
- 可刷新

**API端点：**
```bash
POST /api/auth/token    # 申请Token
POST /api/auth/refresh  # 刷新Token
POST /api/auth/verify   # 验证Token
```

### ✅ 8. 连接数限制
限制每个节点的并发连接数。

**配置：**
```bash
MASTER_MAX_CONNECTIONS_PER_NODE=1
```

## 📊 安全级别对比

| 级别 | 配置 | 安全性 | 适用场景 |
|------|------|--------|----------|
| 基础 | API Key | ⭐⭐ | 开发测试 |
| 标准 | API Key + 白名单 | ⭐⭐⭐ | 小型部署 |
| 推荐 | API Key + 白名单 + TLS | ⭐⭐⭐⭐ | 生产环境 |
| 高级 | 全部功能 + 消息签名 | ⭐⭐⭐⭐⭐ | 金融/安全敏感 |

## 🎯 最佳实践

### 生产环境配置示例

```bash
# 强API Key
MASTER_API_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6

# 白名单
MASTER_ALLOWED_NODE_IDS=prod-node-001,prod-node-002

# 强制TLS
MASTER_REQUIRE_TLS=true

# 严格速率限制
MASTER_RATE_LIMIT_MESSAGES=500
MASTER_RATE_LIMIT_PROXY_REQUESTS=200

# 单连接
MASTER_MAX_CONNECTIONS_PER_NODE=1
```

### 开发环境配置示例

```bash
# 简单API Key
MASTER_API_KEY=dev-test-key

# 不限制节点
MASTER_ALLOWED_NODE_IDS=

# 不强制TLS（本地开发）
MASTER_REQUIRE_TLS=false

# 宽松速率限制
MASTER_RATE_LIMIT_MESSAGES=10000
MASTER_RATE_LIMIT_PROXY_REQUESTS=5000
```

## 📈 性能影响

| 功能 | 延迟增加 | 资源消耗 |
|------|----------|----------|
| API Key认证 | <1ms | 极低 |
| 白名单验证 | <1ms | 极低 |
| TLS加密 | 5-10ms | 低 |
| 速率限制 | <1ms | 低 |
| 审计日志 | <1ms | 低 |
| 消息签名 | 1-3ms | 中 |
| JWT认证 | 2-5ms | 低 |

**总计：** 约10-20ms额外延迟（完全可接受）

## 🧪 测试验证

运行安全测试：

```bash
# 查看测试指南
cat docs/SECURITY_TESTING.md

# 运行基础测试
./scripts/security-test-suite.sh
```

## 📚 文档

详细文档：

- **[安全配置指南](SECURITY_GUIDE.md)** - 完整配置说明
- **[安全测试指南](SECURITY_TESTING.md)** - 测试用例和方法
- **[实施总结](SECURITY_IMPLEMENTATION.md)** - 技术实现细节
- **[安全政策](../SECURITY.md)** - 漏洞报告流程

## 🔍 故障排查

### 节点无法连接

```bash
# 1. 检查API Key
echo $MASTER_API_KEY

# 2. 查看审计日志
tail -f master-server/logs/security-audit.log

# 3. 测试连接
wscat -c ws://localhost:3000/ws -H "X-API-Key: your-key"
```

### 速率限制过于频繁

```bash
# 增加限制值
MASTER_RATE_LIMIT_MESSAGES=2000
MASTER_RATE_LIMIT_PROXY_REQUESTS=1000
```

### 消息签名失败

```bash
# 确保Master和Node使用相同的API Key
# 检查系统时间是否同步
timedatectl status
```

## 🚨 安全警告

### 生产环境必须做的事：

- ✅ 使用强API Key（32+字符）
- ✅ 配置节点白名单
- ✅ 启用TLS/WSS
- ✅ 定期审查审计日志
- ✅ 设置防火墙规则

### 绝对不要做的事：

- ❌ 在代码中硬编码API Key
- ❌ 提交密钥到Git仓库
- ❌ 使用弱密码或简单字符串
- ❌ 在生产环境禁用TLS
- ❌ 忽略审计日志警告

## 📞 支持

遇到问题？

- **文档：** 查看 [docs/](.)
- **Issue：** [GitHub Issues](https://github.com/larrygogo/proxynode/issues)
- **安全漏洞：** 参阅 [SECURITY.md](../SECURITY.md)

## 🔄 更新日志

### v2.1.0 (2025-12-29)

- ✨ 新增API Key认证
- ✨ 新增节点白名单
- ✨ 新增TLS/WSS强制加密
- ✨ 新增速率限制
- ✨ 新增审计日志
- ✨ 新增消息HMAC签名
- ✨ 新增JWT Token认证
- ✨ 新增连接数限制

## 📄 许可证

MIT License - 详见 [LICENSE](../LICENSE)

---

**安全是持续的过程，不是一次性的任务。** 🔒

定期审查配置、监控日志、更新依赖，保持系统安全。
