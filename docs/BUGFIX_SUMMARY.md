# Bug修复总结

## 修复日期：2025-12-29

### 🐛 Bug 1: IPv6地址解析失败

**问题描述：**
- HTTPS CONNECT请求无法正确解析IPv6地址
- 错误：`options.port property must be one of type number or string. Received null`
- 日志显示：`[HttpProxy] CONNECT 请求: [240e:NaN`

**根本原因：**
```typescript
// 旧代码（有bug）
const [target, portStr] = (req.url || '').split(':');
const port = parseInt(portStr || '443', 10);
```

IPv6地址格式为`[2001:db8::1]:443`，使用`split(':')`会得到多个部分，导致端口解析失败。

**修复方案：**
- 正确处理IPv6地址（带方括号）
- 正确处理IPv4地址和域名
- 添加端口号验证（1-65535范围）
- 添加错误处理和详细日志

**影响文件：**
- `master-server/src/proxy/http-proxy.ts`

**测试场景：**
```bash
# IPv4
curl -x http://localhost:8080 https://1.2.3.4:443

# 域名
curl -x http://localhost:8080 https://example.com

# IPv6
curl -x http://localhost:8080 https://[2001:db8::1]:443
```

---

### 🔧 优化 1: 速率限制范围修正

**问题描述：**
- 速率限制对所有WebSocket消息生效，包括代理数据消息
- 单个设备访问网页时，大量proxy_data消息导致频繁触发速率限制
- 即使设置为5000条/分钟仍然不够用

**根本原因：**
```typescript
// 旧逻辑：对所有消息检查速率限制
if (!this.rateLimiter.checkMessageRate(ws.nodeId)) {
  // 拒绝消息
}
```

这会限制所有消息，包括：
- `proxy_request` - 代理请求
- `proxy_response` - 代理响应
- `proxy_data` - 代理数据（数量最多！）
- `proxy_close` - 连接关闭
- 控制消息（event、command等）

一个网页可能有几百个资源，每个资源产生多条proxy_data消息，很容易超限。

**修复方案：**
- ✅ 只对控制消息进行速率限制
- ✅ 代理数据消息（proxy_data、proxy_response、proxy_close、proxy_error）不受限制
- ✅ 保持对控制消息的保护，防止滥用

**修复后逻辑：**
```typescript
// 新逻辑：排除代理数据消息
const isProxyDataMessage = ['proxy_data', 'proxy_response', 'proxy_close', 'proxy_error'].includes(message.type);

if (!isProxyDataMessage && !this.rateLimiter.checkMessageRate(ws.nodeId)) {
  // 只对控制消息限制
}
```

**影响文件：**
- `master-server/src/websocket/websocket-server.ts`

---

### 🔧 优化 2: 网络错误日志改进

**问题描述：**
- 常见的网络错误（如ECONNRESET）会输出完整的堆栈跟踪
- 这些是正常的网络事件，不应该作为错误对待

**改进内容：**

对以下常见网络错误进行优雅处理：
- `ECONNRESET` - 连接被重置（客户端断开）
- `EPIPE` - 管道损坏（对端关闭）
- `ETIMEDOUT` - 连接超时
- `ENOTFOUND` - DNS解析失败

**优化效果：**

**优化前：**
```
[HttpProxy] 客户端错误: ff6d12b8-470c-4124-9018-137be054c021 Error: read ECONNRESET
    at TCP.onStreamRead (node:internal/stream_base_commons:216:20) {
  errno: -104,
  code: 'ECONNRESET',
  syscall: 'read'
}
```

**优化后：**
```
[HttpProxy] 客户端连接中断: ff6d12b8-470c-4124-9018-137be054c021 (ECONNRESET)
```

**影响文件：**
- `master-server/src/proxy/http-proxy.ts`
- `master-server/src/proxy/socks5-proxy.ts`

---

## 应用修复

### 1. 重新编译

```bash
cd master-server
npm run build
```

### 2. 重启服务

```bash
# 如果使用npm
npm restart

# 如果使用PM2
pm2 restart master-server
```

---

## 测试验证

### IPv6支持测试

```bash
# 测试IPv6地址
curl -v -x http://localhost:8080 https://[2606:4700:4700::1111]:443

# 测试域名（应该也能正常工作）
curl -v -x http://localhost:8080 https://www.google.com

# 测试IPv4
curl -v -x http://localhost:8080 https://8.8.8.8:443
```

### 日志验证

启动服务后，检查日志输出：
- ✅ IPv6地址正确解析
- ✅ 端口号正确提取
- ✅ 网络错误日志简洁清晰
- ✅ 无不必要的堆栈跟踪

---

## 相关问题

这些修复解决了：
1. ✅ IPv6代理连接失败
2. ✅ 日志噪音过多
3. ✅ 端口解析错误

不影响已实施的安全功能：
- ✅ API Key认证
- ✅ 节点白名单
- ✅ TLS/WSS加密
- ✅ 速率限制
- ✅ 审计日志
- ✅ 消息签名
- ✅ JWT认证

---

## 版本信息

- **修复版本：** v2.1.1
- **修复日期：** 2025-12-29
- **影响版本：** v2.0.0 - v2.1.0

---

## 更新日志

### v2.1.1 (2025-12-29)

**Bug修复：**
- 修复IPv6地址在HTTPS CONNECT请求中解析失败的问题
- 修复端口号为null导致连接失败的问题
- 修复速率限制误限制代理数据消息导致正常流量被拒绝的问题

**改进：**
- 优化速率限制逻辑，只限制控制消息，不限制代理数据流
- 优化网络错误日志输出，减少不必要的堆栈跟踪
- 改进错误消息的可读性
- 添加更详细的连接状态日志

**测试：**
- 验证IPv6代理连接
- 验证IPv4和域名连接
- 验证错误日志格式
- 验证高流量场景不触发速率限制
