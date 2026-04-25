# DEPLOYMENT

最后更新：2026-04-25

Mui简历的**运行时代码**（service deploy 的部分）只有这几个独立部署单元：

| 单元 | 技术栈 | 用途 | 状态 |
|---|---|---|---|
| [`packages/api`](./packages/api) | Cloudflare Worker + Container (Hono + Puppeteer) + D1 | `/render` PDF 渲染、`/jobs/fetch` JD 抓取、`/waitlist` 收邮箱 | ✅ MVP 可部署 |
| [`packages/website`](./packages/website) | Next.js 16 + OpenNext + Cloudflare Worker | Web app 本体：landing 页 + 未来 dashboard（Better Auth + 订阅） | ✅ MVP 可部署 |

Skill 本身（`skills/*/`）**不是**运行时产物——不需要部署，用户通过 `npx skills add meathill/muicv` 直接从公共仓库拉。

`packages/app`（规划中）会承载 electron 桌面端，不属于 service deploy。

---

## 前置准备

- **Cloudflare 账号**（Workers Paid Plan，`$5/月起`；Container 只有 Paid 可用）
- **Docker** 本地装好（OrbStack / Docker Desktop / Colima 均可）—— `packages/api` 的 Container 本地开发 + 首次部署构建镜像要用
- **wrangler CLI**：已在 `devDependencies` 里（`wrangler@4.54+`），走 `pnpm` 调即可
- Cloudflare 账号 ID：已硬编码在各 `wrangler.jsonc` 里（`account_id: fdc63eeea83ae8f5234357308b9a638b`）。换账号时记得同步改
- **域名**：生产用 `muicv.com` 作为产品根域：
  - `muicv.com` / `www.muicv.com` — landing + 未来 dashboard（`packages/website`）
  - `api.muicv.com` — API（`packages/api`）

---

## packages/api（PDF 渲染 API）

### 架构

```
skill → POST https://<api-host>/<path>
         ↓
       Hono Worker
         ↓
       Durable Object (BrowserContainer，透明代理)
         ↓
       Cloudflare Container（Node 22 + Chromium + Puppeteer + Hono，监听 :3000）
         ├─ POST /render      → 简历 markdown → PDF
         ├─ POST /jobs/fetch  → JD URL → 清洗后的 markdown
         └─ GET  /health      → ok
```

Container 里用 puppeteer-core 启动单例 Chromium，`/render` 和 `/jobs/fetch` 共享同一个 browser 实例。`/jobs/fetch` 还内置 `@mozilla/readability` + `turndown`，把 JD 页面提取成干净的 markdown。

MVP **纯冷启动**：首次调用 5-10s（Container + Chromium 启动），热调用 <1s。后续观察用量再决定是否给 DO 加保活策略。

### 本地开发

```bash
pnpm install
pnpm --filter @muicv/api dev
```

`wrangler dev` 会自动：

1. 用 `container/Dockerfile` 构建本地镜像（首次 2-5 分钟，之后走 Docker 层缓存秒级）
2. 起 Container + Worker
3. 代码变更时热重载；按 `r` 键手动重建镜像

测试：

```bash
curl -X POST http://localhost:8787/render \
  -H "Content-Type: application/json" \
  -d '{"markdown":"# 张三\n\n资深前端工程师 · 北京\n\n## Summary\n\n一段测试简历。"}' \
  --output /tmp/test.pdf
open /tmp/test.pdf
```

### 部署到 Cloudflare

**首次部署前准备**：

```bash
# 1. 建 D1 数据库（如果还没建过）
pnpm --filter @muicv/api exec wrangler d1 create muicv-api
# 把返回的 database_id 填到 packages/api/wrangler.jsonc 的 d1_databases[0].database_id

# 2. 把本地 migration 推到生产 D1
pnpm --filter @muicv/api db:migrate
```

本地 dev 环境同步 schema：

```bash
pnpm --filter @muicv/api db:migrate:local
```

其他常用命令：

| 脚本 | 作用 |
|---|---|
| `db:migrate` | apply 所有未应用的 migration 到生产 D1 |
| `db:migrate:local` | 同上，但作用于本地 wrangler dev 的 D1 |
| `db:migrate:list` | 列出生产 D1 已应用的 migration |
| `db:console -- "SELECT * FROM waitlist"` | 在生产 D1 执行任意 SQL（注意 `--` 后是参数） |
| `db:console:local -- "..."` | 同上，本地 D1 |

**部署 Worker + Container**：

```bash
pnpm --filter @muicv/api deploy
```

`wrangler deploy` 会自动：

1. 用 `container/Dockerfile` 构建生产镜像
2. 推到 Cloudflare 托管的 Container Registry
3. 部署 Worker、声明 `BrowserContainer` Durable Object、绑定 Container、绑定 D1

**绑定域名 `api.muicv.com`**：

编辑 `packages/api/wrangler.jsonc`，把注释掉的 `routes` 节解开：

```jsonc
"routes": [
  { "pattern": "api.muicv.com/*", "zone_name": "muicv.com" }
]
```

前提：Cloudflare DNS 里 `muicv.com` zone 已有 `api` 的 proxied CNAME 或 A 记录。再 `pnpm --filter @muicv/api deploy` 即可生效。

**速率限制**（MVP 建议）：

在 Cloudflare Dashboard → 该 Worker → WAF / Rate Limiting 配：

- `/render`：每 IP 每分钟 ≤ 3 次
- `/jobs/fetch`：每 IP 每分钟 ≤ 10 次
- `/waitlist`：每 IP 每分钟 ≤ 3 次（防刷）

代码层没做这些，靠 Cloudflare 层更便宜、规则可随时调。

### 环境变量

MVP 阶段**没有**环境变量需要设置。后续规划：

- `MUICV_ALLOWED_ORIGINS` — CORS 白名单（如果前端要直接调 API）
- 账号/订阅相关 secret（Stripe 等）用 `wrangler secret put <NAME>`

### 添加新模板

1. `packages/api/container/templates/<name>.html` 新增 HTML 模板（含 `{{title}}`、`{{content}}` 占位符）
2. 重新 `pnpm --filter @muicv/api deploy`
3. Skill 调 API 时传 `template: "<name>"`

---

## packages/website（Web app 本体）

Worker name `muicv-web`。承载：

- `app/(marketing)/page.tsx` — landing + waitlist UI
- 未来 `app/(dashboard)/...` — Better Auth 登录后的产品后台（Phase 6 起）

### 现有绑定（声明在 `wrangler.jsonc`）

- D1：`MUICV_DB`，database `muicv`（和 `packages/api` 共用同一个 D1）
- KV：`MUICV_KV`
- R2：`NEXT_INC_CACHE_R2_BUCKET`（bucket `site-cache`）—— OpenNext ISR 缓存
- Self service binding：`WORKER_SELF_REFERENCE`

### 本地开发

```bash
# 纯 Next.js dev（最快，但不走 Worker 环境）
pnpm --filter @muicv/website dev

# OpenNext / Wrangler 本地预览（最贴近生产）
pnpm --filter @muicv/website dev:cf
```

### 部署

首次部署前在 Cloudflare DNS 给 `muicv.com` 和 `www.muicv.com` 加 proxied 记录指向本 Worker，然后解开 `wrangler.jsonc` 里 routes 节的注释。

```bash
pnpm --filter @muicv/website cf:build
pnpm --filter @muicv/website cf:deploy
```

### Phase 6 待做

- 接入 **Better Auth**（账号方案已定）
- 设计 users / subscriptions / sessions 表 + migrations（和 `packages/api` 共用 `muicv` D1）
- 对接 muirouter.com（类 openrouter 的 LLM 代理 + 付费余额）
- Dashboard UI（用量、API Key、订阅状态）
- 未来上 Stripe 做订阅或直接充值 muirouter 额度

---

## Skill 分发（不需要部署）

`skills/muicv-*/` 跟着仓库推 master 就是"发布"——用户通过：

```bash
npx skills add meathill/muicv -g
```

一条命令就装到 `~/.claude/skills/`（或团队项目 `./.claude/skills/`）。

见 [README.md > 安装](./README.md#安装) 章节。

---

## CI / CD（暂缺，Phase 5 再补）

目前所有部署都是**手动**跑 `pnpm --filter <pkg> deploy`。未来规划：

- GitHub Actions：main 分支 merge 时自动部署 `packages/api` 到 prod
- PR 自动部署 preview 环境（`wrangler deploy --env preview`）

---

## 可能的坑

- **Container 镜像首次 build 很慢**（拉 `node:22-slim` + `apt install chromium`，3-5 分钟）。之后走 Docker 层缓存，改代码秒级。
- **Worker CPU 时限 30s**：如果 Puppeteer 某次渲染超过 30s，会被 kill。MVP 默认 page load timeout 设为 20s 留出余量。
- **Cloudflare Container 只在付费 plan 可用**。免费账号会部署失败。
- **wrangler 版本**：Container GA 要求 `wrangler >= 4.20`（我们锁的 4.54+ 足够）。升级时注意看 release notes。
