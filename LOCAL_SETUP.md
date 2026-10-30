# 本地源码版

- 页面：http://localhost:3009
- 本地项目管理平台：CLI Code UI
- 安装依赖：`pnpm install --frozen-lockfile`
- 构建前后端：`pnpm build`
- 生产启动命令：`pnpm run server`（由本地项目管理平台执行）

修改界面后运行 `pnpm build`，再通过本地项目管理平台重启此项目。
前端源码位于 `src/`。现有 Claude 会话和配置仍在 `~/.claude`；
CLI Code UI 账号数据库仍在 `~/.cloudcli/auth.db`。

`.env` 保存本机端口、监听地址和 Claude CLI 路径，不提交到 Git。
Electron 桌面应用依赖的安装脚本已禁用；本项目使用网页端。
