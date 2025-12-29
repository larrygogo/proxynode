#!/bin/bash

# ProxyNode 网络诊断脚本
# 用于检查网络配置和连通性

echo "=================================="
echo "ProxyNode 网络诊断工具"
echo "=================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
GRAY='\033[0;37m'
NC='\033[0m' # No Color

# 1. 获取本机 IP 地址
echo -e "${GREEN}1. 本机网络信息${NC}"
echo "-----------------------------------"
if command -v ip &> /dev/null; then
    ip addr show | grep "inet " | grep -v "127.0.0.1" | awk '{print "  IP 地址: " $2}'
elif command -v ifconfig &> /dev/null; then
    ifconfig | grep "inet " | grep -v "127.0.0.1" | awk '{print "  IP 地址: " $2}'
fi
echo ""

# 2. 检查端口占用
echo -e "${GREEN}2. 端口占用情况${NC}"
echo "-----------------------------------"
ports=(3000 8080 1080 8081 1081)
for port in "${ports[@]}"; do
    if command -v lsof &> /dev/null; then
        result=$(lsof -i :$port -sTCP:LISTEN -t 2>/dev/null)
        if [ -n "$result" ]; then
            process=$(ps -p $result -o comm= 2>/dev/null)
            echo -e "  端口 $port : ${YELLOW}已被占用${NC} ${GRAY}(进程: $process)${NC}"
        else
            echo -e "  端口 $port : ${GREEN}空闲${NC}"
        fi
    elif command -v netstat &> /dev/null; then
        result=$(netstat -tuln | grep ":$port " 2>/dev/null)
        if [ -n "$result" ]; then
            echo -e "  端口 $port : ${YELLOW}已被占用${NC}"
        else
            echo -e "  端口 $port : ${GREEN}空闲${NC}"
        fi
    elif command -v ss &> /dev/null; then
        result=$(ss -tuln | grep ":$port " 2>/dev/null)
        if [ -n "$result" ]; then
            echo -e "  端口 $port : ${YELLOW}已被占用${NC}"
        else
            echo -e "  端口 $port : ${GREEN}空闲${NC}"
        fi
    fi
done
echo ""

# 3. 检查防火墙状态
echo -e "${GREEN}3. 防火墙状态${NC}"
echo "-----------------------------------"
if command -v ufw &> /dev/null; then
    echo "  防火墙类型: ufw"
    ufw status | grep -E "Status|3000|8080|1080" | sed 's/^/  /'
elif command -v firewall-cmd &> /dev/null; then
    echo "  防火墙类型: firewalld"
    firewall-cmd --list-ports 2>/dev/null | sed 's/^/  /'
elif command -v iptables &> /dev/null; then
    echo "  防火墙类型: iptables"
    iptables -L -n | grep -E "3000|8080|1080" | sed 's/^/  /'
else
    echo -e "  ${YELLOW}未检测到常见防火墙工具${NC}"
fi
echo ""

# 4. 测试服务器连通性（可选）
echo -e "${GREEN}4. 服务器连通性测试${NC}"
echo "-----------------------------------"
read -p "请输入 Master Server 的 IP 地址 (按 Enter 跳过): " serverIP
if [ -n "$serverIP" ]; then
    echo -e "  正在测试连接到 ${YELLOW}$serverIP${NC}..."
    
    # Ping 测试
    if ping -c 2 -W 2 $serverIP &> /dev/null; then
        echo -e "  Ping 测试: ${GREEN}成功${NC}"
    else
        echo -e "  Ping 测试: ${RED}失败${NC}"
    fi
    
    # 端口测试
    test_ports=(3000 8080 1080)
    for port in "${test_ports[@]}"; do
        echo -n "  端口 $port : "
        if command -v nc &> /dev/null; then
            if nc -zv -w 2 $serverIP $port &> /dev/null; then
                echo -e "${GREEN}开放${NC}"
            else
                echo -e "${RED}关闭或被防火墙阻止${NC}"
            fi
        elif command -v telnet &> /dev/null; then
            if timeout 2 telnet $serverIP $port &> /dev/null; then
                echo -e "${GREEN}开放${NC}"
            else
                echo -e "${RED}关闭或被防火墙阻止${NC}"
            fi
        else
            echo -e "${YELLOW}无法测试 (需要 nc 或 telnet)${NC}"
        fi
    done
fi
echo ""

# 5. 配置文件检查
echo -e "${GREEN}5. 配置文件检查${NC}"
echo "-----------------------------------"
config_files=("./master-server/config.json" "./node-sdk/config.json")
for config_file in "${config_files[@]}"; do
    if [ -f "$config_file" ]; then
        echo -e "  $config_file : ${GREEN}存在${NC}"
        
        # 读取并显示关键配置
        if [[ "$config_file" == *"node-sdk"* ]]; then
            master_url=$(jq -r '.master.url' "$config_file" 2>/dev/null || echo "无法读取")
            ws_url=$(jq -r '.master.wsUrl' "$config_file" 2>/dev/null || echo "无法读取")
            http_port=$(jq -r '.node.httpPort' "$config_file" 2>/dev/null || echo "无法读取")
            socks5_port=$(jq -r '.node.socks5Port' "$config_file" 2>/dev/null || echo "无法读取")
            echo -e "    ${GRAY}Master URL: $master_url${NC}"
            echo -e "    ${GRAY}Master WS URL: $ws_url${NC}"
            echo -e "    ${GRAY}节点 HTTP 端口: $http_port${NC}"
            echo -e "    ${GRAY}节点 SOCKS5 端口: $socks5_port${NC}"
        else
            api_port=$(jq -r '.server.port' "$config_file" 2>/dev/null || echo "无法读取")
            http_port=$(jq -r '.server.proxyHttpPort' "$config_file" 2>/dev/null || echo "无法读取")
            socks5_port=$(jq -r '.server.proxySocks5Port' "$config_file" 2>/dev/null || echo "无法读取")
            echo -e "    ${GRAY}API 端口: $api_port${NC}"
            echo -e "    ${GRAY}HTTP 代理端口: $http_port${NC}"
            echo -e "    ${GRAY}SOCKS5 代理端口: $socks5_port${NC}"
        fi
    else
        echo -e "  $config_file : ${RED}不存在${NC}"
    fi
    echo ""
done

# 6. 建议
echo "=================================="
echo "诊断完成！"
echo "=================================="
echo ""
echo -e "${YELLOW}💡 建议：${NC}"
echo ""
echo -e "${NC}1. 如果您是 Master Server（服务器）：${NC}"
echo -e "   ${GRAY}- 确保防火墙已开放端口 3000, 8080, 1080${NC}"
echo -e "   ${GRAY}- 确保服务器监听在 0.0.0.0${NC}"
echo -e "   ${GRAY}- 记录服务器的公网/内网 IP 地址${NC}"
echo ""
echo -e "${NC}2. 如果您是 Node Server（本地电脑）：${NC}"
echo -e "   ${GRAY}- 修改 node-sdk/config.json 中的 Master URL${NC}"
echo -e "   ${GRAY}- 将 localhost 改为服务器的实际 IP${NC}"
echo -e "   ${GRAY}- 确保可以 ping 通服务器${NC}"
echo ""
echo -e "${NC}3. 手机代理配置：${NC}"
echo -e "   ${GRAY}- HTTP 代理: 服务器IP:8080${NC}"
echo -e "   ${GRAY}- SOCKS5 代理: 服务器IP:1080${NC}"
echo ""
echo -e "${CYAN}详细故障排除指南请查看 TROUBLESHOOTING.md${NC}"
echo ""
