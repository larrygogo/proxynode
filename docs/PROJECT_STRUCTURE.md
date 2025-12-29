# ProxyNode 项目结构说明

**版本：** v2.0.0  
**更新时间：** 2025-12-29

---

## 📁 目录结构

```
proxynode/
├── 📂 master-server/       # 主服务器
├── 📂 node-sdk/           # 节点服务器 SDK
├── 📂 docs/               # 📚 项目文档
├── 📂 scripts/            # 🛠️ 测试脚本和工具
├── 📂 examples/           # 💡 使用示例
├── 📄 README.md           # 项目主文档
├── 📄 CHANGELOG.md        # 更新日志
├── 📄 CONTRIBUTING.md     # 贡献指南
├── 📄 LICENSE             # 开源协议
├── 📄 env.example         # 环境变量示例
└── ⚙️  配置文件...
```

---

## 📂 核心目录

### master-server/
主服务器源代码和配置

**主要内容：**
- `src/` - TypeScript 源代码
  - `api/` - REST API 路由
  - `proxy/` - HTTP/SOCKS5 代理服务（WebSocket 隧道模式）
  - `websocket/` - WebSocket 服务器
  - `manager/` - 节点管理器
  - `config/` - 配置管理
  - `types/` - TypeScript 类型定义
- `public/` - 监控面板静态文件
- `dist/` - 编译后的 JavaScript 代码
- `config.json` - 服务器配置文件
- `env.example` - 环境变量示例
- `package.json` - 依赖管理

**启动命令：**
```bash
cd master-server
npm start
```

---

### node-sdk/
节点服务器 SDK 源代码和配置

**主要内容：**
- `src/` - TypeScript 源代码
  - `proxy/` - HTTP/SOCKS5 代理实现
  - `server/` - 与 Master 通信（HTTP + WebSocket）
  - `monitor/` - 节点监控
  - `config/` - 配置管理
  - `types/` - TypeScript 类型定义
  - `utils/` - 工具函数
- `dist/` - 编译后的 JavaScript 代码
- `config.json` - 节点配置文件
- `env.example` - 环境变量示例
- `package.json` - 依赖管理

**启动命令：**
```bash
cd node-sdk
npm start
```

---

### docs/
项目文档集合

**文档分类：**

#### 🚀 快速开始
- `QUICK_TEST.md` - 快速测试指南（**推荐首读**）
- `IMPLEMENTATION_SUMMARY.md` - 实施总结和部署步骤

#### 🏗️ 架构设计
- `WEBSOCKET_TUNNEL_GUIDE.md` - WebSocket 隧道架构完整指南
- `REVERSE_PROXY_ARCHITECTURE.md` - 反向连接架构详细设计

#### 🔧 配置和部署
- `ENV_CONFIGURATION.md` - 环境变量配置详解
- `deploy-node-on-server.md` - 服务器部署完整指南
- `PACKAGE_MANAGER.md` - 包管理器使用指南

#### 🧪 测试
- `TESTING.md` - 测试指南
- `test-socks5.md` - SOCKS5 测试说明

#### 🐛 故障排除
- `TROUBLESHOOTING.md` - 故障排除指南
- `PNPM_ISSUES.md` - pnpm 兼容性问题

#### ⚙️ 高级功能
- `AUTO_RETRY.md` - 自动重试机制说明

**导航：**
- 查看 [README.md](README.md) 获取完整文档索引

---

### scripts/
测试脚本和工具集合

**脚本分类：**

#### 🧪 代理测试
- `test-proxy.ps1` / `.sh` - 基本代理测试
- `test-proxy-env.ps1` / `.sh` - 使用 `.env` 配置测试
- `test-remote-proxy.ps1` - 远程 Master 测试
- `test-socks5.ps1` - SOCKS5 专项测试

#### 🔍 诊断工具
- `check-master.ps1` / `.sh` - 检查 Master Server 状态
- `check-network.ps1` / `.sh` - 网络诊断工具
- `view-nodes.ps1` / `.sh` - 查看节点列表

**使用示例：**
```powershell
# Windows
.\scripts\test-proxy.ps1

# Linux/Mac
./scripts/test-proxy.sh
```

**导航：**
- 查看 [../scripts/README.md](../scripts/README.md) 获取详细使用说明

---

### examples/
使用示例代码

**包含内容：**
- `use-proxy.js` - JavaScript 使用示例
- `use-proxy.py` - Python 使用示例
- `test-socks5.js` - SOCKS5 测试示例
- `README.md` - 示例说明

**用途：**
- 学习如何在应用中使用代理
- 测试代理功能
- 快速原型开发

---

## 📄 根目录文件

### 主文档

#### README.md
**项目主文档** - 项目概述、快速开始、功能特性

**包含内容：**
- ✨ 功能特性
- 🏗️ 系统架构
- 🚀 快速开始
- 📖 使用指南
- 🌐 API 文档
- 📚 文档导航

#### CHANGELOG.md
**更新日志** - 记录所有版本变更

**格式：**
- 按版本号组织
- 包含：新增、修改、修复、破坏性变更
- 遵循 [Keep a Changelog](https://keepachangelog.com/)

**最新版本：** v2.0.0 - WebSocket 隧道架构

#### CONTRIBUTING.md
**贡献指南** - 如何为项目做贡献

**包含内容：**
- 代码规范
- 提交流程
- Pull Request 指南
- 开发环境设置

#### LICENSE
**开源协议** - MIT License

---

### 配置文件

#### env.example
**环境变量示例** - 所有可用环境变量的示例

**用途：**
1. 复制为 `.env`
2. 根据实际情况修改配置
3. 配置 Master URL、端口等

**位置：**
- 项目根目录：全局配置
- `master-server/env.example` - Master 配置
- `node-sdk/env.example` - Node 配置

#### pnpm-workspace.yaml
**pnpm workspace 配置** - 定义 monorepo 工作区

**内容：**
```yaml
packages:
  - 'master-server'
  - 'node-sdk'
```

#### .npmrc
**npm/pnpm 配置** - npm/pnpm 行为配置

#### package.json
**根项目配置** - 定义工作区和全局脚本

**主要脚本：**
- `npm run build` - 构建所有项目
- `npm run start:master` - 启动 Master
- `npm run start:node` - 启动 Node

#### tsconfig.json
**TypeScript 配置** - 全局 TypeScript 编译选项

---

## 🗂️ 文件组织原则

### ✅ 根目录保留

**核心文档：**
- README.md
- CHANGELOG.md
- CONTRIBUTING.md
- LICENSE

**配置文件：**
- env.example
- package.json
- pnpm-workspace.yaml
- tsconfig.json
- .npmrc
- .gitignore

### 📚 docs/ 目录

**目的：** 集中管理所有详细文档

**规则：**
- 所有 Markdown 文档（除核心文档外）
- 按功能分类
- 提供索引文件 `README.md`

### 🛠️ scripts/ 目录

**目的：** 集中管理所有脚本和工具

**规则：**
- 所有 `.ps1`（Windows）和 `.sh`（Linux/Mac）脚本
- 按功能分类
- 提供使用说明 `README.md`

### 💡 examples/ 目录

**目的：** 提供使用示例代码

**规则：**
- 各种语言的示例
- 包含说明文档
- 可直接运行

---

## 🔍 快速查找

### 我想...

#### 快速开始测试
👉 阅读 [../README.md](../README.md) → [QUICK_TEST.md](QUICK_TEST.md)

#### 了解架构
👉 阅读 [WEBSOCKET_TUNNEL_GUIDE.md](WEBSOCKET_TUNNEL_GUIDE.md)

#### 配置环境
👉 复制 `env.example` → 阅读 [ENV_CONFIGURATION.md](ENV_CONFIGURATION.md)

#### 测试代理
👉 运行 `../scripts/test-proxy.ps1` 或 `../scripts/test-proxy.sh`

#### 部署到服务器
👉 阅读 [deploy-node-on-server.md](deploy-node-on-server.md)

#### 解决问题
👉 查看 [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

#### 查看所有文档
👉 访问 [README.md](README.md)

#### 查看所有脚本
👉 访问 [../scripts/README.md](../scripts/README.md)

---

## 📝 维护指南

### 添加新文档

1. 在 `docs/` 目录创建 Markdown 文件
2. 更新 `docs/README.md` 添加链接
3. 在主 `README.md` 的文档导航中添加（如果是重要文档）
4. 更新 `CHANGELOG.md`

### 添加新脚本

1. 在 `scripts/` 目录创建 `.ps1` 和 `.sh` 版本
2. 更新 `scripts/README.md` 添加说明
3. 添加执行权限（Linux/Mac）
4. 测试确保正常工作

### 添加新示例

1. 在 `examples/` 目录创建示例文件
2. 更新 `examples/README.md` 添加说明
3. 确保示例可以直接运行
4. 添加必要的注释

---

## 🔄 项目结构演进

### v1.0.0（初始版本）
- 所有文档和脚本在根目录
- 比较杂乱

### v2.0.0（当前版本）
- ✅ 创建 `docs/` 目录集中管理文档
- ✅ 创建 `scripts/` 目录集中管理脚本
- ✅ 更新所有文档链接
- ✅ 提供索引和导航
- ✅ 根目录更加清晰

---

## 🎯 最佳实践

### 文档编写
- 使用清晰的标题和目录
- 提供代码示例
- 包含预期输出
- 添加故障排除部分

### 脚本编写
- 同时提供 Windows 和 Linux/Mac 版本
- 添加详细注释
- 包含错误处理
- 提供使用说明

### 代码组织
- 按功能模块划分
- 保持目录结构清晰
- 使用 TypeScript 类型
- 添加必要注释

---

## 📞 帮助和支持

- **文档索引：** [README.md](README.md)
- **脚本工具：** [../scripts/README.md](../scripts/README.md)
- **故障排除：** [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- **GitHub：** [@larrygogo/proxynode](https://github.com/larrygogo/proxynode)

---

更新时间：2025-12-29  
版本：v2.0.0
