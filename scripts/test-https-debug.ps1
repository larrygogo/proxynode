# HTTPS 代理调试脚本
# 测试 HTTPS 代理的详细错误信息

$ErrorActionPreference = "Continue"

Write-Host "=================================="
Write-Host "HTTPS 代理详细调试"
Write-Host "=================================="
Write-Host ""

# 从 .env 读取配置
$envFile = ".env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]*)\s*=\s*(.*)') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
}

$masterUrl = $env:MASTER_URL
if (-not $masterUrl) {
    $masterUrl = "http://localhost:3000"
}

$proxyUrl = $masterUrl -replace ":\d+$", ":8080"
$proxyHost = ($masterUrl -replace "http://", "") -replace ":\d+$", ""
$proxyPort = 8080

Write-Host "1. 测试基本 HTTPS 请求（通过代理）"
Write-Host "-----------------------------------"
Write-Host "代理: ${proxyHost}:${proxyPort}"
Write-Host ""

# 测试 1：使用 Invoke-WebRequest
Write-Host "测试 1: 使用 PowerShell Invoke-WebRequest" -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "https://api.ipify.org?format=json" `
        -Proxy "http://${proxyHost}:${proxyPort}" `
        -ProxyUseDefaultCredentials `
        -TimeoutSec 30 `
        -UseBasicParsing `
        -Verbose `
        -ErrorAction Stop
    
    Write-Host "✓ 成功" -ForegroundColor Green
    Write-Host "  状态码: $($response.StatusCode)"
    Write-Host "  响应: $($response.Content)"
} catch {
    Write-Host "✗ 失败" -ForegroundColor Red
    Write-Host "  错误类型: $($_.Exception.GetType().FullName)"
    Write-Host "  错误消息: $($_.Exception.Message)"
    if ($_.Exception.InnerException) {
        Write-Host "  内部错误: $($_.Exception.InnerException.Message)"
    }
}

Write-Host ""

# 测试 2：使用 curl
Write-Host "测试 2: 使用 curl" -ForegroundColor Cyan
try {
    $curlOutput = curl.exe -x "http://${proxyHost}:${proxyPort}" `
        "https://api.ipify.org?format=json" `
        --verbose `
        --max-time 30 `
        2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ 成功" -ForegroundColor Green
        Write-Host "  响应: $curlOutput"
    } else {
        Write-Host "✗ 失败 (退出码: $LASTEXITCODE)" -ForegroundColor Red
        Write-Host "  输出: $curlOutput"
    }
} catch {
    Write-Host "✗ 失败" -ForegroundColor Red
    Write-Host "  错误: $($_.Exception.Message)"
}

Write-Host ""

# 测试 3：测试 CONNECT 方法
Write-Host "测试 3: 测试其他 HTTPS 网站" -ForegroundColor Cyan
Write-Host ""

$testUrls = @(
    "https://www.google.com",
    "https://httpbin.org/get",
    "https://example.com"
)

foreach ($url in $testUrls) {
    Write-Host "  测试: $url"
    try {
        $response = Invoke-WebRequest -Uri $url `
            -Proxy "http://${proxyHost}:${proxyPort}" `
            -TimeoutSec 10 `
            -UseBasicParsing `
            -ErrorAction Stop
        Write-Host "    ✓ 成功 (状态码: $($response.StatusCode))" -ForegroundColor Green
    } catch {
        Write-Host "    ✗ 失败: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""

# 测试 4：检查节点状态
Write-Host "4. 检查节点状态"
Write-Host "-----------------------------------"
try {
    $nodesResponse = Invoke-RestMethod -Uri "$masterUrl/api/nodes" -TimeoutSec 10
    if ($nodesResponse.success -and $nodesResponse.nodes) {
        Write-Host "节点数量: $($nodesResponse.nodes.Count)"
        foreach ($node in $nodesResponse.nodes) {
            Write-Host ""
            Write-Host "节点: $($node.name)"
            Write-Host "  状态: $($node.status.status)"
            Write-Host "  连接数: $($node.status.connections)"
            Write-Host "  HTTP 端口: $($node.httpPort)"
        }
    } else {
        Write-Host "⚠ 没有在线节点" -ForegroundColor Yellow
    }
} catch {
    Write-Host "✗ 无法获取节点信息: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "=================================="
Write-Host "调试完成"
Write-Host "=================================="
Write-Host ""
Write-Host "💡 建议："
Write-Host "  1. 如果 curl 成功但 PowerShell 失败，可能是 .NET SSL 配置问题"
Write-Host "  2. 如果所有测试都失败，检查 Master Server 的 CONNECT 处理逻辑"
Write-Host "  3. 查看 Master Server 和 Node Server 的日志"
Write-Host "  4. 确保至少有一个节点在线"
Write-Host ""
