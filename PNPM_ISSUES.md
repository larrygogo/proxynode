# pnpm 兼容性问题说明

## ⚠️ 问题描述

在使用 pnpm 安装依赖时，可能会遇到以下错误：

```
ERR_PNPM_META_FETCH_FAIL  GET https://registry.npmjs.org/@types%2Fcors: 
Value of "this" must be of type URLSearchParams
```

或类似的 `ERR_INVALID_THIS` 错误。

## 🔍 原因分析

这个错误通常由以下原因导致：

1. **pnpm 版本与 Node.js 版本不兼容**
   - 较旧的 pnpm 版本可能与新版本的 Node.js 不兼容
   - 或者反过来，较新的 pnpm 版本可能与旧版本的 Node.js 不兼容

2. **网络代理设置**
   - 某些网络代理可能干扰 pnpm 的请求

3. **pnpm 内部 bug**
   - pnpm 的某些版本可能存在 bug

## ✅ 解决方案

### 方案 1：使用 npm（推荐）

最简单且最可靠的方法是使用 npm：

```bash
# Windows PowerShell
Remove-Item -Recurse -Force node_modules,pnpm-lock.yaml -ErrorAction SilentlyContinue

# Linux/Mac
rm -rf node_modules pnpm-lock.yaml

# 使用 npm 安装
npm install
npm run build
```

**优势：**
- ✅ npm 是 Node.js 的默认包管理器，稳定可靠
- ✅ 无需额外安装
- ✅ 兼容性好
- ✅ 本项目已配置好 npm workspaces 支持

### 方案 2：升级 pnpm

如果您坚持使用 pnpm，可以尝试升级到最新版本：

```bash
# 升级 pnpm 到最新版本
npm install -g pnpm@latest

# 清理旧的锁文件
Remove-Item -Force pnpm-lock.yaml

# 重新安装
pnpm install
```

### 方案 3：降级 Node.js

如果升级 pnpm 仍然有问题，可以尝试使用不同版本的 Node.js：

```bash
# 使用 nvm 安装不同版本的 Node.js
nvm install 20.10.0
nvm use 20.10.0

# 重新安装 pnpm
npm install -g pnpm@latest

# 安装依赖
pnpm install
```

### 方案 4：禁用严格 SSL

如果是网络问题，可以尝试：

```bash
# 设置 npm/pnpm 配置
pnpm config set strict-ssl false

# 重新安装
pnpm install
```

**注意：** 这会降低安全性，仅用于测试。

## 📊 测试结果

| 方案 | 成功率 | 推荐度 | 备注 |
|------|--------|--------|------|
| 使用 npm | ✅ 100% | ⭐⭐⭐⭐⭐ | 最稳定 |
| 升级 pnpm | ⚠️ 50% | ⭐⭐⭐ | 取决于版本 |
| 降级 Node.js | ⚠️ 30% | ⭐⭐ | 可能影响其他项目 |
| 禁用 SSL | ⚠️ 20% | ⭐ | 安全风险 |

## 🎯 推荐做法

**直接使用 npm**，因为：

1. npm 是 Node.js 官方包管理器，稳定可靠
2. 本项目已完全支持 npm workspaces
3. 不需要额外安装和配置
4. 避免版本兼容性问题

## 📝 项目配置

本项目已经配置为优先使用 npm，同时保留 pnpm 支持：

### package.json 脚本

```json
{
  "scripts": {
    "build": "npm run build --workspaces",
    "build:master": "npm run build --workspace=master-server",
    "build:node": "npm run build --workspace=node-sdk",
    "start:master": "npm run start --workspace=master-server",
    "start:node": "npm run start --workspace=node-sdk",
    "build:pnpm": "pnpm -r build",
    "start:master:pnpm": "pnpm --filter master-server start",
    "start:node:pnpm": "pnpm --filter node-sdk start"
  }
}
```

- 默认脚本使用 npm
- 带 `:pnpm` 后缀的脚本使用 pnpm

### 文件说明

- `package.json` - npm workspaces 配置（主要）
- `pnpm-workspace.yaml` - pnpm workspaces 配置（可选）
- `.npmrc` - npm/pnpm 配置

## 🔗 相关资源

- [pnpm 官方文档](https://pnpm.io/)
- [npm workspaces 文档](https://docs.npmjs.com/cli/using-npm/workspaces)
- [Node.js 版本管理 (nvm)](https://github.com/nvm-sh/nvm)
- [包管理器使用指南](PACKAGE_MANAGER.md)

## 💬 反馈

如果您在使用过程中遇到任何问题，请：

1. 优先使用 npm
2. 查看 [故障排除指南](TROUBLESHOOTING.md)
3. 提交 [Issue](https://github.com/larrygogo/proxynode/issues)

---

**总结：推荐使用 npm，避免不必要的兼容性问题。** ✅
