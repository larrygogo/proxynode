# 包管理器使用指南

ProxyNode 同时支持 **npm** 和 **pnpm** 作为包管理器。

## ⚠️ 重要提示

**推荐使用 npm**，因为某些 pnpm 版本可能存在 `ERR_INVALID_THIS` 错误。如果您遇到 pnpm 安装问题，请使用 npm。

## 📦 使用 npm（推荐）

npm 是 Node.js 的默认包管理器，稳定可靠：

- ✅ **稳定可靠**
- ✅ **广泛使用**
- ✅ **无需额外安装**

## 📦 使用 pnpm（可选）

pnpm 是一个快速、节省磁盘空间的包管理器，但可能存在兼容性问题：

- ⚡ **更快的安装速度**
- 💾 **节省磁盘空间**（通过硬链接共享依赖）
- 🔒 **更严格的依赖管理**
- ⚠️ **可能存在版本兼容性问题**

## 🚀 使用 npm（推荐）

### 常用命令

```bash
# 安装依赖
npm install

# 构建所有项目
npm run build

# 构建 Master Server
npm run build:master

# 构建 Node Server
npm run build:node

# 启动 Master Server
npm run start:master

# 启动 Node Server
npm run start:node

# 开发模式
npm run dev:master
npm run dev:node

# 添加依赖到特定 workspace
npm install express --workspace=master-server
npm install axios --workspace=node-sdk

# 添加开发依赖
npm install -D typescript
```

## 🔧 使用 pnpm（可选，可能有问题）

### ⚠️ 已知问题

如果遇到 `ERR_INVALID_THIS` 错误，说明您的 pnpm 版本与 Node.js 不兼容。建议：
1. 升级 pnpm: `npm install -g pnpm@latest`
2. 或直接使用 npm（推荐）

### 安装 pnpm

```bash
# 使用 npm 安装 pnpm
npm install -g pnpm

# 或使用其他方式
# Windows (PowerShell)
iwr https://get.pnpm.io/install.ps1 -useb | iex

# macOS/Linux
curl -fsSL https://get.pnpm.io/install.sh | sh -
```

### 常用命令

```bash
# 安装依赖
pnpm install

# 构建所有项目
pnpm run build

# 构建 Master Server
pnpm run build:master

# 构建 Node Server
pnpm run build:node

# 启动 Master Server
pnpm run start:master

# 启动 Node Server
pnpm run start:node

# 开发模式
pnpm run dev:master
pnpm run dev:node

# 添加依赖到特定 workspace
pnpm --filter master-server add express
pnpm --filter node-sdk add axios

# 添加开发依赖
pnpm add -D typescript -w
```

### Workspace 配置

项目使用 `pnpm-workspace.yaml` 配置 monorepo：

```yaml
packages:
  - 'master-server'
  - 'node-sdk'
```

## 📦 使用 npm

如果您更喜欢使用 npm，也完全支持：

### 常用命令

```bash
# 安装依赖
npm install

# 构建所有项目（需要修改 package.json 的 scripts）
npm run build

# 构建特定项目
npm run build --workspace=master-server
npm run build --workspace=node-sdk

# 启动服务
npm run start --workspace=master-server
npm run start --workspace=node-sdk

# 添加依赖到特定 workspace
npm install express --workspace=master-server
npm install axios --workspace=node-sdk
```

### 切换到 npm

如果您想使用 npm 而不是 pnpm，需要修改根目录的 `package.json`：

```json
{
  "scripts": {
    "build": "npm run build --workspaces",
    "build:master": "npm run build --workspace=master-server",
    "build:node": "npm run build --workspace=node-sdk",
    "start:master": "npm run start --workspace=master-server",
    "start:node": "npm run start --workspace=node-sdk"
  }
}
```

## 🔄 在两者之间切换

### 从 npm 切换到 pnpm（不推荐）

```bash
# 删除 npm 生成的文件
Remove-Item -Recurse -Force node_modules,package-lock.json,master-server/node_modules,node-sdk/node_modules -ErrorAction SilentlyContinue

# 升级 pnpm 到最新版本
npm install -g pnpm@latest

# 使用 pnpm 安装
pnpm install
```

### 从 pnpm 切换到 npm（推荐）

```bash
# Windows PowerShell
Remove-Item -Recurse -Force node_modules,pnpm-lock.yaml,master-server/node_modules,node-sdk/node_modules -ErrorAction SilentlyContinue

# Linux/Mac
rm -rf node_modules pnpm-lock.yaml master-server/node_modules node-sdk/node_modules

# 使用 npm 安装（默认配置已支持）
npm install
```

## ⚠️ 注意事项

### pnpm 特定配置

`.npmrc` 文件包含 pnpm 配置：

```
shamefully-hoist=true
strict-peer-dependencies=false
```

- `shamefully-hoist=true`: 提升所有依赖到根 node_modules（提高兼容性）
- `strict-peer-dependencies=false`: 不严格检查 peer dependencies

### 镜像源问题

如果在中国大陆使用官方源速度较慢，可以使用镜像：

```bash
# 淘宝镜像
pnpm config set registry https://registry.npmmirror.com/

# 恢复官方源
pnpm config set registry https://registry.npmjs.org/
```

或者在 `.npmrc` 中添加：

```
registry=https://registry.npmmirror.com/
```

## 📊 性能对比

| 操作 | pnpm | npm |
|------|------|-----|
| 首次安装 | ⚡⚡⚡ | ⚡⚡ |
| 重复安装 | ⚡⚡⚡⚡ | ⚡ |
| 磁盘使用 | 💾 节省 | 💾💾 较多 |
| 依赖隔离 | 🔒 严格 | 🔓 宽松 |

## 🆘 故障排查

### pnpm 出现 ERR_INVALID_THIS 错误

这是 pnpm 版本与 Node.js 不兼容导致的。解决方案：

1. **使用 npm（推荐）**：
   ```bash
   # 清理 pnpm 文件
   Remove-Item -Force pnpm-lock.yaml -ErrorAction SilentlyContinue
   
   # 使用 npm
   npm install
   ```

2. **升级 pnpm**：
   ```bash
   npm install -g pnpm@latest
   pnpm install
   ```

3. **降级 Node.js**（如果 pnpm 仍然有问题）

### pnpm 安装失败

如果 pnpm 安装失败，可以：

1. **直接使用 npm（推荐）**
2. **检查网络连接**
3. **切换镜像源**（见上方）
4. **清理缓存**：
   ```bash
   pnpm store prune
   ```

### 依赖找不到

如果运行时提示找不到依赖：

1. **删除 node_modules 重新安装**：
   ```bash
   rm -rf node_modules pnpm-lock.yaml
   pnpm install
   ```

2. **检查 shamefully-hoist 配置**：
   确保 `.npmrc` 中有 `shamefully-hoist=true`

## 📚 更多资源

- [pnpm 官方文档](https://pnpm.io/)
- [pnpm Workspace](https://pnpm.io/workspaces)
- [npm Workspaces](https://docs.npmjs.com/cli/using-npm/workspaces)
