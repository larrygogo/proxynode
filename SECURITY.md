# 安全政策

## 支持的版本

当前支持以下版本的安全更新：

| 版本 | 支持状态 |
| --- | --- |
| 2.1.x | ✅ 支持 |
| 2.0.x | ✅ 支持 |
| < 2.0 | ❌ 不支持 |

## 安全功能

ProxyNode v2.1提供以下安全功能：

### 认证和授权
- **API Key认证** - 验证节点身份
- **JWT Token认证** - 支持权限管理的高级认证
- **节点白名单** - 限制允许连接的节点

### 通信安全
- **TLS/WSS加密** - 加密所有通信数据
- **消息HMAC签名** - 防止消息篡改
- **防重放攻击** - 时间窗口和nonce验证

### 访问控制
- **速率限制** - 防止滥用和DDoS攻击
- **连接数限制** - 限制每个节点的并发连接
- **权限管理** - 细粒度的操作权限控制

### 审计和监控
- **安全审计日志** - 记录所有安全事件
- **异常检测** - 识别可疑活动
- **实时监控** - 跟踪安全指标

详细配置请参阅 [安全配置指南](docs/SECURITY_GUIDE.md)

## 报告安全漏洞

我们非常重视安全问题。如果您发现了安全漏洞，请通过以下方式报告：

### 报告流程

1. **不要**公开披露漏洞
2. 发送邮件至：security@your-domain.com（如果有）或创建私有GitHub Security Advisory
3. 包含以下信息：
   - 漏洞描述
   - 重现步骤
   - 潜在影响
   - 建议的修复方案（如果有）

### 响应时间

- 初步确认：24小时内
- 详细分析：3个工作日内
- 补丁发布：根据严重程度，通常7-14天内

### 漏洞等级

我们使用CVSS 3.1标准评估漏洞严重程度：

- **严重** (9.0-10.0) - 立即修复，24-48小时内发布补丁
- **高危** (7.0-8.9) - 7天内修复
- **中危** (4.0-6.9) - 14天内修复
- **低危** (0.1-3.9) - 30天内修复

## 安全更新

安全更新将通过以下渠道发布：

1. GitHub Releases
2. CHANGELOG.md
3. 邮件通知（如果适用）

## 安全最佳实践

### 部署建议

1. **使用强API Key**
   ```bash
   # 生成32字节随机密钥
   openssl rand -hex 32
   ```

2. **启用TLS加密**
   ```bash
   MASTER_REQUIRE_TLS=true
   MASTER_WS_URL=wss://your-domain.com:3000/ws
   ```

3. **配置节点白名单**
   ```bash
   MASTER_ALLOWED_NODE_IDS=node-001,node-002
   ```

4. **设置速率限制**
   ```bash
   MASTER_RATE_LIMIT_MESSAGES=1000
   MASTER_RATE_LIMIT_PROXY_REQUESTS=500
   ```

5. **监控审计日志**
   ```bash
   tail -f master-server/logs/security-audit.log
   ```

### 网络安全

- 使用防火墙限制Master服务器访问
- 通过VPN或专用网络连接节点
- 使用反向代理（Nginx/Apache）提供额外保护
- 定期更新系统和依赖包

### 密钥管理

- 不要在代码中硬编码密钥
- 使用环境变量或密钥管理服务
- 定期轮换API Key
- 每个环境使用不同的密钥

详细指南请参阅 [安全配置指南](docs/SECURITY_GUIDE.md)

## 已知安全问题

### v2.0及更早版本

- ⚠️ **无API Key验证** - 任何人都可以连接到Master服务器
- ⚠️ **明文通信** - WebSocket使用ws://而非wss://
- ⚠️ **无速率限制** - 容易受到DDoS攻击

**建议：** 立即升级到v2.1或更高版本

### v2.1修复的问题

- ✅ 实现了API Key认证
- ✅ 支持TLS/WSS加密
- ✅ 添加了速率限制
- ✅ 实现了审计日志
- ✅ 添加了节点白名单
- ✅ 实现了消息签名验证
- ✅ 添加了JWT认证

## 安全审计

最近一次安全审计：2025-12-29

审计发现：
- ✅ 所有高危和严重漏洞已修复
- ✅ 实施了多层安全防护
- ✅ 审计日志完整且可追溯
- ⚠️ 建议启用消息签名增强安全性

## 合规性

ProxyNode遵循以下安全标准和最佳实践：

- OWASP WebSocket安全指南
- JWT最佳实践 (RFC 8725)
- Node.js安全最佳实践
- 安全开发生命周期(SDL)

## 依赖安全

我们定期扫描依赖包的安全漏洞：

```bash
# 检查依赖漏洞
npm audit

# 自动修复
npm audit fix
```

主要依赖及其安全性：

- `ws` - WebSocket库，定期更新
- `express` - Web框架，广泛使用且安全
- `dotenv` - 环境变量管理，无已知漏洞

## 联系方式

安全团队联系方式：

- GitHub: [@larrygogo/proxynode](https://github.com/larrygogo/proxynode)
- Email: security@your-domain.com（如适用）
- Security Advisory: [GitHub Security](https://github.com/larrygogo/proxynode/security/advisories)

## 致谢

感谢以下安全研究人员的贡献：

- （列表将在收到报告后更新）

## 许可

本安全政策遵循项目的MIT许可证。
