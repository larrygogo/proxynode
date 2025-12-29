# ProxyNode 环境变量配置指南

## 📖 概述

ProxyNode 支持使用环境变量 (`.env` 文件) 来配置所有端口和 IP 地址，这使得配置更加灵活和安全。

## 🚀 快速开始

### 1. 复制示例文件

```bash
# 在项目根目录
cp env.example .env

# 或者在各自的子目录
cp master-server/env.example master-server/.env
cp node-sdk/env.example node-sdk/.env
```

### 2. 编辑配置

根据您的实际需求修改 `.env` 文件中的配置项。

### 3. 启动服务

```bash
# 服务会自动加载 .env 文件
npm run start:master
npm run start:node
```

---

## ⚙️ 配置项说明

### Master Server 配置

| 环境变量 | 说明 | 默认值 | 示例 |
|---------|------|--------|------|
| `MASTER_HOST` | Master Server 监听地址 | `0.0.0.0` | `0.0.0.0`、`127.0.0.1` |
| `MASTER_PORT` | Master Server API 端口 | `3000` | `3000` |
| `MASTER_HTTP_PROXY_PORT` | HTTP 代理端口 | `8080` | `8080` |
| `MASTER_SOCKS5_PROXY_PORT` | SOCKS5 代理端口 | `1080` | `1080` |
| `NODE_SELECTION_STRATEGY` | 节点选择策略 | `least_connections` | `round_robin`、`least_connections`、`region_priority` |
| `NODE_SELECTION_FALLBACK` | 备用策略 | `round_robin` | `round_robin`、`least_connections` |
| `NODE_TIMEOUT` | 节点超时时间（毫秒） | `30000` | `30000` |

**示例 `.env` (Master Server):**

```bash
# Master Server 配置
MASTER_HOST=0.0.0.0
MASTER_PORT=3000
MASTER_HTTP_PROXY_PORT=8080
MASTER_SOCKS5_PROXY_PORT=1080

# 节点管理
NODE_SELECTION_STRATEGY=least_connections
NODE_SELECTION_FALLBACK=round_robin
NODE_TIMEOUT=30000
```

### Node Server 配置

| 环境变量 | 说明 | 默认值 | 示例 |
|---------|------|--------|------|
| `NODE_HOST` | Node Server 监听地址 | `0.0.0.0` | `0.0.0.0`、`127.0.0.1` |
| `NODE_NAME` | Node 名称 | `node-001` | `node-beijing-001` |
| `NODE_REGION` | Node 所在区域 | `local` | `us-west`、`cn-beijing` |
| `NODE_HTTP_PORT` | HTTP 代理端口 | `8081` | `8081` |
| `NODE_SOCKS5_PORT` | SOCKS5 代理端口 | `1081` | `1081` |
| `MASTER_URL` | Master Server 地址 | `http://localhost:3000` | `http://192.168.1.100:3000` |
| `MASTER_WS_URL` | Master Server WebSocket 地址 | `ws://localhost:3000/ws` | `ws://192.168.1.100:3000/ws` |
| `MONITOR_REPORT_INTERVAL` | 监控数据上报间隔（毫秒） | `30000` | `30000` |

**示例 `.env` (Node Server):**

```bash
# Node Server 配置
NODE_HOST=0.0.0.0
NODE_NAME=node-001
NODE_REGION=local
NODE_HTTP_PORT=8081
NODE_SOCKS5_PORT=1081

# Master Server 连接
MASTER_URL=http://192.168.1.100:3000
MASTER_WS_URL=ws://192.168.1.100:3000/ws

# 监控配置
MONITOR_REPORT_INTERVAL=30000
```

---

## 🌐 部署场景

### 场景 1：本地开发测试

**Master Server (.env):**
```bash
MASTER_HOST=127.0.0.1
MASTER_PORT=3000
MASTER_HTTP_PROXY_PORT=8080
MASTER_SOCKS5_PROXY_PORT=1080
```

**Node Server (.env):**
```bash
NODE_HOST=127.0.0.1
NODE_HTTP_PORT=8081
NODE_SOCKS5_PORT=1081
MASTER_URL=http://127.0.0.1:3000
MASTER_WS_URL=ws://127.0.0.1:3000/ws
```

### 场景 2：局域网部署

**服务器上 - Master Server (.env):**
```bash
# 服务器IP: 192.168.1.100
MASTER_HOST=0.0.0.0
MASTER_PORT=3000
MASTER_HTTP_PROXY_PORT=8080
MASTER_SOCKS5_PROXY_PORT=1080
```

**本地电脑上 - Node Server (.env):**
```bash
NODE_HOST=0.0.0.0
NODE_NAME=node-local-001
NODE_REGION=home
NODE_HTTP_PORT=8081
NODE_SOCKS5_PORT=1081
MASTER_URL=http://192.168.1.100:3000
MASTER_WS_URL=ws://192.168.1.100:3000/ws
```

**手机代理配置:**
- 服务器：`192.168.1.100`
- 端口：`8080` (HTTP) 或 `1080` (SOCKS5)

### 场景 3：公网服务器部署

**公网服务器 - Master Server (.env):**
```bash
# 假设公网IP: 123.456.789.10
MASTER_HOST=0.0.0.0
MASTER_PORT=3000
MASTER_HTTP_PROXY_PORT=8080
MASTER_SOCKS5_PROXY_PORT=1080
```

**远程 Node Server (.env):**
```bash
NODE_HOST=0.0.0.0
NODE_NAME=node-us-west-001
NODE_REGION=us-west
NODE_HTTP_PORT=8081
NODE_SOCKS5_PORT=1081
MASTER_URL=http://123.456.789.10:3000
MASTER_WS_URL=ws://123.456.789.10:3000/ws
```

---

## 🔐 安全建议

### 1. 不要提交 `.env` 文件

`.env` 文件已经在 `.gitignore` 中，不会被 Git 跟踪。

### 2. 限制监听地址

如果只需要本地访问，使用 `127.0.0.1` 而不是 `0.0.0.0`：

```bash
MASTER_HOST=127.0.0.1
```

### 3. 添加认证 (未来功能)

```bash
# 计划中的功能
MASTER_API_KEY=your_secret_key_here
```

### 4. 使用防火墙

确保只开放必要的端口给特定的 IP 地址。

---

## 🧪 测试配置

### 使用环境变量测试脚本

```bash
# Windows
.\test-proxy-env.ps1

# Linux/Mac
chmod +x test-proxy-env.sh
./test-proxy-env.sh
```

这些脚本会自动从 `.env` 文件读取配置并进行测试。

### 手动测试

```bash
# 测试 HTTP 代理
curl -x http://${MASTER_HOST}:${MASTER_HTTP_PROXY_PORT} http://ipinfo.io/json

# 测试 SOCKS5 代理
curl --socks5 ${MASTER_HOST}:${MASTER_SOCKS5_PROXY_PORT} http://ipinfo.io/json
```

---

## 📝 配置优先级

配置加载的优先级从高到低：

1. **环境变量** (`.env` 文件或系统环境变量)
2. **配置文件** (`config.json`)
3. **默认值** (代码中的 `DEFAULT_CONFIG`)

例如：
- 如果 `.env` 中设置了 `MASTER_PORT=4000`
- 而 `config.json` 中设置了 `"port": 3000`
- 最终使用的是 `4000`

---

## 🔧 故障排查

### 问题 1：配置没有生效

**检查：**
1. `.env` 文件是否在正确的目录（`master-server/.env` 或 `node-sdk/.env`）
2. 环境变量名称是否正确（区分大小写）
3. 重启服务以加载新配置

### 问题 2：无法连接到 Master Server

**检查：**
1. `MASTER_URL` 和 `MASTER_WS_URL` 是否配置正确
2. 防火墙是否开放了相应端口
3. Master Server 是否在运行

### 问题 3：手机无法使用代理

**检查：**
1. `MASTER_HOST` 是否设置为 `0.0.0.0`
2. 防火墙是否开放了代理端口
3. 手机是否在同一网络或能访问服务器

---

## 📚 相关文档

- [README.md](README.md) - 项目总览
- [TESTING.md](TESTING.md) - 测试指南
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - 故障排除

---

**提示：** 如需更多帮助，请查看 [故障排除指南](TROUBLESHOOTING.md) 或提交 [Issue](https://github.com/larrygogo/proxynode/issues)。
