import axios from 'axios';

/**
 * 获取节点的公网IP地址
 */
export async function getPublicIp(): Promise<string | undefined> {
  const services = [
    'https://api.ipify.org?format=json',
    'https://api.ip.sb/ip',
    'https://ifconfig.me/ip',
  ];

  for (const service of services) {
    try {
      const response = await axios.get(service, { 
        timeout: 5000,
        headers: {
          'User-Agent': 'ResiProxy-Node/1.0',
        }
      });

      let ip: string;
      if (typeof response.data === 'string') {
        ip = response.data.trim();
      } else if (response.data.ip) {
        ip = response.data.ip;
      } else {
        continue;
      }

      // 验证IP格式
      if (isValidIp(ip)) {
        console.log(`[GetPublicIp] 成功获取公网IP: ${ip} (来源: ${service})`);
        return ip;
      }
    } catch (error: any) {
      console.warn(`[GetPublicIp] 从 ${service} 获取IP失败:`, error.message);
      continue;
    }
  }

  console.warn('[GetPublicIp] 无法获取公网IP，将使用本地配置');
  return undefined;
}

/**
 * 验证IP地址格式
 */
function isValidIp(ip: string): boolean {
  // IPv4 验证
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Regex.test(ip)) {
    const parts = ip.split('.');
    return parts.every(part => {
      const num = parseInt(part, 10);
      return num >= 0 && num <= 255;
    });
  }

  // IPv6 验证（简化版）
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){7}[0-9a-fA-F]{0,4}$/;
  return ipv6Regex.test(ip);
}

