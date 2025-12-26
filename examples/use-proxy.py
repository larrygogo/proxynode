#!/usr/bin/env python3
# 使用 Resi Proxy 的 Python 示例

import requests

# 方式 1：使用 HTTP 代理
def use_http_proxy():
    print('=== 使用 HTTP 代理 ===')
    
    proxies = {
        'http': 'http://localhost:8080',
        'https': 'http://localhost:8080',
    }
    
    try:
        response = requests.get('http://httpbin.org/ip', proxies=proxies)
        print('响应:', response.json())
    except Exception as e:
        print('错误:', str(e))

# 方式 2：使用 SOCKS5 代理
def use_socks5_proxy():
    print('\n=== 使用 SOCKS5 代理 ===')
    
    proxies = {
        'http': 'socks5://localhost:1080',
        'https': 'socks5://localhost:1080',
    }
    
    try:
        response = requests.get('http://httpbin.org/ip', proxies=proxies)
        print('响应:', response.json())
    except Exception as e:
        print('错误:', str(e))

# 方式 3：使用环境变量
def use_env_proxy():
    print('\n=== 使用环境变量 ===')
    
    import os
    os.environ['HTTP_PROXY'] = 'http://localhost:8080'
    os.environ['HTTPS_PROXY'] = 'http://localhost:8080'
    
    try:
        response = requests.get('http://httpbin.org/ip')
        print('响应:', response.json())
    except Exception as e:
        print('错误:', str(e))

if __name__ == '__main__':
    print('确保主服务器和节点已启动\n')
    
    use_http_proxy()
    use_socks5_proxy()
    use_env_proxy()

