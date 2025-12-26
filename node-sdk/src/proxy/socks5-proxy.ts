import { createServer, Server, Socket } from 'net';
import { SocksClient, SocksClientOptions } from 'socks';
import { v4 as uuidv4 } from 'uuid';
import { NodeMonitor } from '../monitor/node-monitor';
import { ProxyConnection } from '../types';

export class Socks5ProxyServer {
  private server: Server;
  private monitor: NodeMonitor;
  private enabled: boolean = true;

  constructor(monitor: NodeMonitor) {
    this.monitor = monitor;
    this.server = createServer(this.handleConnection.bind(this));
  }

  private async handleConnection(clientSocket: Socket): Promise<void> {
    if (!this.enabled) {
      clientSocket.destroy();
      return;
    }

    let connectionId: string | null = null;
    let nodeSocket: Socket | null = null;

    // 处理 SOCKS5 握手
    clientSocket.once('data', async (data: Buffer) => {
      try {
        // 验证 SOCKS5 版本
        if (data[0] !== 0x05) {
          clientSocket.destroy();
          return;
        }

        // 发送认证方法（无认证）
        clientSocket.write(Buffer.from([0x05, 0x00]));

        // 读取连接请求
        clientSocket.once('data', async (requestData: Buffer) => {
          try {
            // 验证请求格式
            if (requestData[0] !== 0x05 || requestData[1] !== 0x01) {
              // CONNECT 命令
              clientSocket.destroy();
              return;
            }

            const addressType = requestData[3];
            let targetHost: string;
            let targetPort: number;
            let offset = 4;

            // 解析目标地址
            if (addressType === 0x01) {
              // IPv4
              targetHost = `${requestData[offset]}.${requestData[offset + 1]}.${requestData[offset + 2]}.${requestData[offset + 3]}`;
              offset += 4;
            } else if (addressType === 0x03) {
              // 域名
              const domainLength = requestData[offset];
              targetHost = requestData
                .slice(offset + 1, offset + 1 + domainLength)
                .toString();
              offset += 1 + domainLength;
            } else if (addressType === 0x04) {
              // IPv6（简化处理，返回不支持）
              clientSocket.write(
                Buffer.from([0x05, 0x08, 0x00, 0x01, 0, 0, 0, 0, 0, 0])
              );
              clientSocket.destroy();
              return;
            } else {
              clientSocket.destroy();
              return;
            }

            // 解析端口
            targetPort = (requestData[offset] << 8) | requestData[offset + 1];

            // 创建连接记录
            connectionId = uuidv4();
            const connection: ProxyConnection = {
              id: connectionId,
              protocol: 'socks5',
              target: targetHost,
              port: targetPort,
              startTime: new Date(),
              bytesUp: 0,
              bytesDown: 0,
            };

            this.monitor.addConnection(connection);

            // 连接到目标服务器
            const net = require('net');
            const targetSocket = net.createConnection(
              targetPort,
              targetHost,
              () => {
                // 连接成功，发送成功响应
                // 响应格式：VER REP RSV ATYP BND.ADDR BND.PORT
                const response = Buffer.alloc(10);
                response[0] = 0x05; // VER
                response[1] = 0x00; // REP (成功)
                response[2] = 0x00; // RSV
                response[3] = 0x01; // ATYP (IPv4)
                // BND.ADDR 和 BND.PORT (通常为 0.0.0.0:0)
                response.writeUInt32BE(0, 4);
                response.writeUInt16BE(0, 8);

                clientSocket.write(response);

                // 建立双向连接
                clientSocket.pipe(targetSocket);
                targetSocket.pipe(clientSocket);

                nodeSocket = targetSocket;

                // 监控数据量
                clientSocket.on('data', (data: Buffer) => {
                  if (connectionId) {
                    connection.bytesUp += data.length;
                    this.monitor.updateConnectionBytes(connectionId, data.length, 0);
                  }
                });

                targetSocket.on('data', (data: Buffer) => {
                  if (connectionId) {
                    connection.bytesDown += data.length;
                    this.monitor.updateConnectionBytes(connectionId, 0, data.length);
                  }
                });
              }
            );

            targetSocket.on('error', (error: Error) => {
              console.error(
                `[Socks5Proxy] 连接目标服务器失败 ${targetHost}:${targetPort}:`,
                error
              );
              if (connectionId) {
                this.monitor.removeConnection(connectionId);
              }
              // 发送连接失败响应
              clientSocket.write(
                Buffer.from([0x05, 0x01, 0x00, 0x01, 0, 0, 0, 0, 0, 0])
              );
              clientSocket.destroy();
            });

            clientSocket.on('error', (error: Error) => {
              console.error('[Socks5Proxy] 客户端连接错误:', error);
              if (connectionId) {
                this.monitor.removeConnection(connectionId);
              }
              if (targetSocket) {
                targetSocket.destroy();
              }
            });

            clientSocket.on('close', () => {
              if (connectionId) {
                this.monitor.removeConnection(connectionId);
              }
              if (targetSocket) {
                targetSocket.destroy();
              }
            });

            targetSocket.on('close', () => {
              if (connectionId) {
                this.monitor.removeConnection(connectionId);
              }
              clientSocket.destroy();
            });
          } catch (error) {
            console.error('[Socks5Proxy] 处理请求错误:', error);
            if (connectionId) {
              this.monitor.removeConnection(connectionId);
            }
            clientSocket.destroy();
          }
        });
      } catch (error) {
        console.error('[Socks5Proxy] 握手错误:', error);
        clientSocket.destroy();
      }
    });

    clientSocket.on('error', (error) => {
      console.error('[Socks5Proxy] 客户端连接错误:', error);
    });
  }

  /**
   * 启用代理
   */
  enable(): void {
    this.enabled = true;
    console.log('[Socks5Proxy] SOCKS5 代理已启用');
  }

  /**
   * 禁用代理
   */
  disable(): void {
    this.enabled = false;
    console.log('[Socks5Proxy] SOCKS5 代理已禁用');
  }

  /**
   * 启动服务器
   */
  listen(port: number, callback?: () => void): void {
    this.server.listen(port, callback);
    console.log(`[Socks5Proxy] SOCKS5 代理服务器启动在端口 ${port}`);
  }

  /**
   * 关闭服务器
   */
  close(callback?: () => void): void {
    this.server.close(callback);
  }
}

