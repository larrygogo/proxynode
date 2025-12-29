# ProxyNode 本地测试指南

## 快速开始

### 1. 准备配置文件

#### 主服务器配置

复制示例配置并根据需要修改：

```bash
cd master-server
copy config.example.json config.json
```

配置文件 `master-server/config.json`：
```json
{
  "server": {
    "port": 3000,
    "proxyHttpPort": 8080,
    "proxySocks5Port": 1080
  },
  "nodeSelection": {
    "strategy": "least_connections",
    "fallback": "round_robin"
  },
  "nodeTimeout": 30000
}
```

#### 节点服务器配置

复制示例配置：

```bash
cd node-sdk
copy config.example.json config.json
```

配置文件 `node-sdk/config.json`：
```json
{
  "node": {
    "name": "node-001",
    "region": "local",
    "httpPort": 8081,
    "socks5Port": 1081,
    "host": "localhost"
  },
  "master": {
    "url": "http://localhost:3000",
    "wsUrl": "ws://localhost:3000/ws"
  },
  "monitor": {
    "reportInterval": 30000
  }
}
```

### 2. 启动服务

#### 在第一个终端启动主服务器

```bash
npm run start:master
```

预期输出：
```
[MasterServer] 正在启动主服务器...
[MasterServer] 配置加载完成
[MasterServer] 节点管理器已创建
[MasterServer] API 路由已注册
[MasterServer] WebSocket 服务器已创建
[MasterServer] HTTP 服务器启动在端口 3000
[MasterServer] API 地址: http://localhost:3000/api
[MasterServer] WebSocket 地址: ws://localhost:3000/ws
[HttpProxy] HTTP 代理服务器启动在端口 8080
[Socks5Proxy] SOCKS5 代理服务器启动在端口 1080
[MasterServer] 主服务器启动完成
```

#### 在第二个终端启动节点服务器

```bash
npm run start:node
```

预期输出：
```
[NodeServer] 正在启动节点服务器...
[NodeServer] 配置加载完成
[NodeServer] 监控器已创建
[NodeServer] 代理服务器已创建
[HttpProxy] HTTP 代理服务器启动在端口 8081
[Socks5Proxy] SOCKS5 代理服务器启动在端口 1081
[HttpClient] 节点注册成功: <node-id>
[NodeServer] 节点已注册: <node-id>
[WebSocketClient] 正在连接到主服务器: ws://localhost:3000/ws
[WebSocketClient] 已连接到主服务器
[NodeServer] WebSocket 连接已建立
[HttpClient] 状态上报已启动，间隔: 30000ms
[NodeServer] 节点服务器启动完成
```

### 3. 测试功能

#### 测试 API 端点

**健康检查：**
```bash
curl http://localhost:3000/health
```

**查看所有节点：**
```bash
curl http://localhost:3000/api/nodes
```

**查看特定节点：**
```bash
curl http://localhost:3000/api/nodes/<node-id>
```

#### 测试 HTTP 代理

**方式 1：通过节点直接代理（测试节点代理功能）**
```bash
# 使用 curl 测试
curl -x http://localhost:8081 http://httpbin.org/ip

# 或使用 PowerShell
$env:HTTP_PROXY="http://localhost:8081"
curl http://httpbin.org/ip
```

**方式 2：通过主服务器代理（测试主服务器路由功能）**
```bash
curl -x http://localhost:8080 http://httpbin.org/ip
```

#### 测试 SOCKS5 代理

使用支持 SOCKS5 的工具测试：

```bash
# 使用 curl（如果支持）
curl --socks5 localhost:1081 http://httpbin.org/ip

# 或者配置浏览器使用 SOCKS5 代理
# 地址: localhost
# 端口: 1081（节点）或 1080（主服务器）
```

#### 测试多节点场景

启动第二个节点（在第三个终端）：

1. 创建第二个节点配置：
```bash
cd node-sdk
copy config.json config-node2.json
```

2. 修改 `config-node2.json`：
```json
{
  "node": {
    "name": "node-002",
    "region": "local",
    "httpPort": 8082,
    "socks5Port": 1082,
    "host": "localhost"
  },
  "master": {
    "url": "http://localhost:3000",
    "wsUrl": "ws://localhost:3000/ws"
  },
  "monitor": {
    "reportInterval": 30000
  }
}
```

3. 启动第二个节点：
```bash
# Windows
$env:NODE_HTTP_PORT=8082; $env:NODE_SOCKS5_PORT=1082; $env:NODE_NAME="node-002"; npm run start

# Linux/Mac
NODE_HTTP_PORT=8082 NODE_SOCKS5_PORT=1082 NODE_NAME=node-002 npm run start
```

4. 验证两个节点都已注册：
```bash
curl http://localhost:3000/api/nodes
```

5. 测试负载均衡：
多次通过主服务器代理发送请求，观察请求被路由到不同节点。

### 4. 监控和调试

#### 查看节点状态

```bash
# 查看所有节点
curl http://localhost:3000/api/nodes | json_pp

# 查看特定节点状态
curl http://localhost:3000/api/nodes/<node-id>/status | json_pp
```

#### 观察日志

主服务器和节点服务器都会输出详细的日志信息：
- 节点注册和状态上报
- 代理请求处理
- WebSocket 连接状态
- 错误信息

### 5. 测试节点控制功能

虽然当前没有直接的控制 API，但可以通过 WebSocket 测试控制指令。

使用 WebSocket 客户端工具（如 `wscat`）：

```bash
npm install -g wscat
wscat -c ws://localhost:3000/ws
```

### 6. 常见测试场景

#### 场景 1：节点故障恢复

1. 启动主服务器和一个节点
2. 停止节点（Ctrl+C）
3. 观察主服务器日志，节点应被标记为离线
4. 重新启动节点
5. 节点重新注册并恢复服务

#### 场景 2：负载均衡

1. 启动主服务器和多个节点
2. 通过主服务器代理发送多个请求
3. 观察请求分配情况（通过日志或节点状态）

#### 场景 3：不同区域节点

1. 启动多个节点，配置不同的 `region`
2. 修改主服务器配置，设置 `region_priority` 策略
3. 测试请求优先路由到指定区域的节点

## 使用浏览器测试

### 配置浏览器代理

1. 打开浏览器代理设置
2. 配置 HTTP 代理：
   - 地址：`localhost`
   - 端口：`8080`（主服务器）或 `8081`（节点）
3. 访问任意网站，观察代理是否工作

### 使用 Chrome/Edge 命令行

```bash
# Windows
"C:\Program Files\Google\Chrome\Application\chrome.exe" --proxy-server="http://localhost:8080"

# Mac
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --proxy-server="http://localhost:8080"
```

## 性能测试

使用 Apache Bench 或类似工具测试代理性能：

```bash
# 安装 Apache Bench
# Windows: 下载 Apache 二进制包
# Linux: sudo apt-get install apache2-utils
# Mac: brew install httpd

# 测试
ab -n 1000 -c 10 -X localhost:8080 http://httpbin.org/get
```

## 故障排查

### 节点无法注册

- 检查主服务器是否启动
- 检查节点配置中的 `master.url` 是否正确
- 查看主服务器日志是否有错误

### 代理不工作

- 确认代理端口未被占用
- 检查防火墙设置
- 查看代理服务器日志

### WebSocket 连接失败

- 确认 WebSocket 端口可访问
- 检查主服务器是否正确启动 WebSocket 服务
- 查看节点日志中的连接错误信息

## 清理

停止所有服务：
- 在每个终端按 `Ctrl+C`
- 服务器会优雅关闭，清理资源

