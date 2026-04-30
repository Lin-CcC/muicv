# DEV_NOTE

长期开发知识沉淀。记录决策依据、踩坑、框架/基建知识，避免日后重复。

最后更新：2026-04-30

---

## Cloudflare Worker / OpenNext（packages/website）

- **必须 `export const dynamic = 'force-dynamic'`** 在用到 D1 的 SSR 页面顶部。
  否则 build 时 prerender 拿不到 Cloudflare bindings，构建直接失败。
  目前 `app/(marketing)/page.tsx` 因为 nav 要根据登录态切显，强制 SSR。
- `worker-configuration.d.ts`（14k+ 行，wrangler 自动生成）不要 review、不要手改；
  跑 `pnpm --filter @muicv/website cf-typegen` 重新生成即可。
- 本地开发两套：`pnpm dev` 是纯 Next.js，最快；`pnpm dev:cf` 走 Wrangler，更贴近生产 Worker 行为。

## Cloudflare Browser Rendering（packages/api）

> 历史：原本是 Cloudflare Container（Node + Chromium + Puppeteer）+ Durable Object 单
> singleton。2026-04 切到 Browser Rendering（Workers Binding `@cloudflare/puppeteer`），
> 拆掉 Dockerfile / Container / DO，模板从 setContent(html string) 升级到
> `puppeteer.goto(URL)`，URL 指向 packages/website 的 React 组件 SSR 路由。

- **`/render` 调用链**：写一次性 token 到 `MUICV_KV` → `puppeteer.goto(${RENDER_BASE_URL}/r/render/${token})` →
  `await page.evaluateHandle('document.fonts.ready')` → `page.pdf({ format: 'A4' })` → 删 KV。
  详见 `packages/api/src/lib/render-pdf.ts`。
- **`/jobs/fetch`**：`puppeteer.goto(jdUrl)` → `addScriptTag` 注入 Readability + turndown
  → `page.evaluate` 在浏览器上下文跑 `Readability.parse()` + `turndown()` 一气呵成。
  Worker runtime 没有 DOM，所以**两个库都必须在 page 内跑**（原 container 是 turndown
  在 Node 侧跑，迁移后必须搬进 page）。详见 `packages/api/src/lib/fetch-jd.ts`。
  明确边界：**不**绕登录墙、**不**对抗 Turnstile / Captcha、**不**伪装 UA 规避 ToS。
- **本地 dev 必须 `wrangler dev --remote`**：Browser Rendering 跑在 Cloudflare 浏览器集群，
  本地 workerd 没有它，`wrangler dev` 默认 local 模式会报错。同理 `puppeteer.goto` 的目标
  URL（`RENDER_BASE_URL`）必须公网可达，所以 dev 期间走的是已部署到 muicv.com 的 prod
  packages/website。换句话说：本地改 packages/api 可以热重载联调；本地改 packages/website
  必须先 deploy 到 muicv.com 才能在 puppeteer 里看到效果。
- **字体策略**：`packages/website/app/r/render/[token]/templates/default.tsx` 通过 React
  19 自动 hoist 的 `<link>` 加载 Google Fonts 的 Noto Sans SC（替代原 container 里
  apt 装的 fonts-noto-cjk）。简历模板 CSS 颜色 / 字体全部绝对值，不依赖站点 globals.css 的
  brand 变量，避免被父层污染。如果 Google Fonts 出向被墙，回退方案是改 R2 自托管子集化字体。
- **KV token**：UUID v4，5 分钟 TTL，渲染完立即 delete。`MUICV_KV` namespace 由
  packages/website 拥有，packages/api 用同一个 namespace id 绑定。两包 wrangler.jsonc
  里 `kv_namespaces[0].id` 必须**完全一致**，否则 api 写的 token website 这边读不到。
- **wrangler text rule**：`{ type: 'Text', globs: ['**/Readability.js', '**/turndown.js'] }`
  让 fetch-jd.ts 能 `import readabilityJs from '@mozilla/readability/Readability.js'`
  把 .js 源码当字符串拿到。`fallthrough: true` 保留默认 .txt/.html/.sql 规则。
- **Workers / DOM lib 冲突**：page.evaluate 的回调跑在浏览器，需要 DOM 全局；Worker
  tsconfig 不含 DOM lib。fetch-jd.ts 用 file-scoped `declare const document/window/Readability/...`
  覆盖回调里实际用到的成员，避免在整个项目启用 DOM lib 污染 Worker 代码。
- **DO 删除迁移**：原 `BrowserContainer` DO 通过 `migrations` 追加 v2 `deleted_classes:
  ["BrowserContainer"]` 卸掉。Cloudflare 要求保留所有历史 migration，不能删 v1。

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

## packages/app UI 架构（IDE 三栏 + 多 profile）

- **三栏布局**：左 navigator（profile 切换 + 对话列表 + 用户菜单）/ 中对话流 /
  右 artifact 区。三栏全部由 `useAppStore` (zustand) 单一真相源驱动；右栏
  collapsible 且宽度可拖拽（localStorage key `muicv:rightPanelWidth`，
  clamp 到 [320, 900] 像素）。
- **多 profile**：一个 muicv 账号下用户可建多份 "职业档案"（求职 / 跳槽 / 家人共用），
  每份对应硬盘上一个独立目录。**目录与 profile 强绑定，按 dir 去重**（`findByDir`），
  避免历史脏数据产生重复 profile。`ensureDefault` 用 in-flight promise 序列化，
  防止 bootstrap + onAutoLogin 并发竞争。
- **右栏 tree / preview 两个独立通道**：tree 是文件树根，preview 是当前预览路径，
  两者**不互斥** —— preview 以 overlay 形式盖在 tree 上面，关掉 preview 后
  tree 状态（展开的目录）原样保留。
- **artifact source 二分**：agent 工具调用 emit 的 artifact 分 `read`（参考资料）/
  `write`（产物）。read 类折叠到操作组里不打扰，write 类显眼卡片**自动开右栏**
  让用户看到结果。判断完全靠 `source` 字段，不靠 path 推断。

## packages/app 内置 PDF 预览（muicv-pdf:// custom protocol）

> 简历 PDF 走 Chromium 内置 viewer 在右栏 iframe 渲染，不外开系统阅读器。

- **协议注册顺序**：`protocol.registerSchemesAsPrivileged([{ scheme: 'muicv-pdf',
  privileges: { standard: true, secure: true, stream: true } }])` 必须在
  `app.whenReady()` **之前**调用；handler 注册（`protocol.handle`）放在
  whenReady 里。顺序反了协议会失效。
- **plugins: true 必须开**：Chromium 内置 PDF viewer 是 plugin，BrowserWindow
  默认 `plugins: false` 时 `<iframe src="muicv-pdf://...">` 会**静默白屏**
  （响应 200、内容也对，但 viewer 不接管）。开 `plugins: true` 才能让 PDF
  在 iframe 渲染（commit 8489411）。
- **路径白名单**：handler 里强制校验 url.hostname === 'local'、文件路径
  必须以当前 profile 的 workspaceDir 开头、后缀必须 .pdf —— 三层 gate
  防止 renderer 通过协议读到工作目录之外的文件。
- **Buffer → ArrayBuffer**：返回 `Response(buf.buffer.slice(...))` 而不是
  `Response(buf)`，否则 Buffer 在某些环境下会被识别成 SharedArrayBuffer。

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
- `packages/shared` 是基线参考（纯类型包，目前只有一个导入 smoke test）。
- `packages/api` 用 Hono 的 `app.request()` 测路由，不需要 wrangler / miniflare；
  覆盖入口校验、CORS 白名单、api-key middleware 各分支（共 21 个 case）。
- `packages/app` 测纯逻辑 helper（chat-utils 等），不测 React 组件 / IPC —— 投入
  比回报大，留给手测和 dogfood。
- D1 binding 在测试里用极简 mock（`prepare/bind/run/first` 全部返回 stub）。
