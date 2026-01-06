# TESTING

## 环境要求

- Node.js >= 24
- pnpm（见根目录 `package.json` 的 `packageManager`）

## 安装依赖

在仓库根目录执行：

```bash
pnpm install
```

## 运行测试

目前测试主要来自：

- `packages/shared`：领域类型/工具的 smoke test
- `packages/app`：对话数据存储（内存 + SQLite）相关单测

测试使用 Node 内置 test runner。

```bash
pnpm test
```

如果只跑某个包：

```bash
pnpm --filter @muicv/shared test
```

## 启动开发服务器

应用（对话 + 简历）：

```bash
pnpm dev:app
```

官网：

```bash
pnpm dev:website
```

## 说明

- 目前处于 M0 骨架阶段，尚未引入端到端测试；后续在对话/抽取闭环落地后补齐。
- `packages/app` 的单测使用 Node 内置 `node:sqlite`（会看到 `ExperimentalWarning`，这是 Node 当前的特性状态，不影响功能）。

## Cloudflare 预览（App）

`packages/app` 已接入 OpenNext for Cloudflare，本地可用 Wrangler 预览生产构建：

```bash
pnpm --filter @muicv/app db:migrate:local
pnpm --filter @muicv/app dev:cf
```

说明：

- `db:migrate:local` 会在本地 wrangler 状态目录创建/更新 D1（不会改动你的线上资源）。
- 本项目使用 `wrangler.jsonc`，相关脚本已显式传入 `--config/-c`；如果你直接运行 wrangler 命令，也建议带上 `-c wrangler.jsonc`。
- 如果你只跑 `pnpm dev:app`（next dev），也会尝试通过 OpenNext 的 dev 集成读取 `wrangler.jsonc` 并提供 D1/KV/R2 绑定；但本地 D1 依然建议先跑一次迁移。

环境变量（本地）：

- `pnpm --filter @muicv/app dev:cf`（Wrangler/Worker 预览）：推荐在 `packages/app/.dev.vars` 中设置 `OPENAI_API_KEY` / `GOOGLE_API_KEY` 等变量（不要提交到仓库）。
- `pnpm dev:app`（next dev）：读取 `process.env`；你可以用自己的方式注入（例如在 shell 中 `export OPENAI_API_KEY=...`），并确保敏感信息不进入版本控制。
- 代码读取优先级：Cloudflare env（Wrangler 注入）优先于 `process.env`，避免系统级环境变量覆盖本地预览配置。
