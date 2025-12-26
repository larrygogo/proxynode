# 🚀 ProxyNode

一个基于 Node.js 的分布式代理系统，支持 HTTP/HTTPS 和 SOCKS5 代理协议，具有自动负载均衡、节点管理和实时监控功能。

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![GitHub](https://img.shields.io/badge/GitHub-larrygogo-181717?logo=github)](https://github.com/larrygogo/proxynode)

## ✨ 功能特性

### 核心功能
- 🌐 **双协议支持** - 同时支持 HTTP/HTTPS 和 SOCKS5 代理
- ⚖️ **智能负载均衡** - 多种节点选择策略（轮询、最少连接、区域优先）
- 🔄 **自动故障转移** - 节点自动健康检查和故障恢复
- 📊 **实时监控** - 美观的 Web 监控面板，实时显示节点状态
- 🌍 **公网 IP 识别** - 自动获取和显示节点公网 IP
- 💬 **WebSocket 通信** - 实时双向通信和节点控制

### 监控与管理
- 📈 **性能指标** - CPU、内存、带宽、连接数实时监控
- 🎯 **节点管理** - REST API 管理节点注册、状态查询
- 🔍 **详细日志** - 完整的请求追踪和错误日志
- ⏱️ **运行时间统计** - 节点在线时长和稳定性追踪

### 高级特性
- 🏗️ **Monorepo 架构** - 主服务器和节点 SDK 统一管理
- 🔐 **API 密钥认证** - 支持节点认证（可选）
- 🌏 **多区域支持** - 按地理位置管理和选择节点
- 🔧 **灵活配置** - 支持配置文件和环境变量

## 🏗️ 系统架构

```
┌─────────────┐
│   客户端     │
│ (浏览器/App) │
└──────┬──────┘
       │ HTTP/SOCKS5
       ▼
┌──────────────────┐         WebSocket          ┌─────────────┐
│   主服务器        │◄──────────────────────────►│  节点 1     │
│  (负载均衡器)     │         心跳/控制           │  (代理服务)  │
│                  │                             └──────┬──────┘
│  - 节点管理      │◄────────────┐                     │
│  - 请求路由      │             │                     │ 转发请求
│  - 监控面板      │◄────────────┤              ┌─────▼──────┐
│  - API 服务      │             │              │  互联网     │
└──────────────────┘             │              └────────────┘
                                 │
                          ┌──────┴──────┐
                          │   节点 N    │
                          │  (代理服务)  │
                          └─────────────┘
```

## 📦 项目结构

```
proxynode/
├── master-server/          # 主服务器
│   ├── src/
│   │   ├── api/           # REST API 路由
│   │   ├── config/        # 配置管理
│   │   ├── manager/       # 节点管理器
│   │   ├── proxy/         # 代理服务
│   │   ├── websocket/     # WebSocket 服务
│   │   └── types/         # 类型定义
│   ├── public/            # 监控面板静态文件
│   └── config.json        # 配置文件
│
├── node-sdk/              # 节点服务器 SDK
│   ├── src/
│   │   ├── config/        # 配置管理
│   │   ├── monitor/       # 状态监控
│   │   ├── proxy/         # 代理实现
│   │   ├── server/        # 服务器通信
│   │   ├── types/         # 类型定义
│   │   └── utils/         # 工具函数
│   └── config.json        # 配置文件
│
├── examples/              # 使用示例
├── TESTING.md            # 测试指南
└── README.md             # 项目文档
```

## 🚀 快速开始

### 环境要求

- Node.js >= 20.0.0
- npm >= 9.0.0
- TypeScript >= 5.3.0

### 安装

```bash
# 克隆仓库
git clone https://github.com/larrygogo/proxynode.git
cd proxynode

# 安装依赖
npm install

# 构建项目
npm run build
```

### 启动主服务器

```bash
# 在第一个终端启动主服务器
npm run start:master
```

服务器启动后会显示：
```
[MasterServer] 监控面板: http://localhost:3000/dashboard.html
[MasterServer] API 地址: http://localhost:3000/api
[HttpProxy] HTTP 代理服务器启动在端口 8080
[Socks5Proxy] SOCKS5 代理服务器启动在端口 1080
```

### 启动节点服务器

```bash
# 在第二个终端启动节点
npm run start:node
```

节点启动后会自动：
1. 获取公网 IP
2. 注册到主服务器
3. 建立 WebSocket 连接
4. 开始状态上报

## ⚙️ 配置说明

### 主服务器配置 (master-server/config.json)

```json
{
  "server": {
    "port": 3000,              // API 和监控面板端口
    "proxyHttpPort": 8080,     // HTTP 代理端口
    "proxySocks5Port": 1080    // SOCKS5 代理端口
  },
  "nodeSelection": {
    "strategy": "least_connections",  // 节点选择策略
    "fallback": "round_robin",        // 备用策略
    "region": "us-west"               // 首选区域（可选）
  },
  "nodeTimeout": 30000         // 节点超时时间（毫秒）
}
```

**节点选择策略：**
- `round_robin` - 轮询
- `least_connections` - 最少连接数
- `region_priority` - 区域优先
- `manual` - 手动指定

### 节点配置 (node-sdk/config.json)

```json
{
  "node": {
    "name": "node-001",        // 节点名称
    "region": "us-west",       // 节点区域
    "httpPort": 8081,          // HTTP 代理端口
    "socks5Port": 1081,        // SOCKS5 代理端口
    "host": "localhost"        // 节点地址
  },
  "master": {
    "url": "http://localhost:3000",      // 主服务器 API 地址
    "wsUrl": "ws://localhost:3000/ws",   // WebSocket 地址
    "apiKey": "your-api-key"             // API 密钥（可选）
  },
  "monitor": {
    "reportInterval": 30000    // 状态上报间隔（毫秒）
  }
}
```

### 环境变量支持

```bash
# 主服务器
MASTER_PORT=3000
PROXY_HTTP_PORT=8080
PROXY_SOCKS5_PORT=1080
NODE_SELECTION_STRATEGY=least_connections

# 节点服务器
NODE_NAME=node-001
NODE_REGION=us-west
NODE_HTTP_PORT=8081
NODE_SOCKS5_PORT=1081
MASTER_URL=http://localhost:3000
MASTER_WS_URL=ws://localhost:3000/ws
```

## 📖 使用指南

### 使用 HTTP 代理

```bash
# 通过主服务器（自动负载均衡）
curl -x http://localhost:8080 http://ipinfo.io/json

# 直接通过节点
curl -x http://localhost:8081 http://ipinfo.io/json

# 在代码中使用
export HTTP_PROXY=http://localhost:8080
export HTTPS_PROXY=http://localhost:8080
```

### 使用 SOCKS5 代理

```bash
# 通过主服务器
curl --socks5 localhost:1080 http://ipinfo.io/json

# 直接通过节点
curl --socks5 localhost:1081 http://ipinfo.io/json

# HTTPS 请求
curl --socks5 localhost:1081 https://api.ipify.org?format=json
```

### 浏览器配置

**Chrome/Edge（命令行启动）：**
```bash
chrome.exe --proxy-server="http://localhost:8080"
```

**Firefox：**
1. 设置 → 网络设置 → 手动代理配置
2. HTTP 代理：`localhost`，端口：`8080`
3. SOCKS5 代理：`localhost`，端口：`1080`

### 编程方式使用

**Node.js：**
```javascript
const axios = require('axios');

// HTTP 代理
const response = await axios.get('http://ipinfo.io/json', {
  proxy: {
    host: 'localhost',
    port: 8080
  }
});

// SOCKS5 代理
const { SocksProxyAgent } = require('socks-proxy-agent');
const agent = new SocksProxyAgent('socks5://localhost:1080');
const response = await axios.get('http://ipinfo.io/json', {
  httpAgent: agent,
  httpsAgent: agent
});
```

**Python：**
```python
import requests

proxies = {
    'http': 'http://localhost:8080',
    'https': 'http://localhost:8080'
}

response = requests.get('http://ipinfo.io/json', proxies=proxies)
```

更多示例请查看 [examples](examples/) 目录。

## 📊 监控面板

访问 `http://localhost:3000/dashboard.html` 查看实时监控面板。

### 功能特性
- 📈 实时统计：在线节点、活动连接、总带宽
- 🖥️ 节点详情：CPU/内存使用率、连接数、运行时间
- 🌐 公网 IP 显示：自动获取并显示节点公网 IP
- 🔄 自动刷新：每 5 秒更新数据
- 📱 响应式设计：支持移动设备

### 监控指标
- 在线/离线节点数量
- 活动连接总数
- 实时带宽使用（上传/下载）
- CPU 和内存使用率
- 节点运行时间
- 最后心跳时间

## 🔌 REST API

### 节点管理

**注册节点**
```http
POST /api/nodes/register
Content-Type: application/json

{
  "name": "node-001",
  "region": "us-west",
  "httpPort": 8081,
  "socks5Port": 1081,
  "capabilities": ["http", "socks5"],
  "host": "localhost"
}
```

**获取所有节点**
```http
GET /api/nodes
```

**获取特定节点**
```http
GET /api/nodes/:nodeId
```

**更新节点状态**
```http
PUT /api/nodes/:nodeId/status
Content-Type: application/json

{
  "nodeId": "...",
  "status": "online",
  "connections": 10,
  "bandwidth": {
    "upload": 1024000,
    "download": 5120000
  },
  "load": {
    "cpu": 45.5,
    "memory": 60.2
  }
}
```

**健康检查**
```http
GET /health
```

**监控数据**
```http
GET /api/dashboard/stats
```

## 🧪 测试

### 快速测试

```bash
# HTTP 代理测试
curl -x http://localhost:8080 http://ipinfo.io/json

# SOCKS5 代理测试
curl --socks5 localhost:1080 http://ipinfo.io/json

# 使用自动化测试脚本
.\test-proxy.ps1        # HTTP 测试
.\test-socks5.ps1       # SOCKS5 测试

# 查看节点状态
.\view-nodes.ps1
```

### 完整测试

详细测试指南请查看 [TESTING.md](TESTING.md)。

## 🔧 故障排查

### 节点无法注册

**问题：** 节点启动后无法连接到主服务器

**解决方案：**
1. 确认主服务器已启动：`curl http://localhost:3000/health`
2. 检查配置文件中的 `master.url` 是否正确
3. 查看主服务器日志中的错误信息
4. 确认防火墙没有阻止连接

### 代理不工作

**问题：** 请求通过代理失败

**解决方案：**
1. 确认代理端口未被占用
2. 检查节点是否在线：`.\view-nodes.ps1`
3. 查看节点日志中的错误
4. 使用 `-v` 参数查看详细信息：`curl -v -x http://localhost:8080 http://ipinfo.io/json`

### WebSocket 连接失败

**问题：** 节点无法建立 WebSocket 连接

**解决方案：**
1. 确认 WebSocket 端口可访问
2. 检查主服务器 WebSocket 服务是否启动
3. 查看节点日志中的连接错误
4. 尝试手动连接测试：`wscat -c ws://localhost:3000/ws`

### 公网 IP 获取失败

**问题：** 节点无法获取公网 IP

**解决方案：**
这不会影响节点功能，只是监控面板不显示公网 IP。可以：
1. 检查网络连接
2. 手动在配置中设置 `publicIp`
3. 查看日志中的错误信息

## 📝 开发

### 构建

```bash
# 构建所有项目
npm run build

# 单独构建
npm run build:master    # 主服务器
npm run build:node      # 节点服务器
```

### 开发模式

```bash
# 使用 ts-node 直接运行
cd master-server && npm run dev
cd node-sdk && npm run dev
```

### 代码结构

- `src/` - TypeScript 源代码
- `dist/` - 编译后的 JavaScript
- `public/` - 静态文件（仅主服务器）
- `config.json` - 配置文件
- `tsconfig.json` - TypeScript 配置

## 🚢 部署建议

### 生产环境

1. **使用 PM2 管理进程**
```bash
npm install -g pm2

# 启动主服务器
pm2 start master-server/dist/index.js --name resi-master

# 启动节点
pm2 start node-sdk/dist/index.js --name resi-node-1

# 查看状态
pm2 status
pm2 logs
```

2. **配置反向代理（Nginx）**
```nginx
server {
    listen 80;
    server_name proxy.example.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

3. **使用环境变量**
```bash
export NODE_ENV=production
export MASTER_URL=https://master.example.com
```

### Docker 部署

```dockerfile
# Dockerfile.master
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY master-server/package*.json ./master-server/
RUN npm install
COPY . .
RUN npm run build:master
CMD ["npm", "run", "start:master"]
```

### 安全建议

- 🔐 启用 HTTPS
- 🔑 使用 API 密钥认证
- 🛡️ 配置防火墙规则
- 📊 启用日志审计
- 🔄 定期更新依赖

## 📚 更多文档

- [完整测试指南](TESTING.md) - 详细的测试说明和示例
- [使用示例](examples/) - 各种编程语言的使用示例
- [API 文档](#-rest-api) - REST API 详细说明

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🙏 致谢

感谢所有贡献者和使用者！

---

**Made with ❤️ by ProxyNode Team**

如有问题或建议，请提交 [Issue](https://github.com/larrygogo/proxynode/issues)。
