# DEV_NOTE

长期开发知识沉淀。记录决策依据、踩坑、框架/基建知识，避免日后重复。

最后更新：2026-04-26

---

## Cloudflare Worker / OpenNext（packages/website）

- **必须 `export const dynamic = 'force-dynamic'`** 在用到 D1 的 SSR 页面顶部。
  否则 build 时 prerender 拿不到 Cloudflare bindings，构建直接失败。
  目前 `app/(marketing)/page.tsx` 因为 nav 要根据登录态切显，强制 SSR。
- `worker-configuration.d.ts`（14k+ 行，wrangler 自动生成）不要 review、不要手改；
  跑 `pnpm --filter @muicv/website cf-typegen` 重新生成即可。
- 本地开发两套：`pnpm dev` 是纯 Next.js，最快；`pnpm dev:cf` 走 Wrangler，更贴近生产 Worker 行为。

## Cloudflare Container（packages/api）

- **Container 通过单 DO singleton 暴露**：`env.BROWSER.idFromName('default')`。
  当前所有用户共用一个 Puppeteer 实例，未来按用户分片时改成 `idFromName(userId)` 即可，
  上层接口保持不变。
- **本地 dev 必须 Docker**（OrbStack / Docker Desktop / Colima 任选其一）——
  Cloudflare Container 在 wrangler dev 里实际上启动一个本地容器跑 `container/server.ts`。
- `/jobs/fetch` 的明确边界：**不**绕登录墙、**不**对抗 Turnstile / Captcha、
  **不**伪装 UA 规避 ToS；container 侧 20s 超时硬上限。要做反爬就改产品方向。
- `/render` 用 Puppeteer + Chromium 把 markdown 渲染成 A4 PDF，模板系统在 container 里。

## packages/app（Electron）

- **fs.glob 启动崩溃**（commit b512f15）：
  早期版本依赖里某个包用了 Node 22 的实验 `fs.glob`，在 electron 主进程里被运行时
  当成 unstable API 直接 crash。解法是升级 packages/app 全部依赖到最新，
  让那个间接依赖换实现。以后再遇到 electron 启动 crash，先看是不是新 API 触发的。
- **muicv:// deep link**（Phase 8）：用 OAuth-style 自动登录。
  注册 `muicv://` URL scheme（macOS Info.plist），dashboard 登录成功后跳转
  `muicv://auth?token=mui_xxx`，electron 主进程拿到 token 写入本地 store，
  渲染进程进入 onboarding。完整流程见 `packages/app/src/main/deep-link.ts`。
- 电脑端通过 GitHub Releases 分发 .dmg / .zip，tag `v*` 自动触发
  `.github/workflows/release.yml`（electron-builder）。详见 DEPLOYMENT.md。

## API Key / 鉴权（packages/api）

- `mui_xxx` 是桌面 app + skill 的统一凭据。在 web dashboard 创建/撤销，
  存到 D1 的 `apiKey` 表（hash 后的）。
- 中间件：
  - `requireApiKey`：缺/无效直接 401；用于 /me、/llm/v1/*
  - `optionalApiKey`：有就解析 userId 给后续 handler 用，没有也放行；用于 /render、/jobs/fetch
- `/llm/v1/*` 是**反向代理到 muirouter**（OpenAI 兼容），我们自己**不**直接发 LLM 请求。
  桌面 app 的 OpenAI Agent SDK 把 baseURL 配成 `https://api.muicv.com/llm/v1`，
  我们透传 + 计费 + 按用户 BYOK 路由到他们绑定的 muirouter key。

## Skills 分发

- 双通道并行：
  - `/plugin marketplace add meathill/muicv` + `/plugin install muicv@meathill`（Claude Code 官方）
  - `npx skills add meathill/muicv`（Vercel `skills` CLI，兼容 Claude Code / Codex / Cursor / OpenCode 等）
- skill 大段 prompt 放在 `skills/<name>/references/*.md`，SKILL.md 里靠
  `{{ reference: xxx }}` 引用，避免主文件臃肿。

## Better Auth / 账号系统（packages/website）

- 使用 Better Auth + 邮箱密码 + GitHub OAuth（M2，commit 2e90655）。
- session 存 D1，cookie 配置在 `lib/auth.ts`。
- dashboard 路由分组 `(dashboard)`；marketing 路由分组 `(marketing)`。
- 注意 Better Auth 的 trustedOrigins 要把生产域 + dev 域都写上，否则 OAuth 回跳被拒。

## 测试

- **node:test + 默认 ts 直接跑**（`node --test`）；不要引 vitest / jest，除非有强需求。
- `packages/shared` 是基线参考；`packages/api` 用 Hono 的 `app.request()` 测路由，
  不需要 wrangler / miniflare。
- D1 binding 在测试里用极简 mock（`prepare/bind/run/first` 全部返回 stub）。
