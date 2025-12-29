# SOCKS5 代理快速测试脚本

Write-Host "=== Resi Proxy SOCKS5 测试 ===" -ForegroundColor Cyan
Write-Host ""

# 测试节点 SOCKS5
Write-Host "1. 测试节点 SOCKS5 代理 (localhost:1081)..." -ForegroundColor Yellow
Write-Host ""

try {
    $startTime = Get-Date
    $response = curl --socks5 localhost:1081 -s http://ipinfo.io/json 2>&1
    $endTime = Get-Date
    $duration = ($endTime - $startTime).TotalMilliseconds
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ 节点 SOCKS5 测试成功" -ForegroundColor Green
        Write-Host "  响应时间: $([math]::Round($duration, 2)) ms" -ForegroundColor Gray
        Write-Host "  响应内容:" -ForegroundColor Gray
        $response | ConvertFrom-Json | Format-List
    } else {
        Write-Host "✗ 节点 SOCKS5 测试失败" -ForegroundColor Red
        Write-Host "  错误: $response" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ 节点 SOCKS5 测试失败" -ForegroundColor Red
    Write-Host "  错误: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "---" -ForegroundColor Gray
Write-Host ""

# 测试主服务器 SOCKS5
Write-Host "2. 测试主服务器 SOCKS5 代理 (localhost:1080)..." -ForegroundColor Yellow
Write-Host ""

try {
    $startTime = Get-Date
    $response = curl --socks5 localhost:1080 -s http://ipinfo.io/json 2>&1
    $endTime = Get-Date
    $duration = ($endTime - $startTime).TotalMilliseconds
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ 主服务器 SOCKS5 测试成功" -ForegroundColor Green
        Write-Host "  响应时间: $([math]::Round($duration, 2)) ms" -ForegroundColor Gray
        Write-Host "  响应内容:" -ForegroundColor Gray
        $response | ConvertFrom-Json | Format-List
    } else {
        Write-Host "✗ 主服务器 SOCKS5 测试失败" -ForegroundColor Red
        Write-Host "  错误: $response" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ 主服务器 SOCKS5 测试失败" -ForegroundColor Red
    Write-Host "  错误: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "---" -ForegroundColor Gray
Write-Host ""

# 测试 HTTPS
Write-Host "3. 测试 HTTPS 通过 SOCKS5..." -ForegroundColor Yellow
Write-Host ""

try {
    $response = curl --socks5 localhost:1081 -s https://api.ipify.org?format=json 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ HTTPS 测试成功" -ForegroundColor Green
        Write-Host "  响应内容:" -ForegroundColor Gray
        $response | ConvertFrom-Json | Format-List
    } else {
        Write-Host "✗ HTTPS 测试失败" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ HTTPS 测试失败" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== 测试完成 ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "端口说明:" -ForegroundColor Gray
Write-Host "  - 1081: 节点 SOCKS5 端口（直连）" -ForegroundColor Gray
Write-Host "  - 1080: 主服务器 SOCKS5 端口（负载均衡）" -ForegroundColor Gray
Write-Host ""

