# ProxyNode HTTP 代理测试脚本 (使用 .env 配置)
# 此脚本从 .env 文件读取配置

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "ProxyNode HTTP 代理测试" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# 加载 .env 文件
$envFile = ".env"
if (-Not (Test-Path $envFile)) {
    Write-Host "错误: 未找到 .env 文件" -ForegroundColor Red
    Write-Host "请复制 env.example 为 .env 并配置相关参数" -ForegroundColor Yellow
    exit 1
}

# 读取 .env 文件并解析环境变量
Write-Host "正在加载配置..." -ForegroundColor Yellow
$envVars = @{}
Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()
    # 跳过注释和空行
    if ($line -and -not $line.StartsWith("#")) {
        $parts = $line -split '=', 2
        if ($parts.Length -eq 2) {
            $key = $parts[0].Trim()
            $value = $parts[1].Trim()
            $envVars[$key] = $value
        }
    }
}

# 获取配置
$masterHost = if ($envVars["MASTER_HOST"]) { $envVars["MASTER_HOST"] } else { "localhost" }
$httpPort = if ($envVars["MASTER_HTTP_PROXY_PORT"]) { $envVars["MASTER_HTTP_PROXY_PORT"] } else { "8080" }
$socks5Port = if ($envVars["MASTER_SOCKS5_PROXY_PORT"]) { $envVars["MASTER_SOCKS5_PROXY_PORT"] } else { "1080" }

Write-Host "配置信息:" -ForegroundColor Green
Write-Host "  Master Host: $masterHost" -ForegroundColor Gray
Write-Host "  HTTP 代理端口: $httpPort" -ForegroundColor Gray
Write-Host "  SOCKS5 代理端口: $socks5Port" -ForegroundColor Gray
Write-Host ""

# 测试 HTTP 代理
Write-Host "1. 测试 HTTP 代理" -ForegroundColor Green
Write-Host "-----------------------------------"
Write-Host "代理地址: http://${masterHost}:${httpPort}" -ForegroundColor Yellow
Write-Host ""

# 测试基本连接
Write-Host "测试目标: http://ipinfo.io/json" -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://ipinfo.io/json" -Proxy "http://${masterHost}:${httpPort}" -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-Host "✓ 连接成功" -ForegroundColor Green
        $json = $response.Content | ConvertFrom-Json
        Write-Host "  IP: $($json.ip)" -ForegroundColor White
        Write-Host "  地区: $($json.city), $($json.region), $($json.country)" -ForegroundColor White
        Write-Host "  组织: $($json.org)" -ForegroundColor White
    }
} catch {
    Write-Host "✗ 连接失败: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# 测试 HTTPS 代理 (通过 HTTP CONNECT)
Write-Host "2. 测试 HTTPS 代理" -ForegroundColor Green
Write-Host "-----------------------------------"
Write-Host "测试目标: https://api.ipify.org?format=json" -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "https://api.ipify.org?format=json" -Proxy "http://${masterHost}:${httpPort}" -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-Host "✓ 连接成功" -ForegroundColor Green
        $json = $response.Content | ConvertFrom-Json
        Write-Host "  IP: $($json.ip)" -ForegroundColor White
    }
} catch {
    Write-Host "✗ 连接失败: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# 提供 curl 测试命令
Write-Host "3. 使用 curl 测试 (如果已安装)" -ForegroundColor Green
Write-Host "-----------------------------------"
Write-Host "HTTP 代理:" -ForegroundColor Yellow
Write-Host "  curl -x http://${masterHost}:${httpPort} http://ipinfo.io/json" -ForegroundColor Gray
Write-Host ""
Write-Host "HTTPS 代理:" -ForegroundColor Yellow
Write-Host "  curl -x http://${masterHost}:${httpPort} https://api.ipify.org?format=json" -ForegroundColor Gray
Write-Host ""

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "测试完成！" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
