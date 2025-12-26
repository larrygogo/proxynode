# 查看节点信息脚本

Write-Host "=== Resi Proxy 节点信息 ===" -ForegroundColor Cyan
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/nodes" -Method Get
    
    if ($response.success -and $response.count -gt 0) {
        Write-Host "找到 $($response.count) 个节点：" -ForegroundColor Green
        Write-Host ""
        
        foreach ($node in $response.data) {
            Write-Host "节点: $($node.name)" -ForegroundColor Yellow
            Write-Host "  ID: $($node.nodeId)"
            Write-Host "  区域: $($node.region)"
            Write-Host "  状态: $($node.status.status)" -ForegroundColor $(if ($node.status.status -eq "online") { "Green" } else { "Red" })
            Write-Host "  地址: $($node.host):$($node.httpPort) (HTTP), $($node.host):$($node.socks5Port) (SOCKS5)"
            Write-Host "  能力: $($node.capabilities -join ', ')"
            Write-Host "  连接数: $($node.status.connections)"
            Write-Host "  带宽: ↑ $([math]::Round($node.status.bandwidth.upload/1024, 2)) KB/s  ↓ $([math]::Round($node.status.bandwidth.download/1024, 2)) KB/s"
            Write-Host "  负载: CPU $($node.status.load.cpu)%  内存 $($node.status.load.memory)%"
            Write-Host "  注册时间: $($node.registeredAt)"
            Write-Host "  最后心跳: $($node.lastHeartbeat)"
            Write-Host ""
        }
        
        # 显示汇总统计
        $onlineCount = ($response.data | Where-Object { $_.status.status -eq "online" }).Count
        $offlineCount = $response.count - $onlineCount
        $totalConnections = ($response.data | Measure-Object -Property { $_.status.connections } -Sum).Sum
        
        Write-Host "=== 统计 ===" -ForegroundColor Cyan
        Write-Host "在线节点: $onlineCount" -ForegroundColor Green
        Write-Host "离线节点: $offlineCount" -ForegroundColor $(if ($offlineCount -gt 0) { "Red" } else { "Gray" })
        Write-Host "总连接数: $totalConnections"
        
    } else {
        Write-Host "当前没有注册的节点" -ForegroundColor Yellow
        Write-Host "请先启动节点服务器: npm run start:node" -ForegroundColor Cyan
    }
    
} catch {
    Write-Host "无法连接到主服务器" -ForegroundColor Red
    Write-Host "错误: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "请确认主服务器已启动: npm run start:master" -ForegroundColor Yellow
}

Write-Host ""

