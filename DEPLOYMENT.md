# DEPLOYMENT

最后更新：2026-04-25

Mui简历的**运行时代码**（service deploy 的部分）只有这几个独立部署单元：

| 单元 | 技术栈 | 用途 | 状态 |
|---|---|---|---|
| [`packages/api`](./packages/api) | Cloudflare Worker + Container (Hono + Puppeteer) + D1 | `/render` PDF 渲染、`/jobs/fetch` JD 抓取、`/waitlist` 收邮箱 | ✅ MVP 可部署 |
| [`packages/website`](./packages/website) | Next.js 16 + OpenNext + Cloudflare Worker | Web app 本体：landing 页 + 未来 dashboard（Better Auth + 订阅） | ✅ MVP 可部署 |

Skill 本身（`skills/*/`）**不是**运行时产物——不需要部署，用户通过 `npx skills add meathill/muicv` 直接从公共仓库拉。

`packages/app` 是 electron 桌面端，**不**走 Cloudflare service deploy；它通过
GitHub Releases 分发 .dmg / .zip 给用户下载。详见下文「桌面 app 发布」一节。

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
- `app/(auth)/sign-in` `/sign-up` — Better Auth 邮箱密码登录注册
- `app/(dashboard)/dashboard` — 登录后看到的占位页（M3+ 接入余额 / API key）
- `app/api/auth/[...all]/route.ts` — Better Auth catch-all

### 现有绑定（声明在 `wrangler.jsonc`）

- D1：`MUICV_DB`，database `muicv`（和 `packages/api` 共用同一个 D1）
- KV：`MUICV_KV`
- R2：`NEXT_INC_CACHE_R2_BUCKET`（bucket `site-cache`）—— OpenNext ISR 缓存
- Self service binding：`WORKER_SELF_REFERENCE`
- Vars：`BETTER_AUTH_URL`（生产 `https://muicv.com`，本地 `.dev.vars` 改）

### Secrets（必须 put）

```bash
# 生成 32+ 字节 secret，存到 Cloudflare 的 secret 管理
openssl rand -base64 32 | pnpm --filter @muicv/website exec wrangler secret put BETTER_AUTH_SECRET
```

本地 dev 需要在 `packages/website/.dev.vars`（gitignored）加：

```
BETTER_AUTH_SECRET=<同上的随机串>
BETTER_AUTH_URL=http://localhost:3070

# GitHub OAuth（可选，下文）
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
```

### GitHub OAuth（可选）

注册页和登录页会**自动检测** secret 是否配齐——配齐了显示"用 GitHub 登录"按钮，没配就只显示邮箱密码。

**步骤**：

1. 在 https://github.com/settings/developers → New OAuth App 创建：
   - Application name: `Mui简历`
   - Homepage URL: `https://muicv.com`
   - Authorization callback URL: `https://muicv.com/api/auth/callback/github`
2. 拿到 **Client ID** 和 **Client secret**
3. 把 Client ID 填到 `packages/website/wrangler.jsonc` 的 `vars.GITHUB_CLIENT_ID`（公开，可入 git）
4. Client secret 用 secret 命令存：
   ```bash
   pnpm --filter @muicv/website exec wrangler secret put GITHUB_CLIENT_SECRET
   ```
5. `pnpm --filter @muicv/website deploy`

**本地 dev** 需要单独建一个 GitHub OAuth App（callback URL `http://localhost:3070/api/auth/callback/github`），把 client id / secret 填到 `.dev.vars`。

### 数据库 migration

`packages/website` 的 migrations 是 Better Auth schema（`0002_better_auth.sql`）。
和 `packages/api/migrations/0001_waitlist.sql` 共用同一个 D1（database name `muicv`），
编号已分开：api = 0001，website = 0002 起。

```bash
# 部署前推 schema 到生产 D1
pnpm --filter @muicv/website exec wrangler d1 migrations apply muicv --remote

# 本地 dev D1
pnpm --filter @muicv/website exec wrangler d1 migrations apply muicv --local
```

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

## packages/app（桌面端 electron app）

不部署到任何服务，通过 GitHub Releases 给用户下载 `.dmg` / `.zip`。

### 本地开发 / 自测（dogfood + 找 bug）

> 这一节是给 meathill 自己测、找问题给 Claude 让他修用的。**所有 dev
> 时间都在自己机器上跑，不影响生产。**

#### 1. 前置一次性准备

```bash
# 仓库根
pnpm install
```

第一次会下载 electron 二进制（~500 MB），会比较慢；以后 install 走缓存就快了。

需要的钥匙（事先准备好）：

| 配置项 | 哪里拿 | 说明 |
|---|---|---|
| **muirouter API key** | [muirouter.com](https://muirouter.com) sign up → settings 复制 `sk-gw-...` | LLM 必需 |
| **muicv API key** | [muicv.com/dashboard](https://muicv.com/dashboard) 登录 → 生成 `mui_...` | 可选，让 PDF 渲染 / JD 抓取走身份计费 |
| **工作目录** | 在本地任选一个目录，例如 `~/muicv-test/`（先建好或让 app 引导你选） | 所有产物落这里 |

#### 2. 启动 dev 模式

```bash
pnpm --filter @muicv/app dev
```

- electron-vite 起 Vite dev server + 启动 electron 窗口
- HMR：改 renderer (React) 立即生效；改 main / preload 会重启窗口
- 默认右侧打开 DevTools（Console / Network / React tree 都能看）

打开后流程：

1. 自动进入 **Settings**（首次没有 workspaceDir / muirouterKey）
2. **选目录** → 弹原生 finder 选你刚才那个测试目录
3. **粘 muirouter API key** → 默认模型如果跑不通，改成 muirouter 实际支持的 model id（比如 `openai/gpt-4o-mini` 或别的，看 muirouter 文档）
4. **粘 muicv API key**（可选）
5. 保存 → 切回"对话"

#### 3. 跑一遍端到端流程（最简版）

按下面 4 句话依次发，用对话流验证 8 个工具是否都能动：

```
帮我准备简历
我叫张三，前端工程师，2023 年至今在 ACME 做 dashboard 重构，把 LCP 从 3.1s 降到 1.4s
抓这个 JD: https://jobs.ashbyhq.com/anthropic
针对它生成一版简历然后导出 PDF
```

期望的 agent 行为（对应 8 个工具）：

| 你说的 | agent 大概会调 |
|---|---|
| 帮我准备简历 | `list_dir` → `write_file` 创建 `.claude/muicv/profile.md` 等骨架 |
| 加经历 | `write_file` 写 `experience/acme-2023.md` |
| 抓 JD | `fetch_jd` → `targets/anthropic-...md` |
| 生成简历 | `read_file` ×N + `write_file` `versions/...md` |
| 导出 PDF | `render_resume_pdf` → `versions/...pdf` |

#### 4. 验证产物

工作目录现在应该有：

```
~/muicv-test/.claude/muicv/
├── profile.md
├── experience/acme-2023.md
├── targets/anthropic-...md
└── versions/anthropic-...md + .pdf
```

也可以点 app 顶部的 📁 路径按钮，直接在 Finder 打开看。

#### 5. 找 bug 的常见入口 + 反馈给我

- **agent 答非所问 / 不会用工具** → 打开 DevTools → Console 看 `[agent:chat] ...` 报错；问题大概率在 prompt 里某段表达不清，把"对话原文 + agent 调了什么工具 + 没调什么工具"贴给我
- **muirouter 401 / 模型不存在** → settings 里把 model id 换成 muirouter 实际支持的；告诉我哪个 model id 在哪个场景下能跑
- **`render_resume_pdf` 失败** → 看 DevTools Network 里 POST 到 api.muicv.com/render 的响应；如果没部署 packages/api，把响应贴出来
- **`fetch_jd` 拿不到内容** → 同上，把 URL 和报错贴出来
- **窗口/UI 错乱** → 截图 + 说明在哪个步骤
- **进程崩溃 / "白屏"** → 在终端看 `pnpm dev` 输出的 main 进程 stderr，把整段 log 贴过来

> 反馈格式：**截图 + 复现步骤 + 实际表现 + 预期表现**，能给我什么我就改什么。可以放在 GitHub Issue 里，也可以直接发我对话。

#### 6. 重启 / 清状态

- **清配置**（清掉粘过的 key、选过的目录）：
  ```bash
  rm -rf ~/Library/Application\ Support/@muicv/app/
  ```
  （或者直接重选 Settings 覆盖）
- **清工作目录**：删 `~/muicv-test/.claude/muicv/` 整个目录，让 agent 重新引导初始化
- **彻底重启**：关 app → 重新 `pnpm --filter @muicv/app dev`

#### 7. 想看完整 production 行为（不打 .dmg）

```bash
pnpm --filter @muicv/app build && pnpm --filter @muicv/app preview
```

这跑的是 build 后的 main / preload / renderer bundle（不带 HMR），最贴近用户拿到 .dmg 后的实际体验。

---

### 自动 release（推荐）

`.github/workflows/release.yml` 监听 `v*` tag，触发 macOS runner 跑：

1. `pnpm install --frozen-lockfile`
2. `pnpm --filter @muicv/app package`（electron-vite build → electron-builder）
3. 把 `packages/app/release/*.dmg` + `*.zip` + `latest-mac.yml` 上传到对应 GitHub Release

发布步骤：

```bash
# 改 packages/app/package.json 的 version
# 然后 commit，打 tag
git tag v0.1.0
git push origin v0.1.0
# GitHub Actions 跑 ~10 分钟，完成后 release 页面有 .dmg 下载
```

### 本地手动 build

```bash
pnpm --filter @muicv/app package          # 当前主机架构
pnpm --filter @muicv/app package:mac:arm  # 强制 Apple Silicon
pnpm --filter @muicv/app package:mac:x64  # 强制 Intel
```

产物在 `packages/app/release/`。

### 签名 / 公证（M5+）

当前版本 **不签名 (identity: null)**，用户首次打开要右键 → 打开。
后续申请 Apple Developer ID 后：

1. 在 Apple Developer 后台拿 `Developer ID Application` cert
2. GitHub Actions secrets 加 `CSC_LINK`（base64 .p12）+ `CSC_KEY_PASSWORD`
3. `electron-builder.yml` 改 `mac.identity: '<your team>'`，`hardenedRuntime: true`
4. 加 `mac.notarize: true` + `APPLE_ID` / `APPLE_APP_SPECIFIC_PASSWORD` / `APPLE_TEAM_ID` secrets

### 用户首次安装注意

`/download` 页面已经写明：右键 .app → 打开 → 允许；或一行命令解 quarantine：

```bash
xattr -d com.apple.quarantine /Applications/Mui简历.app
```

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
