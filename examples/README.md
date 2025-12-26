# ProxyNode 使用示例

本目录包含使用 Resi Proxy 的示例代码。

## 前提条件

确保主服务器和至少一个节点已启动：

```bash
# 终端 1：启动主服务器
npm run start:master

# 终端 2：启动节点
npm run start:node
```

## Node.js 示例

### 安装依赖

```bash
npm install axios socks-proxy-agent
```

### 运行示例

```bash
node use-proxy.js
```

## Python 示例

### 安装依赖

```bash
pip install requests[socks]
```

### 运行示例

```bash
python use-proxy.py
```

## 代理地址说明

### 主服务器代理（推荐）

主服务器会自动选择最佳节点：

- HTTP/HTTPS: `http://localhost:8080`
- SOCKS5: `socks5://localhost:1080`

### 节点代理（直连）

直接连接到特定节点：

- HTTP/HTTPS: `http://localhost:8081`（节点1）
- SOCKS5: `socks5://localhost:1081`（节点1）

如果启动了多个节点，端口会递增（8082, 8083...）

## 测试 URL

- `http://httpbin.org/ip` - 查看出口 IP
- `http://httpbin.org/headers` - 查看请求头
- `http://httpbin.org/get` - 测试 GET 请求
- `https://api.ipify.org?format=json` - 查看 IP（HTTPS）

## 其他工具

### curl

```bash
# HTTP 代理
curl -x http://localhost:8080 http://httpbin.org/ip

# SOCKS5 代理
curl --socks5 localhost:1080 http://httpbin.org/ip

# HTTPS 请求
curl -x http://localhost:8080 https://api.ipify.org?format=json
```

### wget

```bash
# HTTP 代理
wget -e use_proxy=yes -e http_proxy=localhost:8080 http://httpbin.org/ip

# 或使用环境变量
export http_proxy=http://localhost:8080
export https_proxy=http://localhost:8080
wget http://httpbin.org/ip
```

### PowerShell

```powershell
# 设置代理
$env:HTTP_PROXY = "http://localhost:8080"
$env:HTTPS_PROXY = "http://localhost:8080"

# 使用 Invoke-WebRequest
Invoke-WebRequest -Uri "http://httpbin.org/ip" -Proxy "http://localhost:8080"

# 或使用环境变量
Invoke-WebRequest -Uri "http://httpbin.org/ip"
```

## 验证代理工作

如果代理正常工作，您应该看到：

1. 请求成功返回
2. 节点服务器日志显示代理请求
3. 主服务器日志显示路由信息（如果通过主服务器）

## 故障排查

如果代理不工作：

1. 确认服务器已启动：`.\view-nodes.ps1`
2. 检查端口是否正确
3. 查看服务器日志中的错误信息
4. 尝试直接访问 API：`curl http://localhost:3000/health`

