# 快速测试指南 - WebSocket 隧道架构

## 📋 测试清单

### ✅ 步骤 1：更新服务器上的 Master Server

```bash
# SSH 到服务器
ssh user@47.110.58.130

# 停止旧的 Master Server
pkill -f "node.*master"

# 进入项目目录
cd /root/proxynode

# 上传新的构建文件
# 方式 A：使用 Git
git pull
npm run build:master

# 方式 B：手动上传
# 使用 scp 上传本地的 master-server/dist 目录

# 启动 Master Server
cd master-server
nohup npm start > ../master-server.log 2>&1 &

# 查看日志，确认启动成功
tail -f ../master-server.log
```

**预期日志：**
```
[MasterServer] 正在启动主服务器...
[MasterServer] WebSocket 服务器已创建
[MasterServer] 代理服务器已创建（WebSocket 隧道模式）
[MasterServer] HTTP 服务器启动在 0.0.0.0:3000
[MasterServer] HTTP 代理服务器启动在 0.0.0.0:8080
[MasterServer] SOCKS5 代理服务器启动在 0.0.0.0:1080
```

---

### ✅ 步骤 2：启动本地 Node Server

```powershell
# 在本地电脑上（Windows）
cd C:\Users\larry\Desktop\resiproxy\node-sdk

# 确保 .env 文件存在且配置正确
# 如果没有，从项目根目录复制 env.example

# 启动 Node Server
npm start
```

**预期日志：**
```
[NodeServer] 正在启动节点服务器...
[NodeServer] Master Server: http://47.110.58.130:3000
[NodeServer] HTTP 代理服务器启动在 127.0.0.1:8081
[NodeServer] SOCKS5 代理服务器启动在 127.0.0.1:1081
[HttpClient] 节点注册成功: <node-id>
[WebSocketClient] 正在连接到主服务器: ws://47.110.58.130:3000/ws
[WebSocketClient] 已连接到主服务器
[NodeServer] 节点服务器启动完成
```

**Master Server 日志（同时出现）：**
```
[NodeManager] 节点已注册: <node-id> (node-local-001)
[WebSocket] 新连接建立
[WebSocket] 节点连接已注册: <node-id>
```

---

### ✅ 步骤 3：测试代理功能

在本地电脑上运行测试脚本：

```powershell
# 测试 HTTP 代理
curl.exe -x http://47.110.58.130:8080 http://ipinfo.io/json

# 测试 HTTPS 代理
curl.exe -x http://47.110.58.130:8080 https://api.ipify.org?format=json

# 测试 SOCKS5 代理
curl.exe --socks5 47.110.58.130:1080 http://ipinfo.io/json
```

**预期输出：**
```json
{
  "ip": "xxx.xxx.xxx.xxx",
  "city": "...",
  "region": "...",
  "country": "..."
}
```

---

### ✅ 步骤 4：检查日志

#### Master Server 日志

```
[HttpProxy] 收到请求: GET http://ipinfo.io/json
[HttpProxy] HTTP 请求: GET http://ipinfo.io/json
[HttpProxy] 选择节点: node-local-001 (<node-id>)
[HttpProxy] 通过 WebSocket 隧道转发 HTTP 请求
[WebSocket] 发送代理请求: <request-id> → <node-id> (http)
[WebSocket] 收到代理响应: <request-id> (success: true)
[WebSocket] 收到代理数据: <request-id> (... bytes, end: true)
[HttpProxy] 请求完成: <request-id>
```

#### Node Server 日志

```
[WebSocketClient] 收到代理请求: http <request-id>
[WebSocketClient] HTTP 响应: 200 (<request-id>)
[WebSocketClient] HTTP 请求完成: <request-id>
```

---

### ✅ 步骤 5：测试手机代理

1. **配置手机代理：**
   - WiFi 设置 → 代理 → 手动
   - 服务器：`47.110.58.130`
   - 端口：`8080`（HTTP）或 `1080`（SOCKS5）

2. **打开浏览器访问：**
   - http://ipinfo.io/json
   - https://www.google.com

3. **检查 IP 地址：**
   - 应该显示 Node Server 所在网络的公网 IP

---

## 🎯 预期结果

### ✅ 成功标志

1. **Node Server 成功连接到 Master**
   - Node 日志显示 "已连接到主服务器"
   - Master 日志显示 "节点连接已注册"

2. **代理请求正常工作**
   - `curl` 命令返回 IP 信息
   - Master 和 Node 日志显示请求转发过程

3. **手机可以使用代理**
   - 浏览器可以正常访问网站
   - IP 地址显示为 Node 的公网 IP

### ❌ 常见问题

#### 问题 1：Node 连接失败

**症状：**
```
[WebSocketClient] WebSocket 错误: Error: connect ECONNREFUSED
```

**解决：**
1. 检查 Master Server 是否启动：
   ```bash
   curl http://47.110.58.130:3000/api/nodes
   ```

2. 检查防火墙是否开放 3000 端口

3. 检查 `.env` 配置是否正确

#### 问题 2：代理请求失败（502 错误）

**症状：**
```
[HttpProxy] 错误: 没有可用节点
```

**解决：**
1. 访问监控面板：http://47.110.58.130:3000/dashboard.html
2. 检查节点是否在线
3. 重启 Node Server

#### 问题 3：WebSocket 连接断开

**症状：**
```
[WebSocketClient] 连接已关闭: 1006
```

**解决：**
1. 检查网络稳定性
2. 查看 Master Server 日志，是否有错误
3. 重启 Node Server，观察是否能重新连接

---

## 📊 监控面板

访问：http://47.110.58.130:3000/dashboard.html

**检查项：**
- ✅ 节点是否显示为在线（绿色）
- ✅ 连接数是否增加
- ✅ 带宽是否有数据

---

## 🚀 性能测试

### 测试延迟

```powershell
# 测试 10 次请求
for ($i=1; $i -le 10; $i++) {
    Measure-Command {
        curl.exe -x http://47.110.58.130:8080 http://ipinfo.io/json -s | Out-Null
    } | Select-Object TotalMilliseconds
}
```

**预期延迟：** 100-500ms（取决于网络）

### 测试并发

```powershell
# 并发 10 个请求
1..10 | ForEach-Object -Parallel {
    curl.exe -x http://47.110.58.130:8080 http://ipinfo.io/json
}
```

**预期：** 所有请求都成功返回

---

## 📝 检查清单

- [ ] Master Server 启动成功
- [ ] Master Server 日志显示 "WebSocket 隧道模式"
- [ ] Node Server 启动成功
- [ ] Node Server 日志显示 "已连接到主服务器"
- [ ] Master Server 日志显示 "节点连接已注册"
- [ ] HTTP 代理测试成功
- [ ] HTTPS 代理测试成功
- [ ] SOCKS5 代理测试成功
- [ ] 手机代理配置成功
- [ ] 监控面板显示节点在线
- [ ] Master 和 Node 日志显示代理请求流程

---

## 🎉 成功！

如果所有测试都通过，恭喜你！WebSocket 隧道架构已经成功运行！

**现在你可以：**
- ✅ 在任何地方部署 Node Server（无需公网 IP）
- ✅ 添加更多 Node Server 进行负载均衡
- ✅ 使用手机、浏览器等客户端使用代理

---

## 📚 更多文档

- 📖 [WebSocket 隧道架构指南](WEBSOCKET_TUNNEL_GUIDE.md)
- 📖 [反向连接架构设计](REVERSE_PROXY_ARCHITECTURE.md)
- 📖 [故障排除指南](TROUBLESHOOTING.md)
- 📖 [环境配置指南](ENV_CONFIGURATION.md)
