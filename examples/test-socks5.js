// SOCKS5 代理测试脚本
const axios = require('axios');
const { SocksProxyAgent } = require('socks-proxy-agent');

console.log('=== Resi Proxy SOCKS5 测试 ===\n');

async function testSocks5(proxyUrl, name) {
    console.log(`测试 ${name} (${proxyUrl})...`);
    
    const agent = new SocksProxyAgent(proxyUrl);
    
    try {
        const startTime = Date.now();
        const response = await axios.get('http://ipinfo.io/json', {
            httpAgent: agent,
            httpsAgent: agent,
            timeout: 10000
        });
        const duration = Date.now() - startTime;
        
        console.log(`✓ ${name} 测试成功`);
        console.log(`  响应时间: ${duration}ms`);
        console.log('  响应内容:');
        console.log(response.data);
        console.log('');
        return true;
    } catch (error) {
        console.log(`✗ ${name} 测试失败`);
        console.log(`  错误: ${error.message}`);
        console.log('');
        return false;
    }
}

async function testHttps(proxyUrl, name) {
    console.log(`测试 HTTPS 通过 ${name}...`);
    
    const agent = new SocksProxyAgent(proxyUrl);
    
    try {
        const response = await axios.get('https://api.ipify.org?format=json', {
            httpAgent: agent,
            httpsAgent: agent,
            timeout: 10000
        });
        
        console.log(`✓ HTTPS 测试成功`);
        console.log('  响应内容:');
        console.log(response.data);
        console.log('');
        return true;
    } catch (error) {
        console.log(`✗ HTTPS 测试失败`);
        console.log(`  错误: ${error.message}`);
        console.log('');
        return false;
    }
}

async function runTests() {
    console.log('确保主服务器和节点已启动\n');
    console.log('---\n');
    
    // 测试节点 SOCKS5
    await testSocks5('socks5://localhost:1081', '节点 SOCKS5');
    
    console.log('---\n');
    
    // 测试主服务器 SOCKS5
    await testSocks5('socks5://localhost:1080', '主服务器 SOCKS5');
    
    console.log('---\n');
    
    // 测试 HTTPS
    await testHttps('socks5://localhost:1081', '节点');
    
    console.log('=== 测试完成 ===\n');
    console.log('端口说明:');
    console.log('  - 1081: 节点 SOCKS5 端口（直连）');
    console.log('  - 1080: 主服务器 SOCKS5 端口（负载均衡）');
    console.log('');
}

runTests();

