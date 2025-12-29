#!/bin/bash

# ProxyNode HTTP 代理测试脚本 (使用 .env 配置)
# 此脚本从 .env 文件读取配置

echo "=================================="
echo "ProxyNode HTTP 代理测试"
echo "=================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
GRAY='\033[0;37m'
NC='\033[0m' # No Color

# 加载 .env 文件
ENV_FILE=".env"
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}错误: 未找到 .env 文件${NC}"
    echo -e "${YELLOW}请复制 env.example 为 .env 并配置相关参数${NC}"
    exit 1
fi

# 读取 .env 文件
echo -e "${YELLOW}正在加载配置...${NC}"
export $(grep -v '^#' $ENV_FILE | xargs)

# 获取配置
MASTER_HOST=${MASTER_HOST:-localhost}
HTTP_PORT=${MASTER_HTTP_PROXY_PORT:-8080}
SOCKS5_PORT=${MASTER_SOCKS5_PROXY_PORT:-1080}

echo -e "${GREEN}配置信息:${NC}"
echo -e "  ${GRAY}Master Host: $MASTER_HOST${NC}"
echo -e "  ${GRAY}HTTP 代理端口: $HTTP_PORT${NC}"
echo -e "  ${GRAY}SOCKS5 代理端口: $SOCKS5_PORT${NC}"
echo ""

# 测试 HTTP 代理
echo -e "${GREEN}1. 测试 HTTP 代理${NC}"
echo "-----------------------------------"
echo -e "${YELLOW}代理地址: http://${MASTER_HOST}:${HTTP_PORT}${NC}"
echo ""

# 测试基本连接
echo -e "${CYAN}测试目标: http://ipinfo.io/json${NC}"
response=$(curl -x http://${MASTER_HOST}:${HTTP_PORT} http://ipinfo.io/json -s -w "\n%{http_code}" --connect-timeout 10)
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" = "200" ]; then
    echo -e "${GREEN}✓ 连接成功${NC}"
    echo "$body" | jq '.' 2>/dev/null || echo "$body"
else
    echo -e "${RED}✗ 连接失败 (HTTP $http_code)${NC}"
fi
echo ""

# 测试 HTTPS 代理
echo -e "${GREEN}2. 测试 HTTPS 代理${NC}"
echo "-----------------------------------"
echo -e "${CYAN}测试目标: https://api.ipify.org?format=json${NC}"
response=$(curl -x http://${MASTER_HOST}:${HTTP_PORT} https://api.ipify.org?format=json -s -w "\n%{http_code}" --connect-timeout 10)
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" = "200" ]; then
    echo -e "${GREEN}✓ 连接成功${NC}"
    echo "$body" | jq '.' 2>/dev/null || echo "$body"
else
    echo -e "${RED}✗ 连接失败 (HTTP $http_code)${NC}"
fi
echo ""

# 测试 SOCKS5 代理
echo -e "${GREEN}3. 测试 SOCKS5 代理${NC}"
echo "-----------------------------------"
echo -e "${CYAN}测试目标: http://ipinfo.io/json${NC}"
response=$(curl --socks5 ${MASTER_HOST}:${SOCKS5_PORT} http://ipinfo.io/json -s -w "\n%{http_code}" --connect-timeout 10)
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" = "200" ]; then
    echo -e "${GREEN}✓ 连接成功${NC}"
    echo "$body" | jq '.' 2>/dev/null || echo "$body"
else
    echo -e "${RED}✗ 连接失败 (HTTP $http_code)${NC}"
fi
echo ""

# 其他测试命令
echo -e "${GREEN}4. 其他测试命令${NC}"
echo "-----------------------------------"
echo -e "${YELLOW}HTTP 代理:${NC}"
echo -e "  ${GRAY}curl -x http://${MASTER_HOST}:${HTTP_PORT} http://ipinfo.io/json${NC}"
echo ""
echo -e "${YELLOW}HTTPS 代理:${NC}"
echo -e "  ${GRAY}curl -x http://${MASTER_HOST}:${HTTP_PORT} https://api.ipify.org?format=json${NC}"
echo ""
echo -e "${YELLOW}SOCKS5 代理:${NC}"
echo -e "  ${GRAY}curl --socks5 ${MASTER_HOST}:${SOCKS5_PORT} http://ipinfo.io/json${NC}"
echo ""

echo "=================================="
echo "测试完成！"
echo "=================================="
