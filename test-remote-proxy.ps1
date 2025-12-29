# ProxyNode 远程代理测试脚本
# 从 .env 文件读取配置

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "ProxyNode 远程代理测试" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# 加载 .env 文件
$envFile = ".env"
$masterUrl = "http://47.110.58.130:3000"
$httpProxyPort = "8080"
$socks5ProxyPort = "1080"

if (Test-Path $envFile) {
    Write-Host "正在从 .env 读取配置..." -ForegroundColor Yellow
    Get-Content $envFile | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#")) {
            $parts = $line -split '=', 2
            if ($parts.Length -eq 2) {
                $key = $parts[0].Trim()
                $value = $parts[1].Trim()
                if ($key -eq "MASTER_URL") {
                    $masterUrl = $value
                }
            }
        }
    }
    Write-Host "Master URL: $masterUrl" -ForegroundColor Gray
    Write-Host ""
}

# 提取服务器地址和端口
if ($masterUrl -match "http://([^:]+):(\d+)") {
    $serverHost = $matches[1]
    $serverPort = $matches[2]
} else {
    Write-Host "无法解析 Master URL: $masterUrl" -ForegroundColor Red
    exit 1
}

# 1. 测试 Master Server API
Write-Host "1. 测试 Master Server API" -ForegroundColor Green
Write-Host "-----------------------------------"
Write-Host "URL: $masterUrl/api/nodes" -ForegroundColor Gray

try {
    $response = Invoke-WebRequest -Uri "$masterUrl/api/nodes" -Method Get -TimeoutSec 10
    Write-Host "✓ Master Server API 正常" -ForegroundColor Green
    Write-Host "  状态码: $($response.StatusCode)" -ForegroundColor Gray
    
    $data = $response.Content | ConvertFrom-Json
    if ($data.success) {
        Write-Host "  已注册节点数: $($data.nodes.Count)" -ForegroundColor Gray
        foreach ($node in $data.nodes) {
            $status = if ($node.status -eq "online") { "🟢" } else { "🔴" }
            Write-Host "    $status $($node.name) - $($node.publicIp)" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "✗ 无法连接到 Master Server" -ForegroundColor Red
    Write-Host "  错误: $($_.Exception.Message)" -ForegroundColor Yellow
}
Write-Host ""

# 2. 测试 HTTP 代理
Write-Host "2. 测试 HTTP 代理" -ForegroundColor Green
Write-Host "-----------------------------------"
Write-Host "代理地址: http://${serverHost}:${httpProxyPort}" -ForegroundColor Gray
Write-Host "测试 URL: http://ipinfo.io/json" -ForegroundColor Gray

try {
    $response = Invoke-WebRequest -Uri "http://ipinfo.io/json" -Proxy "http://${serverHost}:${httpProxyPort}" -TimeoutSec 15
    if ($response.StatusCode -eq 200) {
        Write-Host "✓ HTTP 代理工作正常" -ForegroundColor Green
        Write-Host "  状态码: $($response.StatusCode)" -ForegroundColor Gray
        
        $json = $response.Content | ConvertFrom-Json
        Write-Host "  代理 IP: $($json.ip)" -ForegroundColor Gray
        Write-Host "  位置: $($json.city), $($json.region), $($json.country)" -ForegroundColor Gray
    }
} catch {
    Write-Host "✗ HTTP 代理测试失败" -ForegroundColor Red
    Write-Host "  错误: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "可能的原因：" -ForegroundColor Yellow
    Write-Host "  1. Master Server 未重启（需要重新构建后重启）" -ForegroundColor Gray
    Write-Host "  2. 节点未正确连接" -ForegroundColor Gray
    Write-Host "  3. 防火墙阻止了连接" -ForegroundColor Gray
}
Write-Host ""

# 3. 测试 HTTPS 代理
Write-Host "3. 测试 HTTPS 代理" -ForegroundColor Green
Write-Host "-----------------------------------"
Write-Host "代理地址: http://${serverHost}:${httpProxyPort}" -ForegroundColor Gray
Write-Host "测试 URL: https://api.ipify.org?format=json" -ForegroundColor Gray

try {
    $response = Invoke-WebRequest -Uri "https://api.ipify.org?format=json" -Proxy "http://${serverHost}:${httpProxyPort}" -TimeoutSec 15
    if ($response.StatusCode -eq 200) {
        Write-Host "✓ HTTPS 代理工作正常" -ForegroundColor Green
        Write-Host "  状态码: $($response.StatusCode)" -ForegroundColor Gray
        
        $json = $response.Content | ConvertFrom-Json
        Write-Host "  代理 IP: $($json.ip)" -ForegroundColor Gray
    }
} catch {
    Write-Host "✗ HTTPS 代理测试失败" -ForegroundColor Red
    Write-Host "  错误: $($_.Exception.Message)" -ForegroundColor Yellow
}
Write-Host ""

# 4. 使用 curl 测试 SOCKS5（如果安装了 curl）
Write-Host "4. 测试 SOCKS5 代理 (使用 curl)" -ForegroundColor Green
Write-Host "-----------------------------------"
Write-Host "代理地址: ${serverHost}:${socks5ProxyPort}" -ForegroundColor Gray

if (Get-Command curl.exe -ErrorAction SilentlyContinue) {
    Write-Host "测试命令: curl.exe --socks5 ${serverHost}:${socks5ProxyPort} http://ipinfo.io/json" -ForegroundColor Gray
    
    try {
        $result = & curl.exe --socks5 "${serverHost}:${socks5ProxyPort}" http://ipinfo.io/json --connect-timeout 15 --silent --show-error 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ SOCKS5 代理工作正常" -ForegroundColor Green
            $json = $result | ConvertFrom-Json
            Write-Host "  代理 IP: $($json.ip)" -ForegroundColor Gray
            Write-Host "  位置: $($json.city), $($json.region), $($json.country)" -ForegroundColor Gray
        } else {
            Write-Host "✗ SOCKS5 代理测试失败" -ForegroundColor Red
            Write-Host "  $result" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "✗ SOCKS5 代理测试失败" -ForegroundColor Red
        Write-Host "  错误: $($_.Exception.Message)" -ForegroundColor Yellow
    }
} else {
    Write-Host "⚠ curl.exe 未安装，跳过 SOCKS5 测试" -ForegroundColor Yellow
    Write-Host "  手动测试命令: curl.exe --socks5 ${serverHost}:${socks5ProxyPort} http://ipinfo.io/json" -ForegroundColor Gray
}
Write-Host ""

# 5. 监控面板
Write-Host "5. 监控面板" -ForegroundColor Green
Write-Host "-----------------------------------"
Write-Host "在浏览器中打开: $masterUrl/dashboard.html" -ForegroundColor Cyan
Write-Host ""

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "测试完成" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "💡 提示：" -ForegroundColor Yellow
Write-Host "  - 如果代理测试失败，请确保 Master Server 已重新构建并重启" -ForegroundColor Gray
Write-Host "  - 检查节点是否在线: $masterUrl/dashboard.html" -ForegroundColor Gray
Write-Host "  - 查看 Master Server 日志以获取详细错误信息" -ForegroundColor Gray
Write-Host ""
