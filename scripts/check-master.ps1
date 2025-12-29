# 检查 Master Server 是否正常运行

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "检查 Master Server 状态" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# 加载 .env 文件（如果存在）
$envFile = ".env"
$masterUrl = "http://localhost:3000"

if (Test-Path $envFile) {
    Write-Host "正在从 .env 读取配置..." -ForegroundColor Yellow
    Get-Content $envFile | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#")) {
            $parts = $line -split '=', 2
            if ($parts.Length -eq 2 -and $parts[0].Trim() -eq "MASTER_URL") {
                $masterUrl = $parts[1].Trim()
            }
        }
    }
}

Write-Host "Master Server URL: $masterUrl" -ForegroundColor White
Write-Host ""

# 1. 检查端口是否被占用
Write-Host "1. 检查端口占用情况" -ForegroundColor Green
Write-Host "-----------------------------------"
$port = 3000
if ($masterUrl -match ':(\d+)') {
    $port = $matches[1]
}

$connection = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
if ($connection) {
    $process = Get-Process -Id $connection.OwningProcess -ErrorAction SilentlyContinue
    Write-Host "✓ 端口 $port 已被占用" -ForegroundColor Green
    if ($process) {
        Write-Host "  进程: $($process.ProcessName) (PID: $($process.Id))" -ForegroundColor Gray
    }
} else {
    Write-Host "✗ 端口 $port 未被占用" -ForegroundColor Red
    Write-Host "  Master Server 可能未启动！" -ForegroundColor Yellow
}
Write-Host ""

# 2. 尝试连接 Master Server API
Write-Host "2. 测试 API 连接" -ForegroundColor Green
Write-Host "-----------------------------------"
Write-Host "请求: GET $masterUrl/api/nodes" -ForegroundColor Gray

try {
    $response = Invoke-WebRequest -Uri "$masterUrl/api/nodes" -Method Get -TimeoutSec 5 -ErrorAction Stop
    Write-Host "✓ API 连接成功" -ForegroundColor Green
    Write-Host "  状态码: $($response.StatusCode)" -ForegroundColor Gray
    
    # 解析响应
    $data = $response.Content | ConvertFrom-Json
    if ($data.success) {
        Write-Host "  已注册节点数: $($data.nodes.Count)" -ForegroundColor Gray
    }
} catch {
    Write-Host "✗ API 连接失败" -ForegroundColor Red
    Write-Host "  错误: $($_.Exception.Message)" -ForegroundColor Yellow
    
    if ($_.Exception.Message -like "*无法连接*" -or $_.Exception.Message -like "*refused*") {
        Write-Host ""
        Write-Host "可能的原因：" -ForegroundColor Yellow
        Write-Host "  1. Master Server 未启动" -ForegroundColor Gray
        Write-Host "  2. Master Server 启动在不同的端口" -ForegroundColor Gray
        Write-Host "  3. 防火墙阻止了连接" -ForegroundColor Gray
    }
}
Write-Host ""

# 3. 测试注册端点
Write-Host "3. 测试节点注册 API" -ForegroundColor Green
Write-Host "-----------------------------------"
Write-Host "请求: POST $masterUrl/api/nodes/register" -ForegroundColor Gray

$testData = @{
    name = "test-node"
    region = "test"
    httpPort = 9999
    socks5Port = 9998
    capabilities = @("http", "socks5")
    host = "localhost"
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "$masterUrl/api/nodes/register" -Method Post -Body $testData -ContentType "application/json" -TimeoutSec 5 -ErrorAction Stop
    Write-Host "✓ 注册 API 可访问" -ForegroundColor Green
    Write-Host "  状态码: $($response.StatusCode)" -ForegroundColor Gray
    
    # 立即注销测试节点
    $responseData = $response.Content | ConvertFrom-Json
    if ($responseData.nodeId) {
        try {
            Invoke-WebRequest -Uri "$masterUrl/api/nodes/$($responseData.nodeId)" -Method Delete -TimeoutSec 5 -ErrorAction SilentlyContinue | Out-Null
            Write-Host "  测试节点已清理" -ForegroundColor Gray
        } catch {
            # 忽略错误
        }
    }
} catch {
    Write-Host "✗ 注册 API 失败" -ForegroundColor Red
    Write-Host "  状态码: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Yellow
    Write-Host "  错误: $($_.Exception.Message)" -ForegroundColor Yellow
}
Write-Host ""

# 4. 建议
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "诊断完成" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

if ($connection -and $response) {
    Write-Host "✓ Master Server 运行正常！" -ForegroundColor Green
    Write-Host ""
    Write-Host "如果 Node Server 仍无法连接，请检查：" -ForegroundColor White
    Write-Host "  1. Node Server 的 .env 配置中 MASTER_URL 是否正确" -ForegroundColor Gray
    Write-Host "  2. 如果在不同机器上，确保网络可以互通" -ForegroundColor Gray
    Write-Host "  3. 查看 Node Server 的详细错误日志" -ForegroundColor Gray
} elseif (-not $connection) {
    Write-Host "✗ Master Server 未运行" -ForegroundColor Red
    Write-Host ""
    Write-Host "请先启动 Master Server：" -ForegroundColor White
    Write-Host "  npm run start:master" -ForegroundColor Gray
    Write-Host ""
    Write-Host "或者：" -ForegroundColor White
    Write-Host "  pnpm start:master" -ForegroundColor Gray
} else {
    Write-Host "⚠ Master Server 可能存在问题" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "建议：" -ForegroundColor White
    Write-Host "  1. 检查 Master Server 的日志" -ForegroundColor Gray
    Write-Host "  2. 尝试重启 Master Server" -ForegroundColor Gray
    Write-Host "  3. 检查防火墙设置" -ForegroundColor Gray
}

Write-Host ""
