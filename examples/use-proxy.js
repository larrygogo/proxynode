// 使用 Resi Proxy 的示例代码

const axios = require('axios');
const { SocksProxyAgent } = require('socks-proxy-agent');

// 方式 1：使用 HTTP 代理
async function useHttpProxy() {
  console.log('=== 使用 HTTP 代理 ===');
  
  try {
    const response = await axios.get('http://httpbin.org/ip', {
      proxy: {
        host: 'localhost',
        port: 8080, // 主服务器端口，或 8081（节点端口）
      }
    });
    
    console.log('响应:', response.data);
  } catch (error) {
    console.error('错误:', error.message);
  }
}

// 方式 2：使用 SOCKS5 代理
async function useSocks5Proxy() {
  console.log('\n=== 使用 SOCKS5 代理 ===');
  
  try {
    const agent = new SocksProxyAgent('socks5://localhost:1080'); // 或 1081
    
    const response = await axios.get('http://httpbin.org/ip', {
      httpAgent: agent,
      httpsAgent: agent,
    });
    
    console.log('响应:', response.data);
  } catch (error) {
    console.error('错误:', error.message);
  }
}

// 方式 3：使用环境变量
async function useEnvProxy() {
  console.log('\n=== 使用环境变量 ===');
  
  // 设置环境变量
  process.env.HTTP_PROXY = 'http://localhost:8080';
  process.env.HTTPS_PROXY = 'http://localhost:8080';
  
  try {
    const response = await axios.get('http://httpbin.org/ip');
    console.log('响应:', response.data);
  } catch (error) {
    console.error('错误:', error.message);
  }
}

// 运行示例
async function main() {
  console.log('确保主服务器和节点已启动\n');
  
  await useHttpProxy();
  await useSocks5Proxy();
  await useEnvProxy();
}

main();

