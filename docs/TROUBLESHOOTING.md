# 🔧 ProxyNode 故障排除指南

## 📱 手机无法访问代理问题

### 问题描述
- Master Server 在服务器上运行
- Node Server 在本地电脑上运行
- Node 显示连接成功
- 手机配置代理后无法访问网络

### 解决方案

#### 1️⃣ 检查服务器配置

**在服务器上查看 Master Server 的 IP 地址：**

```bash
# Linux/Mac
ip addr show
# 或
ifconfig

# Windows
ipconfig
```

找到服务器的**内网 IP**（例如：192.168.1.100）或**公网 IP**。

#### 2️⃣ 修改 Node 配置

在**本地电脑**上，修改 `node-sdk/config.json`：

```json
{
  "node": {
    "name": "node-001",
    "region": "local",
    "httpPort": 8081,
    "socks5Port": 1081,
    "host": "0.0.0.0"  // 改为 0.0.0.0 以便接受所有网络接口的连接
  },
  "master": {
    "url": "http://YOUR_SERVER_IP:3000",  // 将 YOUR_SERVER_IP 替换为服务器的实际 IP
    "wsUrl": "ws://YOUR_SERVER_IP:3000/ws"
  },
  "monitor": {
    "reportInterval": 30000
  }
}
```

**重要提示：**
- 如果手机和电脑在**同一局域网**，使用服务器的**内网 IP**（如 192.168.1.100）
- 如果手机使用**移动网络**访问，需要使用服务器的**公网 IP**

#### 3️⃣ 检查防火墙设置

**在服务器上开放必要的端口：**

##### Linux (使用 ufw)
```bash
sudo ufw allow 3000/tcp   # API 和 WebSocket
sudo ufw allow 8080/tcp   # HTTP 代理
sudo ufw allow 1080/tcp   # SOCKS5 代理
sudo ufw reload
```

##### Linux (使用 firewalld)
```bash
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --permanent --add-port=8080/tcp
sudo firewall-cmd --permanent --add-port=1080/tcp
sudo firewall-cmd --reload
```

##### Windows
```powershell
# 以管理员权限运行 PowerShell
New-NetFirewallRule -DisplayName "ProxyNode API" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
New-NetFirewallRule -DisplayName "ProxyNode HTTP Proxy" -Direction Inbound -Protocol TCP -LocalPort 8080 -Action Allow
New-NetFirewallRule -DisplayName "ProxyNode SOCKS5 Proxy" -Direction Inbound -Protocol TCP -LocalPort 1080 -Action Allow
```

##### 云服务器（阿里云、腾讯云等）
需要在**安全组规则**中开放端口：
- 入站规则：3000、8080、1080 端口
- 协议：TCP
- 授权对象：0.0.0.0/0（或限制为特定 IP）

#### 4️⃣ 配置手机代理

##### 方式 1：使用 HTTP 代理
```
代理类型：HTTP
服务器：YOUR_SERVER_IP（服务器的 IP 地址）
端口：8080
```

##### 方式 2：使用 SOCKS5 代理
```
代理类型：SOCKS5
服务器：YOUR_SERVER_IP（服务器的 IP 地址）
端口：1080
用户名：（留空）
密码：（留空）
```

**配置步骤（以 iPhone 为例）：**
1. 打开 **设置** → **Wi-Fi**
2. 点击已连接的 Wi-Fi 网络旁的 ⓘ 图标
3. 向下滚动到 **HTTP 代理**
4. 选择 **手动**
5. 输入服务器 IP 和端口
6. 点击 **存储**

**配置步骤（以 Android 为例）：**
1. 打开 **设置** → **网络和互联网** → **Wi-Fi**
2. 长按已连接的 Wi-Fi 网络
3. 选择 **修改网络**
4. 展开 **高级选项**
5. 代理选择 **手动**
6. 输入代理服务器主机名和端口
7. 点击 **保存**

#### 5️⃣ 重新构建并启动服务

**在服务器上：**
```bash
cd /path/to/proxynode
npm run build:master
npm run start:master
```

**在本地电脑上：**
```bash
cd /path/to/proxynode
npm run build:node
npm run start:node
```

#### 6️⃣ 验证连接

**测试网络连通性：**

##### 从本地电脑 ping 服务器
```bash
ping YOUR_SERVER_IP
```

##### 测试端口是否开放
```bash
# Linux/Mac
telnet YOUR_SERVER_IP 8080

# Windows PowerShell
Test-NetConnection -ComputerName YOUR_SERVER_IP -Port 8080
```

**检查 Master Server 日志：**
```
[MasterServer] HTTP 服务器启动在 0.0.0.0:3000
[MasterServer] HTTP 代理服务器启动在 0.0.0.0:8080
[MasterServer] SOCKS5 代理服务器启动在 0.0.0.0:1080
```

确认显示的是 `0.0.0.0`，而不是 `localhost` 或 `127.0.0.1`。

**检查 Node 是否成功注册：**

访问监控面板：`http://YOUR_SERVER_IP:3000/dashboard.html`

应该能看到已注册的节点。

#### 7️⃣ 测试代理功能

**从手机上测试：**
1. 配置好代理后，打开浏览器
2. 访问：`http://ip.sb` 或 `http://ipinfo.io`
3. 查看显示的 IP 是否是节点的公网 IP

**使用命令行测试（从另一台设备）：**
```bash
# 测试 HTTP 代理
curl -x http://YOUR_SERVER_IP:8080 http://ipinfo.io/json

# 测试 SOCKS5 代理
curl --socks5 YOUR_SERVER_IP:1080 http://ipinfo.io/json
```

---

## 🐛 常见问题

### Q1: Node 显示连接成功，但监控面板看不到节点？
**A:** 检查 Node 配置中的 master URL 是否正确，WebSocket 连接是否成功建立。

### Q2: 手机提示"代理服务器无响应"？
**A:** 
1. 确认服务器防火墙已开放端口
2. 确认服务器监听在 `0.0.0.0` 而不是 `localhost`
3. 确认手机和服务器之间的网络连通

### Q3: 代理连接后速度很慢？
**A:** 
1. 检查节点的网络带宽
2. 查看节点的系统负载（CPU、内存）
3. 考虑在靠近用户的地区部署更多节点

### Q4: 某些网站无法访问？
**A:** 
1. 检查节点的网络是否可以访问目标网站
2. 查看 Node 日志是否有错误信息
3. 尝试切换到其他节点

### Q5: 代理突然断开？
**A:** 
1. 检查节点是否还在运行
2. 查看节点的健康状态
3. 检查网络连接是否稳定

---

## 📊 调试工具

### 查看实时日志

**Master Server：**
```bash
# 查看所有日志
npm run start:master

# 过滤特定日志
npm run start:master | grep "HttpProxy"
```

**Node Server：**
```bash
# 查看所有日志
npm run start:node

# 过滤特定日志
npm run start:node | grep "连接"
```

### 使用 tcpdump 抓包（高级）
```bash
# 监听代理端口的流量
sudo tcpdump -i any port 8080 -n -A

# 保存到文件
sudo tcpdump -i any port 8080 -w proxy.pcap
```

---

## 📞 获取帮助

如果以上方法都无法解决问题，请：
1. 收集完整的日志信息
2. 记录您的配置文件
3. 描述详细的错误现象
4. 提交 Issue：https://github.com/larrygogo/proxynode/issues
