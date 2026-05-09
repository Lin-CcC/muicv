# DEV_NOTE

长期开发知识沉淀。记录决策依据、踩坑、框架/基建知识，避免日后重复。

最后更新：2026-05-07

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
- **workspace 包必须从 externalizeDepsPlugin exclude 掉**：electron-vite 默认把所有
  dependencies 标 external，workspace 包（如 `@muicv/shared`）会被原样（含 .ts 源码）
  拷进 packaged app 的 `node_modules/`。Electron 内置 Node 拒绝 strip node_modules 下
  的 `.ts` → 启动直接 `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING` 崩溃。
  dev 模式不会暴露（vite 内联编译走另一条路径）。配置见
  `electron.vite.config.ts` 里 main / preload 的 `externalizeDepsPlugin({ exclude: [...] })`。
  以后新增任何 `@muicv/*` workspace 包到 main/preload 都得加进 exclude。
- **electron-builder ≥ 26.8.2 + pnpm ≥ 10.29.3 是绑定关系**：pnpm 10.29.3 起把
  `pnpm ls --json --depth Infinity --prod` 输出改成 dedup 形式（transitive 复用节点
  只输出 `{ deduped: true, dedupedDependenciesCount: N }` 不再展开子树，OOM 修复，
  pnpm 不会回滚）。electron-builder ≤ 26.8.1 的 `pnpmNodeModulesCollector` 假设永远
  完全展开，照旧递归 walk → dedup'd transitive 全漏 → asar 缺包，packaged app 启动报
  `Cannot find module 'fast-deep-equal'` / `'json-schema-traverse'` / `'ms'` 之类。
  electron-builder 26.8.2（2026-03-11）已修。以后升级 pnpm 同时记得 electron-builder
  也保持 ≥ 26.8.2。参见 [pnpm/pnpm#10601](https://github.com/pnpm/pnpm/issues/10601)。
  **不要走 `node-linker=hoisted` 绕**——它只把根 node_modules 扁平化，不解决 workspace
  子包的 transitive，治标不治本。

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
- **设置页结构**：`settings-view.tsx` 是壳（账号头部 + 4 张卡 + footer），具体卡片
  全部拆到 `components/settings/` 子目录：`plan-card.tsx`（会员档位 + 余额 + 同步）/
  `model-card.tsx`（4 model 选择 + BYOK 降级）/ `muirouter-card.tsx`（绑定 / 余额 / fallback）/
  `custom-llm-card.tsx`（折叠的 BYOK 配置 + Field 子件）。`bits.tsx` 放 Avatar /
  ExternalButton + DASHBOARD_URL / MUIROUTER_URL 常量。改设置页时按卡定位文件，不要回写整个壳。

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

## Agent 运行时上下文管理（packages/app/src/main/agent）

> OpenAI Agents SDK 0.9+ 的 `AgentInputItem[]` 是 agent loop 的内存表示。
> `runtime.ts` 在每次 `run()` 之前把持久化的 `ChatMessage[]` 经 `history.ts` 的
> `buildAgentInput` 转成 `AgentInputItem[]`，顺手做滑动窗口裁剪——长对话不会撞
> context_length。

- **预算**：所有模型走同一保守值 `MODEL_CONTEXT_LIMIT = 256_000` 显示 token，
  压缩阈值 `COMPACT_THRESHOLD = 0.8`，历史区预算 = 256K × 0.8 = 204.8K，留 20%
  给 system prompt + tool schema + 模型本轮输出。**不**做 per-model 表，因为 muicv
  后端可能随时上新模型，硬编码会过期；保守值在所有模型上都安全。改阈值改
  [history.ts](packages/app/src/main/agent/history.ts) 顶部两个常量即可，不必动 runtime。
- **token 估算**：`estimateTokens(text) = ceil(text.length / 2.5)`，**不**引 tiktoken
  （桌面端 main 进程要保持轻量）。中文场景偏保守（实际 ~1 token/汉字），代价是
  英文略低估——可接受，反正用得是软上限。
- **裁剪策略**：从最新往最早倒序贪心累加，超 budget 即停。**最后一条 user 永远保留**
  （即便它单条就超 budget——丢用户最新输入比保留 system 更糟）；中段被切断时，
  在保留段最前面插一条占位 `user` 消息「（已省略 N 条更早的对话）」让模型知道
  历史不完整。**不**重建 tool_call / tool_result 链：assistant.toolCalls 在送 LLM 时
  忽略，与 MVP 字符串拼接版语义一致。
- **context_length_exceeded 友好文案**：上游若仍报这个错（极端长附件 / 工具返回
  超大），`runtime.ts` 的 `isContextLengthError` 模糊匹配 `context_length_exceeded` /
  `maximum context length` / `too many tokens` 等中英文表述，统一替换成
  「本次对话历史超出模型上下文长度。已尝试自动裁剪，仍超出的话请新开一个对话。」
  原始 OpenAI 错码不再透出给用户。

## API Key / 鉴权（packages/api）

- `mui_xxx` 是桌面 app + skill 的统一凭据。在 web dashboard 创建/撤销，
  存到 D1 的 `apiKey` 表（hash 后的）。
- 中间件：
  - `requireApiKey`：缺/无效直接 401。**当前所有付费 / 计费端点都用它**：
    `/me`、`/llm/v1/*`、`/render`、`/jobs/fetch`、`/resume/*`。
  - `optionalApiKey`：保留备用；目前**没有**端点在用（早期 `/render`、`/jobs/fetch` 曾走过它，
    2026-05 切到 `requireApiKey` 配合 token 扣费）。
- `/llm/v1/*` 是**反向代理到 muirouter**（OpenAI 兼容），我们自己**不**直接发 LLM 请求。
  桌面 app 的 OpenAI Agent SDK 把 baseURL 配成 `https://api.muicv.com/llm/v1`，
  我们透传 + 计费 + 按用户 BYOK 路由到他们绑定的 muirouter key。

## Skill 鉴权与计费策略

- **2026-05-02 决策**：muicv API 全量收紧到 Bearer 强制鉴权（无匿名档）。
  原因：所有联网调用都按 token 计费（`/render` 扣 `PDF_RENDER_COST`、
  `/jobs/fetch` 扣 `JD_FETCH_COST`、`/llm/v1/*` 按真实用量），
  匿名用户没账户 → 没法计费 / 限流 / 监控用量 / 审计。
- 所有调 muicv API 的 skill 必须走 [docs/skill-api-key.md](docs/skill-api-key.md)
  的统一规范——前置 gate + 标准教育文案 + 错误映射表（含 401 / 402 / 429）。
- 写新 skill 时先判断"要不要联网"：要 → 套规范；不要 → 别加 gate 吓走免费用户。
- 标准文案改动统一改 `docs/skill-api-key.md`，再回写所有引用 skill
  （`grep -lr "docs/skill-api-key.md" skills/`）。

## Skills 分发

- 通过 Vercel `skills` CLI 分发：`npx skills add meathill/muicv`
  （兼容 Claude Code / Codex / Cursor / OpenCode 等 40+ agent）。
- skill 大段 prompt 放在 `skills/<name>/references/*.md`，SKILL.md 里靠
  `{{ reference: xxx }}` 引用，避免主文件臃肿。

## Better Auth / 账号系统（packages/website）

- 使用 Better Auth + 邮箱密码 + GitHub OAuth（M2，commit 2e90655）。
- session 存 D1，cookie 配置在 `lib/auth.ts`。
- dashboard 路由分组 `(dashboard)`；marketing 路由分组 `(marketing)`。
- 注意 Better Auth 的 trustedOrigins 要把生产域 + dev 域都写上，否则 OAuth 回跳被拒。

## 付费 token 钱包（M4，packages/website + packages/api）

> 我们没有"档位 + 月度配额"模型，是**统一 token 钱包**：注册送 10K，月卡每月续，
> 补充包随用随买。所有云端服务（LLM 按 model 分价、PDF 200、JD 300）按 token 扣。BYOK
> 用户的 LLM 走 muirouter 自己付，但 PDF / JD 仍扣 muicv tokens。

- **D1 原子扣账：必须单 statement**。`UPDATE tokenBalance SET balance = balance - ?
  WHERE userId = ? AND balance >= ? RETURNING balance` —— SQLite 内部 page-level mutex
  保证原子，`first()` 返回 null 即余额不足。绝不允许"先 SELECT 再 UPDATE"两步走，
  并发场景会双扣。
- **D1 原子入账：INSERT…ON CONFLICT…DO UPDATE**。同语义；行不存在自动建。
- **ledger 写失败不阻塞业务**：`charge` 在 UPDATE 成功后 `INSERT INTO tokenLedger`
  写流水，失败 `.catch(() => {})` 吞掉。`lifetimeSpent` 字段是真值源，财务对账
  看余额表而不是流水表。
- **lazy init signup_bonus**：用 `INSERT OR IGNORE INTO tokenBalance ... RETURNING`，
  RETURNING 仅对真新建的行返回，conflict 时返回 null —— 借此判断是否要写 signup_bonus
  流水。三处入口（website /api/me、api worker /me、dashboard 首页）都调，并发安全。

## μtoken 内部存储单位 + 按 model 分价 LLM 计费（2026-05）

> 历史：原本 `tokenBalance.balance` 直接存「显示 token」整数，扣费按
> `ceil((prompt+completion) × 1.1)`，model-agnostic。新增 Xiaomi Mimo 上游 +
> 4 model 价差 60× 后，整数 ceil 在最便宜的 mimo-v2.5（input 0.008/上游 token）上
> 会让小请求被多扣 100×+，老公式必须替换。

- **存储单位 ×1e4**：`tokenBalance.balance` / `lifetimeEarned` / `lifetimeSpent` /
  `tokenLedger.delta` 都改成 **μtoken**（1 显示 token = 10_000 μ）。SQLite INTEGER
  64-bit，存量最大值 ×1e4 后远未触顶。Migration `0011_scale_tokens_to_micro.sql`
  一次性 `UPDATE … SET col = col * 10000`，无回滚路径，先 `--local` apply 后核对再发生产。
- **边界**：写路径在调 wallet 前 `displayToMicro`（PDF / JD / Stripe webhook）；
  读路径在 API response handler / SSR 渲染时 `microToDisplay`。**wallet.ts 内部
  统一 μtoken**，函数签名不再有 display/μ 混用。helpers 都在 `packages/shared/src/pricing.ts`。
- **按 model 分价**：`LLM_PRICING` 表给每个 model 一对 `inputRate`（显示 token / 上游 prompt token）
  和 `outputRate`（同口径，给 completion）。新公式
  `ceil((prompt × inputRate + completion × outputRate) × 1.1 × TOKEN_PRECISION)` 直接返 μtoken，
  取整在 μ 层（4 位精度），上面那个溢扣问题彻底没了。
- **支持 4 个 model**：`gpt-5.5` / `gpt-5.4` / `mimo-v2.5-pro` / `mimo-v2.5`。
  锚点 1 显示 token = $1e-5（从 Pro 套餐 500k/$4.99 反推）。Xiaomi 价以 ¥7/USD 折算到
  USD 后再算 rate。表外 model（含老的 `gpt-4o-mini`）一律 400 `unsupported_model`，
  让客户端显式升级 `defaultModel`——不用 fallback rate 是为了避免悄悄按错价格扣。
- **平台第二上游**：`packages/api/src/routes/llm.ts` 在余额 > 0 路径里按 `model.startsWith('mimo-')`
  分流：`mimo-*` 走 Xiaomi（`https://token-plan-sgp.xiaomimimo.com`，`MIMO_API_KEY`），
  其它走 OpenAI（`https://api.openai.com`，`OPENAI_API_KEY`）。muirouter fallback 路径
  不被本表约束（其 model 列表由 muirouter 端管理）。前缀分流的取舍：客户端零改动、
  未来加 deepseek/moonshot 一行 case 即可；缺点是 model id 命名空间冲突时会路由错
  （目前 `mimo-` / `gpt-` 前缀够独特）。
- **prompt cache 命中分价（issue #4，2026-05-08；2026-05-10 校准）**：`LLM_PRICING` 加 `cachedInputRate`，
  从 `usage.prompt_tokens_details.cached_tokens` 读出命中数。**OpenAI 约定 cached_tokens
  已计入 prompt_tokens**，所以 `computeLlmCharge` 内部 `fresh = prompt - cached` 后分别按
  `inputRate` / `cachedInputRate` 算价；OpenAI gpt-5 系上游按 90% off 给（input × 0.1），
  mimo 系上游目前不返 cached_tokens、`cachedInputRate=inputRate` 保守持平。
  原先按 50% off 配出 ~13.6% 净加价、超出设计 10%——验算 25,438.325 token / OpenAI $0.224
  时发现，2026-05-10 校到 90% off 把 margin 拉回 ~10%。`tokenLedger.meta` 多写一个
  `cachedTokens` 字段（JSON，无 schema 迁移），admin 详情页 cached>0 时展示。

## OpenAI Chat Completions stream 注入 + 计费（packages/api）

- **默认 stream 不返 usage**，必须在请求 body 里 `stream_options: { include_usage: true }`。
  我们的代理在平台路径（无 BYOK）**强制注入**这个字段。
- 转发响应时如果 client 自己没声明 include_usage，把"choices=[] + usage 非空"的
  最后那个 SSE block 吞掉（`stripUsageChunkFromSse`），保持 OpenAI SDK 流契约。
- **tee 上游 stream**：一份给 client，一份在 `waitUntil` 里聚合 usage 后扣账，
  不阻塞响应。tee 是 Web 标准，Workers 原生支持。
- **错误响应不扣账**：`upstream.status >= 400` 时 skip charge（可能 usage 字段都没有）。
- **接受单次过冲**：pre-check 只比对 `balance > 0`，不估算本次成本（estimate 不准
  会导致"差 100 token 被拒"客诉）。post-record 之后下次请求才会被 pre-check 拦下。

## Stripe 在 Cloudflare Workers（packages/website）

- **必须用 `Stripe.createFetchHttpClient()`**：默认 Node http 在 Workers 跑不了。
  stripe-node 22 + apiVersion `2026-04-22.dahlia`。
- **必须用 `webhooks.constructEventAsync`**（不是 `constructEvent`）：依赖 SubtleCrypto，
  Workers 原生支持；同步版需要 Node crypto 跑不了。
- **webhook 必须 `request.text()` 拿 raw body**，不能 `.json()` —— 签名校验基于
  原始字节算。Next 16 App Router 不会自动 body-parse POST，所以不需要 `bodyParser=false`，
  但**别在 middleware 里读这个 request 的 body**，否则下游拿不到。
- **getOrCreateStripeCustomer 必须幂等**：先查自家 subscription 表 → 没有就
  `customers.create({ metadata: { userId } })` → 立刻 INSERT 一条 status='incomplete'
  的占位行。**不立刻 INSERT 的话**用户连续点两次升级会创出两个 customer，从此该
  user 在 Stripe 那边永远是脏的。
- **双层幂等**：(1) `stripeEvent` 表对 evt_id 去重（`onConflictDoNothing().returning()`，
  affected rows=0 即已处理）；(2) `credit()` 用 `invoice_<id>` / `checkout_<sid>` 当
  ledgerId，重复触发不重复入账。两层独立，缺一不可。
- **price_id → token 映射放代码**：不查 Stripe API（每次 webhook 多一跳），直接
  对比 `env.STRIPE_PRICE_*`。切 live mode 时改 wrangler.jsonc vars。
- **Hosted Checkout + Customer Portal**：不嵌入 Stripe Elements（省 80KB bundle）。
  取消 / 切档 / 看发票全交给 Stripe Portal，自己只写跳转。
- **Stripe API 2026-04 起 period 字段在 `subscription.items.data[0].current_period_*`**，
  不再在 subscription 顶层。webhook handler 取 period 时记得从 item 取。

## 云同步与持久化架构 (MuiCV Sync & Git)

Mui简历支持两种内容持久化策略（双通道并行，黑/白盒配对）：
- **黑盒：muicv-sync（云同步）**
  - **机制**：通过 `api.muicv.com` 提供的 API，将 `.claude/muicv/` 下的文件作为快照上传到 D1 (`resumeSnapshot` / `resumeSnapshotHistory`)。
  - **冲突策略**：Last-write-wins（以客户端最新 push 为准），自动将老版本归档进 history，最多保留 5 份历史。
  - **两类用户处理**：Client 用户（桌面端）通过 Deep Link 自动注入凭据，享有专门的 `sync_resume_to_cloud` 工具无感同步；Skill 用户则需先配置 `MUICV_API_KEY`，由 skill 引导获取并验证。
  - **预校验**：1MB / 500 文件上限检查统一放在 `packages/shared/src/resume-sync.ts`，供两端复用。

- **白盒：muicv-git**
  - **机制**：纯本地操作，通过 git 将内容存入用户自己的 GitHub / GitLab 仓库。
  - **边界**：不替用户隐式 commit，除非明确指示；教导用户使用 Git 而非掩盖 Git 的存在。避免 force push。

## 面试类 Skills 架构

面试辅导拆分为三个阶段的独立 Skill，避免单一 Agent 职责过重：
1. **模拟面试 (`muicv-interview`)**：面向面试前。采用「双输入轨设计」——如果检测到环境支持语音（如桌面 App），则开启全面反馈（内容+流利度+填充词）；如果是打字环境，则降级为仅评价内容。出题逻辑按 JD × 简历 × 轮次 × 级别动态推导。
2. **真实复盘 (`muicv-debrief`)**：面向真实面试后。属于“写文件”类型 skill，将用户口述内容落盘到 `debriefs/` 目录。Agent 明确保持中立，不下“过/挂”结论。
3. **经验反哺**：`muicv-interview` 的 P1a 阶段引入题目质量打分机制，将好题目回写到 `interviews/` 下。后续可通过聚合高分题目建立共有题库。

## muirouter OAuth 关联（packages/website + packages/api + packages/app）

> 历史：原本是「在 muirouter 自己生成 sk-gw key → 粘贴回 muicv dashboard」。2026-05 切到
> OAuth 风格：muicv 跳转去 muirouter 授权 → muirouter redirect 回 muicv 带 code →
> muicv 服务端用 code 换 access_token + refresh_token，**走 hsm.meathill.com 信封加密
> 存储**（不在本仓库做 HKDF / AES-GCM），D1 只留 metadata（过期时间、scope、defaultModel
> 等）。HSM path = `muicv/muirouter/<userId>`，value 是 JSON `{accessToken, refreshToken}`。

### muirouter 端协议（与 muirouter 仓库同步演进）

- 授权页：`GET https://muirouter.com/oauth/authorize?client_id=muicv&redirect_uri=...&state=...&scope=balance,llm&response_type=code`
- 换 token：`POST https://api.muirouter.com/oauth/token` body `{grant_type, code|refresh_token, redirect_uri?, client_id, client_secret}` → `{access_token, refresh_token, expires_in, scope, user:{id,email,username}}`
- 撤销：`POST https://api.muirouter.com/oauth/revoke` body `{token, client_id, client_secret}`
- LLM / 余额：沿用现有 `Authorization: Bearer <access_token>`（OAuth token 兼容历史的 sk-gw PAT）

### 数据流

```
dashboard 或 app 点关联
  → website /api/muirouter/oauth/start?from=web|app[&app_state=...]
  → state 写 KV（5min TTL，value={userId, from, appState?}），302 跳 muirouter authorize
  → 用户授权 → muirouter 302 回 /api/muirouter/oauth/callback?code=...&state=...
  → callback：删 KV state → POST /oauth/token 换 token → encrypt → upsert muirouterLink
  → web: 302 /dashboard/muirouter?linked=1
    app: 302 muicv://muirouter-linked?app_state=...&ok=1，OS 唤起 Electron
```

### LLM 分流（packages/api/src/routes/llm.ts）

- muicv `tokenBalance.balance > 0` → 走 OPENAI_API_KEY，扣 muicv 余额
- 余额=0 + 有 muirouterLink → 解密 access_token（必要时 refresh）走 muirouter，**不**扣 muicv；客户端没传 model 时注入 muirouterLink.defaultModel
- 余额=0 + 无 link → 402 insufficient_balance

### Token 存储 / 状态共享

- **token 走 HSM**：`hsm.meathill.com` 提供信封加密 + 客户端密钥分离（X-HSM-Secret），
  `packages/shared/src/hsm-client.ts` 是封装。muicv 仓库不再做 HKDF / AES-GCM——
  原 `lib/crypto.ts` 已删除。同一个 HSM secret 在 website 和 api worker 各 wrangler
  secret put 一份才能互通。
- 状态单一来源：D1 `muirouterLink` → `/api/me` 把 muirouter 字段（email / defaultModel /
  balance / 更新时间）一起返回，dashboard 与 Electron app renderer 都从这里读，无轮询无 SSE。
- Electron deep link：扩展现有 `muicv://callback`（自动登录）模式，新增
  `muicv://muirouter-linked?app_state=...`，main 进程的 pendingMuirouter map 校验
  app_state 后推 `muirouter:linked` IPC 给 renderer，renderer 重拉 `/api/me`。

### 环境变量

需 wrangler secret put（website + api 各一份，值相同）：

- `MUIROUTER_OAUTH_CLIENT_SECRET` — muirouter 注册 client 时拿到的 secret
- `HSM_SECRET` — hsm.meathill.com 的 X-HSM-Secret

可选覆盖：`MUIROUTER_OAUTH_AUTHORIZE_URL` / `MUIROUTER_OAUTH_TOKEN_URL` /
`MUIROUTER_OAUTH_REVOKE_URL` / `MUIROUTER_OAUTH_CLIENT_ID` / `MUICV_BASE_URL` /
`HSM_BASE_URL`，联调可指向 mock。

## packages/shared 跨端展示常量

> 所有跨包的展示文案 / 格式化 / 价目表都进 `@muicv/shared`，禁止在 app / website 各写一份。

- **格式化**：`formatCents(cents, currency?)` 在 `src/format.ts`；webside SSR 与 Electron
  renderer 都从这里 import。日期 / 时间故意不放这里——SSR 输出必须确定性（避免
  hydration mismatch），各端按自己的需求硬格式化（website 用 `YYYY-MM-DD HH:mm`、
  app 用 `toLocaleString()`）。
- **会员档位 label**：`getPlanLabel(plan)` 在 `src/pricing.ts`，含 free/pro/max 三档
  + 空值兜底 + 未知 plan 透传。**禁止在 UI 组件里 hardcode `PLAN_LABEL` map**——
  以后增减档位只在 pricing.ts 改一处。
- **LLM 元数据**：`LLM_DISPLAY_META` / `SUPPORTED_LLM_MODELS` / `DEFAULT_LLM_MODEL`
  也在 `src/pricing.ts`，模型选择 UI / 计费 / API 校验都从这里读。

## 测试

- **node:test + 默认 ts 直接跑**（`node --test`）；不要引 vitest / jest，除非有强需求。
- `packages/shared` 覆盖核心工具：pricing（含 getPlanLabel）/ format / resume-sync /
  hsm-client / muirouter-oauth + smoke test，46 个 case。
- `packages/api` 用 Hono 的 `app.request()` 测路由，不需要 wrangler / miniflare；
  覆盖入口校验、CORS 白名单、api-key middleware 各分支（共 21 个 case）。
- `packages/app` 测纯逻辑 helper（chat-utils 等），不测 React 组件 / IPC —— 投入
  比回报大，留给手测和 dogfood。
- D1 binding 在测试里用极简 mock（`prepare/bind/run/first` 全部返回 stub）。

## packages/app macOS 签名 + 公证

> 不签 → 用户下载装完直接「已损坏」打不开。本节记录决策依据 + 凭据怎么拿、放哪、丢了怎么办。
> 实际配置见 `packages/app/electron-builder.yml` mac 段、`packages/app/build/entitlements.mac.plist`、
> `.github/workflows/release.yml` mac job。

- **三件套缺一不可**：codesign（盖章）→ notarize（让 Apple 扫描）→ staple（票据钉到 .app）。
  electron-builder 26 把 staple 自动做掉，前两步靠环境变量驱动。
- **identity 字段陷阱**：`mac.identity: null` 是「显式跳过签名」，**不是**「自动选」。
  要 auto-discover 必须**整个字段不存在**。多个 Developer ID Application 共存时，
  用 `CSC_NAME` 环境变量或 `identity: "Developer ID Application: 名字 (TEAMID)"` 显式锁定。
- **证书选 Developer ID Application**，不是 Mac App Distribution（那是上架 App Store 的）。
  Xcode → Settings → Accounts → Manage Certificates → + 一键装到 login keychain。
  `security find-identity -v -p codesigning` 能看到就行。
- **公证鉴权用 App Store Connect API Key**（不用 Apple ID + app-specific password）：
  CI 友好、不绑个人 2FA、可独立轮换。在 App Store Connect → Users and Access →
  Integrations → Team Keys 生成，角色 Developer 即够。**.p8 只能下载一次**，丢了重新生成。
- **凭据备份**：证书 .p12（导出时设密码）+ API Key .p8 都进密码管理器（1Password / 同等）。
  本机 keychain 重装系统会丢，没备份就只能重申请。
- **GitHub Secrets**（5 条）：`CSC_LINK`（.p12 base64）/ `CSC_KEY_PASSWORD` /
  `APPLE_API_KEY_BASE64`（.p8 base64）/ `APPLE_API_KEY_ID` / `APPLE_API_ISSUER`。
  Team ID 写死在 yml 里不算敏感。
- **hardenedRuntime + entitlements 的关系**：开 hardenedRuntime 是公证硬性要求，
  但开了之后默认禁用 JIT / 未签名可执行内存 / dyld 环境变量 / 网络访问。entitlements
  必须显式声明 `allow-jit` / `allow-unsigned-executable-memory` /
  `allow-dyld-environment-variables` / `network.client` 这 4 条，缺一项 Electron 启动直接 crash。
- **改 entitlements 必须重新公证**：ticket 是和文件哈希绑定的，entitlements 一变 hash 变，
  老 ticket 就废了。
- **本地手动验证**：
  ```bash
  codesign --verify --deep --strict --verbose=2 release/mac-arm64/Mui简历.app
  spctl -a -vvv -t install release/mac-arm64/Mui简历.app
  # 期望：accepted, source=Notarized Developer ID
  ```
- **公证排队**：第一次 5-15 分钟，之后通常 1-3 分钟。出错用
  `xcrun notarytool log <submission-id> --key ... --key-id ... --issuer ...` 查具体原因，
  也可以看 `~/Library/Logs/electron-builder/notarize.log`。
- **常见踩坑**：证书类型选错（Mac App Distribution 不能用于 dmg）/ entitlements 漏 JIT
  导致启动 crash / hardenedRuntime 没开导致公证拒绝 / dmg 复制 .app 后没 staple
  导致离线打开仍报错（electron-builder 自动 staple，不用手动）。
- **Windows / Linux**：Linux AppImage 不需要签名；Windows SmartScreen 是软警告（用户能点
  Run anyway），Authenticode 证书要钱（OV 便宜但要养信誉，EV 贵但秒生效），暂未做。
