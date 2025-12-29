# SOCKS5 代理测试指南

## 方法 1：使用 curl（推荐）

### 测试节点直连

```bash
# 通过节点SOCKS5代理
curl --socks5 localhost:1081 http://ipinfo.io/json

# 或者使用完整格式
curl --socks5-hostname localhost:1081 http://ipinfo.io/json
```

### 测试主服务器

```bash
# 通过主服务器SOCKS5代理
curl --socks5 localhost:1080 http://ipinfo.io/json
```

### 测试 HTTPS

```bash
curl --socks5 localhost:1081 https://api.ipify.org?format=json
```

## 方法 2：使用 PowerShell

### Windows PowerShell 脚本

```powershell
# 创建测试脚本
@"
`$proxy = New-Object System.Net.WebProxy("socks5://localhost:1081")
`$request = [System.Net.WebRequest]::Create("http://ipinfo.io/json")
`$request.Proxy = `$proxy
`$response = `$request.GetResponse()
`$reader = New-Object System.IO.StreamReader(`$response.GetResponseStream())
`$reader.ReadToEnd()
"@ | Out-File -Encoding ASCII test-socks5.ps1

# 运行测试
.\test-socks5.ps1
```

## 方法 3：使用 Python

创建文件 `test_socks5.py`：

```python
import requests

proxies = {
    'http': 'socks5://localhost:1081',
    'https': 'socks5://localhost:1081'
}

try:
    # 测试 HTTP
    response = requests.get('http://ipinfo.io/json', proxies=proxies, timeout=10)
    print('HTTP 测试成功:')
    print(response.json())
    
    # 测试 HTTPS
    response = requests.get('https://api.ipify.org?format=json', proxies=proxies, timeout=10)
    print('\nHTTPS 测试成功:')
    print(response.json())
except Exception as e:
    print(f'测试失败: {e}')
```

运行：
```bash
pip install requests[socks]
python test_socks5.py
```

## 方法 4：使用 Node.js

创建文件 `test-socks5.js`：

```javascript
const axios = require('axios');
const { SocksProxyAgent } = require('socks-proxy-agent');

const agent = new SocksProxyAgent('socks5://localhost:1081');

async function testSocks5() {
    try {
        // 测试 HTTP
        console.log('测试 HTTP...');
        const response1 = await axios.get('http://ipinfo.io/json', {
            httpAgent: agent,
            httpsAgent: agent,
            timeout: 10000
        });
        console.log('HTTP 测试成功:');
        console.log(response1.data);
        
        // 测试 HTTPS
        console.log('\n测试 HTTPS...');
        const response2 = await axios.get('https://api.ipify.org?format=json', {
            httpAgent: agent,
            httpsAgent: agent,
            timeout: 10000
        });
        console.log('HTTPS 测试成功:');
        console.log(response2.data);
    } catch (error) {
        console.error('测试失败:', error.message);
    }
}

testSocks5();
```

运行：
```bash
npm install axios socks-proxy-agent
node test-socks5.js
```

## 方法 5：使用浏览器

### Firefox 配置

1. 打开设置 → 网络设置 → 手动代理配置
2. SOCKS Host: `localhost`
3. Port: `1081`（节点）或 `1080`（主服务器）
4. 选择 SOCKS v5
5. 勾选"代理 DNS"
6. 访问 http://ipinfo.io 验证

### Chrome/Edge（命令行）

```bash
# Windows
"C:\Program Files\Google\Chrome\Application\chrome.exe" --proxy-server="socks5://localhost:1081"

# Mac
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --proxy-server="socks5://localhost:1081"

# Linux
google-chrome --proxy-server="socks5://localhost:1081"
```

## 方法 6：使用专用工具

### proxychains（Linux/Mac）

```bash
# 安装
# Ubuntu: sudo apt-get install proxychains4
# Mac: brew install proxychains-ng

# 配置 /etc/proxychains.conf 或 ~/.proxychains/proxychains.conf
# 添加最后一行:
# socks5 127.0.0.1 1081

# 使用
proxychains4 curl http://ipinfo.io/json
proxychains4 wget http://ipinfo.io/json
```

### Proxifier（Windows/Mac）

商业软件，提供图形界面管理SOCKS5代理。

## 方法 7：测试 SSH 隧道

```bash
# 通过SOCKS5代理SSH
ssh -o "ProxyCommand=nc -X 5 -x localhost:1081 %h %p" user@remote-server
```

## 快速测试脚本

### Windows PowerShell

```powershell
# 保存为 test-socks.ps1
Write-Host "=== SOCKS5 代理测试 ===" -ForegroundColor Green
Write-Host ""

Write-Host "测试节点 SOCKS5 (1081)..." -ForegroundColor Yellow
try {
    $result = curl --socks5 localhost:1081 http://ipinfo.io/json 2>&1
    Write-Host "✓ 节点 SOCKS5 工作正常" -ForegroundColor Green
    Write-Host $result
} catch {
    Write-Host "✗ 节点 SOCKS5 测试失败" -ForegroundColor Red
}

Write-Host ""
Write-Host "测试主服务器 SOCKS5 (1080)..." -ForegroundColor Yellow
try {
    $result = curl --socks5 localhost:1080 http://ipinfo.io/json 2>&1
    Write-Host "✓ 主服务器 SOCKS5 工作正常" -ForegroundColor Green
    Write-Host $result
} catch {
    Write-Host "✗ 主服务器 SOCKS5 测试失败" -ForegroundColor Red
}
```

### Linux/Mac Bash

```bash
#!/bin/bash
# 保存为 test-socks.sh

echo "=== SOCKS5 代理测试 ==="
echo ""

echo "测试节点 SOCKS5 (1081)..."
if curl --socks5 localhost:1081 http://ipinfo.io/json 2>&1; then
    echo "✓ 节点 SOCKS5 工作正常"
else
    echo "✗ 节点 SOCKS5 测试失败"
fi

echo ""
echo "测试主服务器 SOCKS5 (1080)..."
if curl --socks5 localhost:1080 http://ipinfo.io/json 2>&1; then
    echo "✓ 主服务器 SOCKS5 工作正常"
else
    echo "✗ 主服务器 SOCKS5 测试失败"
fi
```

## 验证 SOCKS5 是否工作

成功的响应应该包含：

```json
{
  "ip": "xxx.xxx.xxx.xxx",
  "hostname": "...",
  "city": "...",
  "region": "...",
  "country": "...",
  "loc": "...",
  "org": "...",
  "postal": "...",
  "timezone": "..."
}
```

## 常见问题

### 1. curl 不支持 socks5

确保使用较新版本的 curl：
```bash
curl --version  # 检查是否支持 socks5
```

### 2. Python 缺少 SOCKS 支持

```bash
pip install pysocks
# 或
pip install requests[socks]
```

### 3. 连接超时

- 确认代理服务器已启动
- 检查端口号是否正确
- 查看防火墙设置

### 4. DNS 解析问题

使用 `--socks5-hostname` 让 DNS 在代理服务器解析：
```bash
curl --socks5-hostname localhost:1081 http://example.com
```

## 性能测试

```bash
# 测试延迟
time curl --socks5 localhost:1081 http://ipinfo.io/json

# 测试下载速度
curl --socks5 localhost:1081 -o /dev/null http://speedtest.tele2.net/1MB.zip -w "Speed: %{speed_download} bytes/sec\n"
```

## 端口说明

- **1081**: 节点 SOCKS5 端口（直连节点）
- **1080**: 主服务器 SOCKS5 端口（自动路由）

直连节点更快，但主服务器提供负载均衡和故障转移。

