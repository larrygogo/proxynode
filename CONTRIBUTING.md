# 贡献指南

感谢您对 ProxyNode 项目的关注！我们欢迎各种形式的贡献。

## 如何贡献

### 报告 Bug

如果您发现了 bug，请：
1. 检查是否已有相关 [Issue](https://github.com/larrygogo/proxynode/issues)
2. 如果没有，创建新 Issue，包含：
   - 清晰的标题和描述
   - 复现步骤
   - 预期行为和实际行为
   - 环境信息（操作系统、Node.js 版本等）
   - 相关日志或截图

### 提出新功能

1. 先开一个 Issue 讨论您的想法
2. 说明功能的用途和场景
3. 等待维护者反馈

### 提交代码

1. Fork 项目
2. 创建特性分支：`git checkout -b feature/amazing-feature`
3. 提交更改：`git commit -m '添加某个功能'`
4. 推送到分支：`git push origin feature/amazing-feature`
5. 提交 Pull Request

## 开发规范

### 代码风格

- 使用 TypeScript
- 遵循项目现有代码风格
- 添加必要的注释
- 使用有意义的变量和函数名

### Commit 规范

使用语义化提交信息：

```
类型: 简短描述

详细描述（可选）
```

**类型：**
- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式（不影响功能）
- `refactor`: 代码重构
- `test`: 测试相关
- `chore`: 构建/工具相关

**示例：**
```
feat: 添加节点地理位置显示功能

- 在监控面板显示节点位置
- 添加地图集成
- 更新 API 返回位置信息
```

### 测试

- 确保现有测试通过
- 为新功能添加测试
- 运行 `npm run build` 确保构建成功

## Pull Request 流程

1. 更新 README.md 相关文档
2. 更新 CHANGELOG.md
3. PR 标题清晰描述更改
4. 等待代码审查
5. 根据反馈进行修改

## 行为准则

- 尊重所有贡献者
- 接受建设性批评
- 专注于对项目最有利的事情
- 保持友好和专业

## 问题？

如有任何问题，请随时：
- 开 Issue 讨论
- 在 PR 中提问
- 联系维护者

再次感谢您的贡献！🎉

