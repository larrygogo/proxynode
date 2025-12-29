#!/bin/bash

# 检查 Master Server 是否正常运行

echo "=================================="
echo "检查 Master Server 状态"
echo "=================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
GRAY='\033[0;37m'
NC='\033[0m' # No Color

# 加载 .env 文件（如果存在）
ENV_FILE=".env"
MASTER_URL="http://localhost:3000"

if [ -f "$ENV_FILE" ]; then
    echo -e "${YELLOW}正在从 .env 读取配置...${NC}"
    export $(grep -v '^#' $ENV_FILE | xargs)
fi

echo -e "${NC}Master Server URL: $MASTER_URL${NC}"
echo ""

# 1. 检查端口是否被占用
echo -e "${GREEN}1. 检查端口占用情况${NC}"
echo "-----------------------------------"
PORT=3000
if [[ $MASTER_URL =~ :([0-9]+) ]]; then
    PORT=${BASH_REMATCH[1]}
fi

if command -v lsof &> /dev/null; then
    result=$(lsof -i :$PORT -sTCP:LISTEN -t 2>/dev/null)
    if [ -n "$result" ]; then
        process=$(ps -p $result -o comm= 2>/dev/null)
        echo -e "${GREEN}✓ 端口 $PORT 已被占用${NC}"
        echo -e "  ${GRAY}进程: $process (PID: $result)${NC}"
    else
        echo -e "${RED}✗ 端口 $PORT 未被占用${NC}"
        echo -e "  ${YELLOW}Master Server 可能未启动！${NC}"
    fi
elif command -v netstat &> /dev/null; then
    result=$(netstat -tuln | grep ":$PORT " 2>/dev/null)
    if [ -n "$result" ]; then
        echo -e "${GREEN}✓ 端口 $PORT 已被占用${NC}"
    else
        echo -e "${RED}✗ 端口 $PORT 未被占用${NC}"
        echo -e "  ${YELLOW}Master Server 可能未启动！${NC}"
    fi
fi
echo ""

# 2. 尝试连接 Master Server API
echo -e "${GREEN}2. 测试 API 连接${NC}"
echo "-----------------------------------"
echo -e "${GRAY}请求: GET $MASTER_URL/api/nodes${NC}"

response=$(curl -s -w "\n%{http_code}" --connect-timeout 5 "$MASTER_URL/api/nodes" 2>&1)
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" = "200" ]; then
    echo -e "${GREEN}✓ API 连接成功${NC}"
    echo -e "  ${GRAY}状态码: $http_code${NC}"
    
    # 解析响应
    node_count=$(echo "$body" | jq -r '.nodes | length' 2>/dev/null)
    if [ -n "$node_count" ]; then
        echo -e "  ${GRAY}已注册节点数: $node_count${NC}"
    fi
else
    echo -e "${RED}✗ API 连接失败${NC}"
    echo -e "  ${YELLOW}错误: 无法连接到 Master Server${NC}"
    
    echo ""
    echo -e "${YELLOW}可能的原因：${NC}"
    echo -e "  ${GRAY}1. Master Server 未启动${NC}"
    echo -e "  ${GRAY}2. Master Server 启动在不同的端口${NC}"
    echo -e "  ${GRAY}3. 防火墙阻止了连接${NC}"
fi
echo ""

# 3. 测试注册端点
echo -e "${GREEN}3. 测试节点注册 API${NC}"
echo "-----------------------------------"
echo -e "${GRAY}请求: POST $MASTER_URL/api/nodes/register${NC}"

test_data='{"name":"test-node","region":"test","httpPort":9999,"socks5Port":9998,"capabilities":["http","socks5"],"host":"localhost"}'

response=$(curl -s -w "\n%{http_code}" --connect-timeout 5 \
    -X POST \
    -H "Content-Type: application/json" \
    -d "$test_data" \
    "$MASTER_URL/api/nodes/register" 2>&1)

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
    echo -e "${GREEN}✓ 注册 API 可访问${NC}"
    echo -e "  ${GRAY}状态码: $http_code${NC}"
    
    # 立即注销测试节点
    node_id=$(echo "$body" | jq -r '.nodeId' 2>/dev/null)
    if [ -n "$node_id" ] && [ "$node_id" != "null" ]; then
        curl -s -X DELETE "$MASTER_URL/api/nodes/$node_id" &>/dev/null
        echo -e "  ${GRAY}测试节点已清理${NC}"
    fi
else
    echo -e "${RED}✗ 注册 API 失败${NC}"
    echo -e "  ${YELLOW}状态码: $http_code${NC}"
fi
echo ""

# 4. 建议
echo "=================================="
echo "诊断完成"
echo "=================================="
echo ""

if [ -n "$result" ] && [ "$http_code" = "200" ]; then
    echo -e "${GREEN}✓ Master Server 运行正常！${NC}"
    echo ""
    echo -e "${NC}如果 Node Server 仍无法连接，请检查：${NC}"
    echo -e "  ${GRAY}1. Node Server 的 .env 配置中 MASTER_URL 是否正确${NC}"
    echo -e "  ${GRAY}2. 如果在不同机器上，确保网络可以互通${NC}"
    echo -e "  ${GRAY}3. 查看 Node Server 的详细错误日志${NC}"
elif [ -z "$result" ]; then
    echo -e "${RED}✗ Master Server 未运行${NC}"
    echo ""
    echo -e "${NC}请先启动 Master Server：${NC}"
    echo -e "  ${GRAY}npm run start:master${NC}"
    echo ""
    echo -e "${NC}或者：${NC}"
    echo -e "  ${GRAY}pnpm start:master${NC}"
else
    echo -e "${YELLOW}⚠ Master Server 可能存在问题${NC}"
    echo ""
    echo -e "${NC}建议：${NC}"
    echo -e "  ${GRAY}1. 检查 Master Server 的日志${NC}"
    echo -e "  ${GRAY}2. 尝试重启 Master Server${NC}"
    echo -e "  ${GRAY}3. 检查防火墙设置${NC}"
fi

echo ""
