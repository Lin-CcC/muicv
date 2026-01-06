# DEPLOYMENT

本项目计划部署到 Cloudflare，包含：

- 应用：Next.js（通过 OpenNext 适配到 Cloudflare Worker）
- 数据：D1 + KV
- 定时任务：Cloudflare Cron Trigger（`packages/cron`）

## 当前状态（2026-01-06）

目前只完成了 monorepo 与 Next 应用骨架，尚未接入 OpenNext / Wrangler 配置、也未创建 D1/KV 资源。

已落地：

- D1（SQLite）兼容的初始化迁移：`packages/app/migrations/0001_init.sql`

接下来会按以下顺序补齐：

1) 选择并锁定 OpenNext 适配方案（Cloudflare Worker）
2) 为 `packages/app` 增加 `wrangler.toml` 与绑定配置（D1/KV）
3) 补齐本地开发与部署命令（`pnpm build` / `pnpm deploy`）

## 你需要参与确认的事项

在真正接入 Cloudflare 之前，需要你确认/提供：

- Cloudflare 账号与目标环境（dev/staging/prod 是否需要分离）
- D1 数据库命名与迁移策略（是否要区分环境）
- KV namespace 命名与用途边界（缓存 vs 幂等 vs 临时态）
