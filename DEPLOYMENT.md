# DEPLOYMENT

本项目计划部署到 Cloudflare，包含：

- 应用：Next.js（通过 OpenNext 适配到 Cloudflare Worker）
- 数据：D1（KV 作为可选的临时态/幂等/缓存）
- 缓存：R2（用于 Next/OpenNext 的增量缓存）
- 定时任务：Cloudflare Cron Trigger（`packages/cron`）

## 当前状态（2026-01-06）

已完成 OpenNext for Cloudflare + Wrangler 的基础接入（以 `packages/app` 为主）。

已落地（App）：

- OpenNext 配置：`packages/app/open-next.config.ts`
- Wrangler 配置：`packages/app/wrangler.jsonc`
- D1（SQLite）初始化迁移：`packages/app/migrations/0001_init.sql`

绑定约定（App）：

- D1：`MUICV_DB`
- KV：`MUICV_KV`
- OpenNext 增量缓存（R2）：`NEXT_INC_CACHE_R2_BUCKET`（bucket：`site-cache`）
- （可选）缓存目录前缀：`NEXT_INC_CACHE_R2_PREFIX`（默认 `incremental-cache`）

环境变量（App / Worker）：

- AI（敏感）：
  - `OPENAI_API_KEY`：OpenAI 兼容接口鉴权
  - `GOOGLE_API_KEY`：Gemini 鉴权
- AI（可选）：
  - `MUICV_AI_PROVIDER`：`openai` / `gemini`（不填则按 key 自动选择）
  - `MUICV_OPENAI_MODEL`：默认 `gpt-4o-mini`
  - `MUICV_GEMINI_MODEL`：默认 `gemini-1.5-flash`
- 简历版本（非敏感）：
  - `MUICV_RESUME_SNAPSHOT_LIMIT`：保留最近快照数量（默认 10，最大 100）

本地预览时（Wrangler）建议把敏感变量放在 `packages/app/.dev.vars`（不要提交到仓库）；线上环境请用 Cloudflare 的环境变量/Secrets 管理能力设置。

接下来优先补齐：

1) 创建 Cloudflare 资源（D1/R2/KV）并把 id 写入 `wrangler.jsonc`
2) 跑通 `opennextjs-cloudflare deploy`（含 CI 方案）
3) 明确 dev/staging/prod 是否分离，以及迁移策略

## 你需要参与确认的事项

在真正接入 Cloudflare 之前，需要你确认/提供：

- Worker 名称：使用 `muicv-app`（见 `packages/app/wrangler.jsonc`）
- Cloudflare 账号与目标环境（dev/staging/prod 是否需要分离）
- D1 数据库命名与迁移策略（是否要区分环境）
- R2 bucket：`site-cache`（用于 Next/OpenNext 增量缓存，是否需要区分环境）
- KV namespace 命名与用途边界（缓存 vs 幂等 vs 临时态）

## 本地预览（Worker 环境）

在 `packages/app` 目录：

说明：本项目使用 `wrangler.jsonc`（而不是 `wrangler.toml`）。如果你直接运行 wrangler 命令，请记得带上 `-c wrangler.jsonc`。

1) 初始化/更新本地 D1（只影响本地 wrangler 状态目录）：

```bash
pnpm db:migrate:local
```

2) 构建并用 Wrangler 预览生产构建：

```bash
pnpm dev:cf
```

## 部署（生产）

在你创建好 D1/KV 并把 id 填入 `packages/app/wrangler.jsonc` 后：

```bash
pnpm --filter @muicv/app cf:build
pnpm --filter @muicv/app cf:deploy
```
