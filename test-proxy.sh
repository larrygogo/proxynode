#!/bin/bash
# Resi Proxy 测试脚本 (Bash)

echo "=== ProxyNode 测试脚本 ==="
echo ""

# 测试健康检查
echo "1. 测试主服务器健康检查..."
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo "✓ 主服务器运行正常"
    curl -s http://localhost:3000/health | jq '.'
else
    echo "✗ 主服务器未启动或无法访问"
    echo "  请先运行: npm run start:master"
fi
echo ""

# 测试节点列表
echo "2. 获取节点列表..."
if curl -s http://localhost:3000/api/nodes > /dev/null 2>&1; then
    echo "✓ 成功获取节点列表"
    curl -s http://localhost:3000/api/nodes | jq '.'
else
    echo "✗ 无法获取节点列表"
fi
echo ""

# 测试 HTTP 代理（通过节点）
echo "3. 测试节点 HTTP 代理..."
if curl -x http://localhost:8081 -s http://httpbin.org/ip > /dev/null 2>&1; then
    echo "✓ 节点 HTTP 代理工作正常"
    curl -x http://localhost:8081 -s http://httpbin.org/ip
else
    echo "✗ 节点 HTTP 代理测试失败"
    echo "  请确认节点服务器已启动: npm run start:node"
fi
echo ""

# 测试 HTTP 代理（通过主服务器）
echo "4. 测试主服务器 HTTP 代理..."
if curl -x http://localhost:8080 -s http://httpbin.org/ip > /dev/null 2>&1; then
    echo "✓ 主服务器 HTTP 代理工作正常"
    curl -x http://localhost:8080 -s http://httpbin.org/ip
else
    echo "✗ 主服务器 HTTP 代理测试失败"
fi
echo ""

echo "=== 测试完成 ==="
echo ""
echo "提示:"
echo "- 主服务器 API: http://localhost:3000/api"
echo "- 主服务器 HTTP 代理: http://localhost:8080"
echo "- 主服务器 SOCKS5 代理: socks5://localhost:1080"
echo "- 节点 HTTP 代理: http://localhost:8081"
echo "- 节点 SOCKS5 代理: socks5://localhost:1081"
echo ""

