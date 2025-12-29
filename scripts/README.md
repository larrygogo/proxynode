# 🛠️ ProxyNode 脚本工具目录

本目录包含 ProxyNode 项目的所有测试脚本和工具脚本。

---

## 📋 脚本列表

### 🧪 代理测试脚本

#### HTTP/SOCKS5 代理测试
- **test-proxy.ps1** / **test-proxy.sh** - 基本代理测试（本地环境）
- **test-proxy-env.ps1** / **test-proxy-env.sh** - 使用 `.env` 配置的代理测试
- **test-remote-proxy.ps1** - 远程 Master Server 代理测试（仅 Windows）

#### SOCKS5 专项测试
- **test-socks5.ps1** - SOCKS5 代理专项测试（Windows）

### 🔍 诊断工具

#### Master Server 检查
- **check-master.ps1** / **check-master.sh** - 检查 Master Server 状态和 API 可用性

#### 网络诊断
- **check-network.ps1** / **check-network.sh** - 网络连通性和防火墙诊断

#### 节点查看
- **view-nodes.ps1** / **view-nodes.sh** - 查看所有已注册的节点信息

---

## 🚀 快速使用

### Windows (PowerShell)

```powershell
# 测试本地代理
.\scripts\test-proxy.ps1

# 测试远程代理（读取 .env 配置）
.\scripts\test-remote-proxy.ps1

# 检查 Master Server
.\scripts\check-master.ps1

# 网络诊断
.\scripts\check-network.ps1

# 查看节点
.\scripts\view-nodes.ps1

# SOCKS5 测试
.\scripts\test-socks5.ps1
```

### Linux/Mac (Bash)

```bash
# 测试本地代理
./scripts/test-proxy.sh

# 测试代理（使用 .env）
./scripts/test-proxy-env.sh

# 检查 Master Server
./scripts/check-master.sh

# 网络诊断
./scripts/check-network.sh

# 查看节点
./scripts/view-nodes.sh
```

---

## 📖 详细说明

### test-proxy.ps1 / test-proxy.sh

**功能：** 测试本地代理功能

**用途：**
- 测试 HTTP 代理
- 测试 HTTPS 代理
- 测试 SOCKS5 代理

**前提条件：**
- Master Server 运行在 `localhost:8080`（HTTP）和 `localhost:1080`（SOCKS5）
- 至少有一个 Node 在线

**示例输出：**
```
==================================
ProxyNode 代理测试
==================================

1. 测试 HTTP 代理
-----------------------------------
✓ HTTP 代理测试成功
  IP: xxx.xxx.xxx.xxx

2. 测试 HTTPS 代理
-----------------------------------
✓ HTTPS 代理测试成功

3. 测试 SOCKS5 代理
-----------------------------------
✓ SOCKS5 代理测试成功
```

---

### test-proxy-env.ps1 / test-proxy-env.sh

**功能：** 使用 `.env` 配置测试代理

**用途：**
- 从 `.env` 读取 Master Server 地址
- 测试配置的代理端口

**前提条件：**
- 项目根目录存在 `.env` 文件
- 配置了 `MASTER_URL`、`MASTER_HTTP_PROXY_PORT`、`MASTER_SOCKS5_PROXY_PORT`

**.env 示例：**
```bash
MASTER_URL=http://localhost:3000
MASTER_HTTP_PROXY_PORT=8080
MASTER_SOCKS5_PROXY_PORT=1080
```

---

### test-remote-proxy.ps1

**功能：** 测试远程 Master Server 的代理功能

**用途：**
- 测试远程服务器上的 Master
- 检查 API 可用性
- 测试代理功能

**前提条件：**
- `.env` 配置了远程 Master Server 地址
- Master Server 在远程服务器运行
- 至少有一个 Node 连接到 Master

**示例 .env：**
```bash
MASTER_URL=http://47.110.58.130:3000
MASTER_HTTP_PROXY_PORT=8080
MASTER_SOCKS5_PROXY_PORT=1080
```

---

### test-socks5.ps1

**功能：** SOCKS5 代理专项测试

**用途：**
- 详细测试 SOCKS5 协议
- 测试不同的 SOCKS5 场景

---

### check-master.ps1 / check-master.sh

**功能：** 检查 Master Server 状态

**用途：**
- 测试 API 可用性
- 查看注册的节点数量
- 检查健康状态

**示例输出：**
```
==================================
ProxyNode Master Server 检查
==================================

1. 检查 Master Server API
-----------------------------------
✓ Master Server API 正常
  状态码: 200
  已注册节点数: 2

2. 检查节点列表
-----------------------------------
✓ 节点 1: node-001 (在线)
✓ 节点 2: node-002 (在线)
```

---

### check-network.ps1 / check-network.sh

**功能：** 网络诊断工具

**用途：**
- 检查本地监听端口
- 测试防火墙配置
- 诊断连接问题
- 检查 Master Server 可达性

**检查项：**
- ✅ 端口监听状态
- ✅ 防火墙规则
- ✅ Master Server 连通性
- ✅ DNS 解析

**示例输出：**
```
==================================
ProxyNode 网络诊断
==================================

1. 检查本地监听端口
-----------------------------------
✓ 端口 8081 正在监听（HTTP 代理）
✓ 端口 1081 正在监听（SOCKS5 代理）

2. 检查防火墙
-----------------------------------
✓ 防火墙已配置

3. 测试 Master Server 连接
-----------------------------------
✓ 可以连接到 Master Server
```

---

### view-nodes.ps1 / view-nodes.sh

**功能：** 查看所有已注册的节点

**用途：**
- 查看节点列表
- 检查节点状态
- 查看节点详细信息

**示例输出：**
```
==================================
ProxyNode 节点列表
==================================

共有 2 个节点：

节点 1:
  名称: node-001
  状态: 在线
  区域: cn-shanghai
  HTTP 端口: 8081
  SOCKS5 端口: 1081
  连接数: 5
  公网 IP: 103.116.72.119

节点 2:
  名称: node-002
  状态: 在线
  区域: us-west
  HTTP 端口: 8081
  SOCKS5 端口: 1081
  连接数: 3
  公网 IP: 156.0.200.133
```

---

## 🔧 脚本开发

### 添加新脚本

1. 创建 `.ps1`（Windows）和 `.sh`（Linux/Mac）版本
2. 使用一致的输出格式
3. 添加错误处理
4. 更新本 README

### 脚本规范

```powershell
# PowerShell 脚本模板
# 设置错误处理
$ErrorActionPreference = "Continue"

Write-Host "=================================="
Write-Host "脚本名称"
Write-Host "=================================="
Write-Host ""

# 功能实现
# ...

Write-Host ""
Write-Host "=================================="
Write-Host "测试完成"
Write-Host "=================================="
```

```bash
#!/bin/bash
# Bash 脚本模板

echo "=================================="
echo "脚本名称"
echo "=================================="
echo ""

# 功能实现
# ...

echo ""
echo "=================================="
echo "测试完成"
echo "=================================="
```

---

## 🐛 故障排除

### 脚本执行权限错误（Linux/Mac）

```bash
# 添加执行权限
chmod +x scripts/*.sh
```

### PowerShell 执行策略错误（Windows）

```powershell
# 临时允许脚本执行
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process

# 或者使用完整路径
powershell -ExecutionPolicy Bypass -File .\scripts\test-proxy.ps1
```

### 找不到 curl 命令

**Windows:**
```powershell
# 使用 curl.exe 而不是 curl（避免与 Invoke-WebRequest 别名冲突）
curl.exe -x http://localhost:8080 http://ipinfo.io/json
```

**Linux/Mac:**
```bash
# 安装 curl
sudo apt install curl  # Ubuntu/Debian
brew install curl      # macOS
```

---

## 📚 相关文档

- [测试指南](../docs/TESTING.md) - 详细测试方法
- [快速测试](../docs/QUICK_TEST.md) - 快速测试步骤
- [故障排除](../docs/TROUBLESHOOTING.md) - 问题解决

---

## 🤝 贡献脚本

欢迎贡献新的测试脚本和工具！请参考 [../CONTRIBUTING.md](../CONTRIBUTING.md)

---

更新时间：2025-12-29  
版本：v2.0.0
