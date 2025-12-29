# ProxyNode 网络诊断脚本
# 用于检查网络配置和连通性

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "ProxyNode 网络诊断工具" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# 1. 获取本机 IP 地址
Write-Host "1. 本机网络信息" -ForegroundColor Green
Write-Host "-----------------------------------"
$NetworkAdapters = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notlike "*Loopback*" }
foreach ($adapter in $NetworkAdapters) {
    Write-Host "  接口: $($adapter.InterfaceAlias)" -ForegroundColor Yellow
    Write-Host "  IP 地址: $($adapter.IPAddress)" -ForegroundColor White
    Write-Host ""
}

# 2. 检查端口占用
Write-Host "2. 端口占用情况" -ForegroundColor Green
Write-Host "-----------------------------------"
$ports = @(3000, 8080, 1080, 8081, 1081)
foreach ($port in $ports) {
    $connection = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($connection) {
        $process = Get-Process -Id $connection.OwningProcess -ErrorAction SilentlyContinue
        Write-Host "  端口 $port : " -NoNewline
        Write-Host "已被占用" -ForegroundColor Yellow -NoNewline
        if ($process) {
            Write-Host " (进程: $($process.ProcessName))" -ForegroundColor Gray
        } else {
            Write-Host ""
        }
    } else {
        Write-Host "  端口 $port : " -NoNewline
        Write-Host "空闲" -ForegroundColor Green
    }
}
Write-Host ""

# 3. 检查防火墙规则
Write-Host "3. 防火墙规则检查" -ForegroundColor Green
Write-Host "-----------------------------------"
$firewallRules = @(
    @{Name="ProxyNode API"; Port=3000},
    @{Name="ProxyNode HTTP Proxy"; Port=8080},
    @{Name="ProxyNode SOCKS5 Proxy"; Port=1080}
)

foreach ($rule in $firewallRules) {
    $existingRule = Get-NetFirewallRule -DisplayName $rule.Name -ErrorAction SilentlyContinue
    if ($existingRule) {
        Write-Host "  $($rule.Name) (端口 $($rule.Port)): " -NoNewline
        Write-Host "已配置" -ForegroundColor Green
    } else {
        Write-Host "  $($rule.Name) (端口 $($rule.Port)): " -NoNewline
        Write-Host "未配置" -ForegroundColor Red
    }
}
Write-Host ""

# 4. 测试服务器连通性（可选）
Write-Host "4. 服务器连通性测试" -ForegroundColor Green
Write-Host "-----------------------------------"
$serverIP = Read-Host "请输入 Master Server 的 IP 地址 (按 Enter 跳过)"
if ($serverIP) {
    Write-Host "  正在测试连接到 $serverIP..." -ForegroundColor Yellow
    
    # Ping 测试
    $pingResult = Test-Connection -ComputerName $serverIP -Count 2 -Quiet
    Write-Host "  Ping 测试: " -NoNewline
    if ($pingResult) {
        Write-Host "成功" -ForegroundColor Green
    } else {
        Write-Host "失败" -ForegroundColor Red
    }
    
    # 端口测试
    $testPorts = @(3000, 8080, 1080)
    foreach ($port in $testPorts) {
        Write-Host "  端口 $port : " -NoNewline
        $tcpResult = Test-NetConnection -ComputerName $serverIP -Port $port -WarningAction SilentlyContinue
        if ($tcpResult.TcpTestSucceeded) {
            Write-Host "开放" -ForegroundColor Green
        } else {
            Write-Host "关闭或被防火墙阻止" -ForegroundColor Red
        }
    }
}
Write-Host ""

# 5. 配置文件检查
Write-Host "5. 配置文件检查" -ForegroundColor Green
Write-Host "-----------------------------------"
$configFiles = @(
    ".\master-server\config.json",
    ".\node-sdk\config.json"
)

foreach ($configFile in $configFiles) {
    if (Test-Path $configFile) {
        Write-Host "  $configFile : " -NoNewline
        Write-Host "存在" -ForegroundColor Green
        
        # 读取并显示关键配置
        $config = Get-Content $configFile -Raw | ConvertFrom-Json
        if ($configFile -like "*node-sdk*") {
            Write-Host "    Master URL: $($config.master.url)" -ForegroundColor Gray
            Write-Host "    Master WS URL: $($config.master.wsUrl)" -ForegroundColor Gray
            Write-Host "    节点 HTTP 端口: $($config.node.httpPort)" -ForegroundColor Gray
            Write-Host "    节点 SOCKS5 端口: $($config.node.socks5Port)" -ForegroundColor Gray
        } else {
            Write-Host "    API 端口: $($config.server.port)" -ForegroundColor Gray
            Write-Host "    HTTP 代理端口: $($config.server.proxyHttpPort)" -ForegroundColor Gray
            Write-Host "    SOCKS5 代理端口: $($config.server.proxySocks5Port)" -ForegroundColor Gray
        }
    } else {
        Write-Host "  $configFile : " -NoNewline
        Write-Host "不存在" -ForegroundColor Red
    }
    Write-Host ""
}

# 6. 建议
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "诊断完成！" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "💡 建议：" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. 如果您是 Master Server（服务器）：" -ForegroundColor White
Write-Host "   - 确保防火墙已开放端口 3000, 8080, 1080" -ForegroundColor Gray
Write-Host "   - 确保服务器监听在 0.0.0.0" -ForegroundColor Gray
Write-Host "   - 记录服务器的公网/内网 IP 地址" -ForegroundColor Gray
Write-Host ""
Write-Host "2. 如果您是 Node Server（本地电脑）：" -ForegroundColor White
Write-Host "   - 修改 node-sdk/config.json 中的 Master URL" -ForegroundColor Gray
Write-Host "   - 将 localhost 改为服务器的实际 IP" -ForegroundColor Gray
Write-Host "   - 确保可以 ping 通服务器" -ForegroundColor Gray
Write-Host ""
Write-Host "3. 手机代理配置：" -ForegroundColor White
Write-Host "   - HTTP 代理: 服务器IP:8080" -ForegroundColor Gray
Write-Host "   - SOCKS5 代理: 服务器IP:1080" -ForegroundColor Gray
Write-Host ""
Write-Host "详细故障排除指南请查看 TROUBLESHOOTING.md" -ForegroundColor Cyan
Write-Host ""
