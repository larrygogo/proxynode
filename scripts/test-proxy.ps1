# Resi Proxy 测试脚本 (PowerShell)

Write-Host "=== ProxyNode 测试脚本 ===" -ForegroundColor Green
Write-Host ""

# 测试健康检查
Write-Host "1. 测试主服务器健康检查..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "http://localhost:3000/health" -Method Get
    Write-Host "✓ 主服务器运行正常" -ForegroundColor Green
    Write-Host "  状态: $($health.status)"
    Write-Host "  在线节点数: $($health.nodes.online)"
    Write-Host ""
} catch {
    Write-Host "✗ 主服务器未启动或无法访问" -ForegroundColor Red
    Write-Host "  请先运行: npm run start:master" -ForegroundColor Yellow
    Write-Host ""
}

# 测试节点列表
Write-Host "2. 获取节点列表..." -ForegroundColor Yellow
try {
    $nodes = Invoke-RestMethod -Uri "http://localhost:3000/api/nodes" -Method Get
    Write-Host "✓ 成功获取节点列表" -ForegroundColor Green
    Write-Host "  节点总数: $($nodes.count)"
    
    if ($nodes.data) {
        foreach ($node in $nodes.data) {
            Write-Host "  - $($node.name) ($($node.nodeId))"
            Write-Host "    状态: $($node.status.status)"
            Write-Host "    连接数: $($node.status.connections)"
            Write-Host "    区域: $($node.region)"
        }
    }
    Write-Host ""
} catch {
    Write-Host "✗ 无法获取节点列表" -ForegroundColor Red
    Write-Host ""
}

# 测试 HTTP 代理（通过节点）
Write-Host "3. 测试节点 HTTP 代理..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://httpbin.org/ip" -Proxy "http://localhost:8081" -UseBasicParsing -TimeoutSec 10
    Write-Host "✓ 节点 HTTP 代理工作正常" -ForegroundColor Green
    Write-Host "  响应状态码: $($response.StatusCode)"
    Write-Host ""
} catch {
    Write-Host "✗ 节点 HTTP 代理测试失败" -ForegroundColor Red
    Write-Host "  请确认节点服务器已启动: npm run start:node" -ForegroundColor Yellow
    Write-Host ""
}

# 测试 HTTP 代理（通过主服务器）
Write-Host "4. 测试主服务器 HTTP 代理..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://httpbin.org/ip" -Proxy "http://localhost:8080" -UseBasicParsing -TimeoutSec 10
    Write-Host "✓ 主服务器 HTTP 代理工作正常" -ForegroundColor Green
    Write-Host "  响应状态码: $($response.StatusCode)"
    Write-Host ""
} catch {
    Write-Host "✗ 主服务器 HTTP 代理测试失败" -ForegroundColor Red
    Write-Host ""
}

Write-Host "=== 测试完成 ===" -ForegroundColor Green
Write-Host ""
Write-Host "提示:" -ForegroundColor Cyan
Write-Host "- 主服务器 API: http://localhost:3000/api"
Write-Host "- 主服务器 HTTP 代理: http://localhost:8080"
Write-Host "- 主服务器 SOCKS5 代理: socks5://localhost:1080"
Write-Host "- 节点 HTTP 代理: http://localhost:8081"
Write-Host "- 节点 SOCKS5 代理: socks5://localhost:1081"
Write-Host ""

