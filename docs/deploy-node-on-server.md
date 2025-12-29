# 在服务器上部署 Node Server

## 问题说明

当 Node Server 在本地电脑（NAT 后面）运行时，Master Server 无法直接连接到它。

**解决方案：** 将 Node Server 也部署到服务器上，Master 和 Node 通过 localhost 通信。

---

## 部署步骤

### 步骤 1：上传代码到服务器

```bash
# 方式 A：使用 Git（推荐）
ssh user@47.110.58.130
cd /root/proxynode
git pull

# 方式 B：使用 scp 上传
scp -r node-sdk user@47.110.58.130:/root/proxynode/
```

### 步骤 2：在服务器上配置 Node Server

创建 `.env` 文件或修改 `node-sdk/config.json`：

```json
{
  "node": {
    "name": "node-server-001",
    "region": "cn-shanghai",
    "httpPort": 8081,
    "socks5Port": 1081,
    "host": "0.0.0.0"
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

**注意：** Master URL 使用 `localhost`，因为它们在同一台服务器上。

### 步骤 3：构建并启动

```bash
# SSH 到服务器
ssh user@47.110.58.130

# 进入项目目录
cd /root/proxynode

# 构建 Node Server
npm run build:node

# 方式 A：使用 screen 或 tmux 运行
screen -S node-server
npm run start:node
# 按 Ctrl+A, D 分离会话

# 方式 B：使用 nohup 后台运行
nohup npm run start:node > node-server.log 2>&1 &

# 方式 C：使用 systemd 服务（推荐生产环境）
# 见下文
```

### 步骤 4：验证

```bash
# 查看进程
ps aux | grep node

# 查看日志
tail -f node-server.log

# 测试代理
curl -x http://localhost:8080 http://ipinfo.io/json
```

---

## 使用 systemd 管理（推荐）

### 创建 Master Server 服务

创建文件 `/etc/systemd/system/proxynode-master.service`：

```ini
[Unit]
Description=ProxyNode Master Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/proxynode
Environment="NODE_ENV=production"
ExecStart=/usr/bin/npm run start:master
Restart=always
RestartSec=10
StandardOutput=append:/var/log/proxynode-master.log
StandardError=append:/var/log/proxynode-master-error.log

[Install]
WantedBy=multi-user.target
```

### 创建 Node Server 服务

创建文件 `/etc/systemd/system/proxynode-node.service`：

```ini
[Unit]
Description=ProxyNode Node Server
After=network.target proxynode-master.service
Requires=proxynode-master.service

[Service]
Type=simple
User=root
WorkingDirectory=/root/proxynode
Environment="NODE_ENV=production"
ExecStart=/usr/bin/npm run start:node
Restart=always
RestartSec=10
StandardOutput=append:/var/log/proxynode-node.log
StandardError=append:/var/log/proxynode-node-error.log

[Install]
WantedBy=multi-user.target
```

### 启动服务

```bash
# 重新加载 systemd
systemctl daemon-reload

# 启动服务
systemctl start proxynode-master
systemctl start proxynode-node

# 设置开机自启
systemctl enable proxynode-master
systemctl enable proxynode-node

# 查看状态
systemctl status proxynode-master
systemctl status proxynode-node

# 查看日志
journalctl -u proxynode-master -f
journalctl -u proxynode-node -f
```

---

## 网络架构

```
互联网
  ↓
服务器 (47.110.58.130)
  ├─ Master Server (0.0.0.0:3000, 8080, 1080)
  │   ↓ localhost 连接
  └─ Node Server (0.0.0.0:8081, 1081)
```

**优势：**
- ✅ Master 可以直接通过 localhost 连接 Node
- ✅ 无需端口映射
- ✅ 低延迟
- ✅ 易于管理

---

## 多节点部署

如果需要多个节点，可以：

1. **在同一服务器上运行多个 Node**（不同端口）
2. **在不同服务器上运行 Node**（每台服务器都有公网 IP）

### 示例：同一服务器多个节点

**节点 1：**
```json
{
  "node": {
    "name": "node-001",
    "httpPort": 8081,
    "socks5Port": 1081
  }
}
```

**节点 2：**
```json
{
  "node": {
    "name": "node-002",
    "httpPort": 8082,
    "socks5Port": 1082
  }
}
```

---

## 故障排查

### 检查端口监听

```bash
netstat -tuln | grep -E '3000|8080|1080|8081|1081'
```

### 检查进程

```bash
ps aux | grep node
```

### 查看日志

```bash
# systemd 服务
journalctl -u proxynode-master -n 100
journalctl -u proxynode-node -n 100

# nohup
tail -f node-server.log
```

### 测试连接

```bash
# 测试 Master API
curl http://localhost:3000/api/nodes

# 测试 Node 代理
curl -x http://localhost:8081 http://ipinfo.io/json

# 测试 Master 代理
curl -x http://localhost:8080 http://ipinfo.io/json
```

---

## 安全建议

1. **使用防火墙**限制访问：
   ```bash
   # 只允许必要的端口
   ufw allow 3000/tcp  # API
   ufw allow 8080/tcp  # HTTP 代理
   ufw allow 1080/tcp  # SOCKS5 代理
   ufw enable
   ```

2. **使用认证**（未来功能）

3. **配置 HTTPS**

4. **定期更新**

---

这种部署方式简单可靠，推荐用于生产环境！
