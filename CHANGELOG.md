# 更新日志 - ProxyNode

所有重要的项目变更都会记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
并遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [2.0.0] - 2025-12-29

### 🎉 重大更新：WebSocket 隧道架构

这是一个**革命性的架构升级**，彻底解决了 NAT 穿透问题！

### 项目结构重组 🗂️

**目录整理：**
- ✅ 创建 `docs/` 目录，集中管理所有文档（13 个文件）
- ✅ 创建 `scripts/` 目录，集中管理所有脚本（13 个文件）
- ✅ 根目录文件减少 53%，从 30+ 个精简到 14 个
- ✅ 提供文档和脚本索引（`docs/README.md`、`scripts/README.md`）

**新增文档：**
- 📖 `docs/PROJECT_STRUCTURE.md` - 项目结构详细说明
- 📖 `docs/REORGANIZATION_SUMMARY.md` - 重组总结
- 📖 `docs/README.md` - 文档索引和导航
- 📖 `scripts/README.md` - 脚本使用说明

**更新文档：**
- 📝 更新 `README.md` 的项目结构和文档导航
- 📝 所有文档链接指向新位置

### 新增
- 🚇 **WebSocket 隧道模式** - 所有代理流量通过 WebSocket 隧道转发
- ✅ **无需公网 IP** - Node 可以部署在任何网络环境
- ✅ **NAT 穿透** - 自动穿透多层 NAT/路由器
- ✅ **家庭宽带支持** - 完美支持家庭、公司内网部署
- 🔄 **反向连接** - Node 主动连接 Master，建立长连接
- 📨 **代理消息协议** - 定义了完整的 WebSocket 代理消息类型
- 📊 **事件驱动** - 基于事件的双向数据流转发

### 架构变更
- **Master Server:**
  - 🔧 `MasterWebSocketServer` 扩展支持代理消息转发
  - 🔧 `HttpProxyServer` 改为通过 WebSocket 隧道转发请求
  - 🔧 `Socks5ProxyServer` 改为通过 WebSocket 隧道转发请求
  - ➕ 新增 `PendingProxyRequest` 管理待处理的代理请求
  - ➕ 继承 `EventEmitter` 实现事件驱动

- **Node Server:**
  - 🔧 `WebSocketClient` 扩展支持处理代理请求
  - ➕ 新增 HTTP/HTTPS/SOCKS5 代理请求处理逻辑
  - ➕ 新增 `ActiveProxyConnection` 管理活动连接
  - ➕ 自动清理断开连接时的代理会话

### 消息类型
- ➕ `ProxyRequestMessage` - 代理请求（Master → Node）
- ➕ `ProxyResponseMessage` - 代理响应（Node → Master）
- ➕ `ProxyDataMessage` - 数据流（双向）
- ➕ `ProxyCloseMessage` - 连接关闭（双向）
- ➕ `ProxyErrorMessage` - 错误消息（双向）

### 文档
- 📖 新增 [WebSocket 隧道架构指南](WEBSOCKET_TUNNEL_GUIDE.md)
- 📖 新增 [反向连接架构设计](REVERSE_PROXY_ARCHITECTURE.md)
- 📖 新增 [快速测试指南](QUICK_TEST.md)
- 📝 更新 [README.md](README.md) 反映新架构
- 📝 更新架构图和功能特性说明

### 破坏性变更
⚠️ **构造函数签名变更：**
- `HttpProxyServer(nodeManager, wsServer)` - 新增 `wsServer` 参数
- `Socks5ProxyServer(nodeManager, wsServer)` - 新增 `wsServer` 参数

**迁移指南：**
```typescript
// 旧代码
const httpProxy = new HttpProxyServer(nodeManager);
const socks5Proxy = new Socks5ProxyServer(nodeManager);

// 新代码
const wsServer = new MasterWebSocketServer(httpServer, nodeManager);
const httpProxy = new HttpProxyServer(nodeManager, wsServer);
const socks5Proxy = new Socks5ProxyServer(nodeManager, wsServer);
```

### 性能
- ⚡ WebSocket 长连接，减少握手开销
- 📦 Base64 编码，高效传输
- ⏱️ 预期延迟增加 5-20ms（相比直连）
- 🎯 适合大多数应用场景

### 兼容性
- ✅ 完全向后兼容配置文件
- ✅ 现有 `.env` 配置无需修改
- ✅ API 接口保持不变
- ✅ 监控面板无需更新

### 测试
- ✅ TypeScript 编译无错误
- ✅ 构建成功（Master + Node）
- ⏳ 集成测试待完成
- ⏳ 性能测试待完成

---

## [1.0.0] - 2025-12-26

### 新增
- ✨ 初始版本发布
- 🌐 支持 HTTP/HTTPS 和 SOCKS5 代理
- ⚖️ 多种负载均衡策略（轮询、最少连接、区域优先）
- 📊 实时监控 Web 面板
- 🔄 节点自动注册和心跳机制
- 💬 WebSocket 实时通信
- 🌍 自动获取节点公网 IP
- 📈 CPU、内存、带宽监控
- 🔍 详细的请求日志
- 📱 响应式监控面板设计

### 主服务器功能
- REST API 节点管理
- 智能节点选择算法
- 节点健康检查
- WebSocket 控制服务
- HTTP/SOCKS5 代理路由

### 节点服务器功能
- HTTP/HTTPS 代理服务
- SOCKS5 代理服务
- 状态监控和上报
- WebSocket 客户端
- 自动重连机制

### 文档
- 📖 完整的 README
- 🧪 详细测试指南
- 💡 使用示例代码
- 🔧 配置说明文档

## 未来计划

### [1.1.0] - 计划中
- [ ] 用户认证和授权
- [ ] 代理流量统计
- [ ] 节点性能评分
- [ ] 黑白名单功能
- [ ] 更多节点选择策略

### [1.2.0] - 计划中
- [ ] 支持更多代理协议
- [ ] 代理链功能
- [ ] API 限流
- [ ] 数据持久化
- [ ] 集群模式

### [2.0.0] - 长期计划
- [ ] 完整的管理后台
- [ ] 用户管理系统
- [ ] 计费和配额管理
- [ ] 多租户支持
- [ ] 高级分析和报表

---

[1.0.0]: https://github.com/larrygogo/proxynode/releases/tag/v1.0.0

