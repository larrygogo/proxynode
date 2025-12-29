#!/bin/bash
# 查看节点信息脚本

echo "=== Resi Proxy 节点信息 ==="
echo ""

if ! curl -s http://localhost:3000/api/nodes > /dev/null 2>&1; then
    echo "✗ 无法连接到主服务器"
    echo "请确认主服务器已启动: npm run start:master"
    exit 1
fi

# 获取节点信息
response=$(curl -s http://localhost:3000/api/nodes)

# 检查是否有 jq 命令
if command -v jq &> /dev/null; then
    # 使用 jq 格式化输出
    echo "$response" | jq -r '
        if .success and .count > 0 then
            "找到 \(.count) 个节点：\n",
            (.data[] | 
                "\n节点: \(.name)",
                "  ID: \(.nodeId)",
                "  区域: \(.region)",
                "  状态: \(.status.status)",
                "  地址: \(.host):\(.httpPort) (HTTP), \(.host):\(.socks5Port) (SOCKS5)",
                "  能力: \(.capabilities | join(", "))",
                "  连接数: \(.status.connections)",
                "  带宽: ↑ \((.status.bandwidth.upload/1024)|floor) KB/s  ↓ \((.status.bandwidth.download/1024)|floor) KB/s",
                "  负载: CPU \(.status.load.cpu)%  内存 \(.status.load.memory)%",
                "  注册时间: \(.registeredAt)",
                "  最后心跳: \(.lastHeartbeat)"
            ),
            "\n=== 统计 ===",
            "在线节点: \([.data[] | select(.status.status == "online")] | length)",
            "离线节点: \([.data[] | select(.status.status != "online")] | length)",
            "总连接数: \([.data[].status.connections] | add)"
        else
            "当前没有注册的节点\n请先启动节点服务器: npm run start:node"
        end
    '
else
    # 没有 jq，使用简单输出
    echo "$response"
    echo ""
    echo "提示: 安装 jq 可以获得更好的格式化输出"
    echo "  Ubuntu/Debian: sudo apt-get install jq"
    echo "  Mac: brew install jq"
fi

echo ""

