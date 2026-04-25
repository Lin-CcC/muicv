import { WaitlistForm } from './waitlist-form';

const WORKFLOW_STEPS = [
  {
    skill: 'muicv-core',
    title: '收集素材',
    desc: '首次说"帮我准备简历"，skill 自动建 .claude/muicv/，引导收集 profile / experience / projects 等。',
  },
  {
    skill: 'muicv-jobs:fetch',
    title: '抓取 JD',
    desc: '粘一个招聘 URL，skill 调 API 清洗成 markdown 写到 targets/。',
  },
  {
    skill: 'muicv-jobs:match',
    title: '匹配度分析',
    desc: '对比 JD 和本地素材，告诉你覆盖了多少关键词、缺什么，避免盲投。',
  },
  {
    skill: 'muicv-generate',
    title: '生成简历',
    desc: '针对具体 JD 挑选、排序、改写素材到 versions/<slug>-<date>.md。',
  },
  {
    skill: 'muicv-critique',
    title: '评审迭代',
    desc: 'STAR / 量化 / 关键词对齐 / 长度 等 7 维度评分，P0/P1/P2 提建议。',
  },
  {
    skill: 'muicv-render',
    title: '导出 PDF',
    desc: '调服务端 API（Cloudflare Container + Puppeteer）渲染成 A4 PDF。',
  },
  {
    skill: 'muicv-jobs:apply',
    title: '准备投递',
    desc: '生成 cover letter + 投递 checklist 到 applications/。投递由你手动完成。',
  },
];

const FAQ_ITEMS = [
  {
    q: '我的简历数据存在哪？谁能看到？',
    a: (
      <>
        全部存在你当前项目目录下的 <Code>.claude/muicv/</Code>{' '}
        文件夹里，纯 Markdown 文件。要不要入 git、要不要备份到云盘、要不要分享给别人——完全由你决定。
        我们的服务器只在你主动调 API（PDF 渲染、JD 抓取）时短暂经手数据，不留存。
      </>
    ),
  },
  {
    q: '现在要付费吗？',
    a: (
      <>
        不要。当前 MVP 阶段，PDF 渲染和 JD 抓取的 API 免费，按 IP 限速。
        将来会上 BYOK（用你自己的 OpenAI / Anthropic API key）和订阅档位，但 skill 本身永远免费。
      </>
    ),
  },
  {
    q: '什么是 BYOK？muirouter 是什么？',
    a: (
      <>
        BYOK = Bring Your Own Key，用你自己的 LLM API key（OpenAI / Anthropic / Gemini 等）。{' '}
        <a href="https://muirouter.com" className="underline decoration-forest decoration-1 underline-offset-4 hover:text-forest">
          muirouter
        </a>{' '}
        是一个统一接入多家 LLM 的代理（类似 OpenRouter），不想自己注册那么多家的话，
        通过 muirouter 充值就能在 muicv 桌面 app 里用。
      </>
    ),
  },
  {
    q: '桌面 app 什么时候发布？',
    a: (
      <>
        基于 OpenAI Agent SDK 的 electron 桌面端正在规划，给不用 AI agent 的求职者用。
        没有具体时间表，<strong>留邮箱进 waitlist</strong>，发布会第一时间通知你。
        在那之前，开发者可以直接用 skill 套件（上面有安装命令）。
      </>
    ),
  },
  {
    q: '支持英文 / 双语简历吗？',
    a: (
      <>
        Skill 不强制语言——你的素材是中文，简历就是中文；JD 是英文，simulate 出来的简历会按英文风格写。
        双语版（中英对照）作为后续模板规划中。
      </>
    ),
  },
  {
    q: '能投递到 LinkedIn / Boss 直聘吗？',
    a: (
      <>
        不能自动投递。我们只帮你抓 JD、生成针对性简历、写 cover letter，
        真正的"按提交按钮"由你手动完成——这是有意为之，避免账号风险和 ToS 违规。
      </>
    ),
  },
];

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded-sm bg-paper px-1.5 py-0.5 font-mono text-[0.86em] text-ink ring-1 ring-rule">
      {children}
    </code>
  );
}

function Monogram() {
  return (
    <span
      aria-hidden
      className="inline-flex h-7 w-7 items-center justify-center rounded-sm bg-ink font-display text-[15px] font-semibold leading-none tracking-tight text-cream"
    >
      M
    </span>
  );
}

function ArrowDown() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path
        d="M12 4v16m0 0l-6-6m6 6l6-6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowUpRight() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden>
      <path
        d="M7 17L17 7M17 7H8M17 7v9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function WebsiteHomePage() {
  return (
    <div className="relative">
      {/* 顶部细栏 */}
      <header className="sticky top-0 z-30 border-b border-rule bg-cream/85 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3 md:px-8">
          <a href="/" className="flex items-center gap-2.5 text-ink no-underline">
            <Monogram />
            <span className="font-display text-[17px] font-medium tracking-tight">Mui简历</span>
          </a>
          <nav className="flex items-center gap-1 text-sm text-ink-soft">
            <a
              href="https://github.com/meathill/muicv/blob/master/docs/walkthrough.md"
              className="rounded-sm px-2.5 py-1.5 transition hover:bg-paper hover:text-ink"
            >
              文档
            </a>
            <a
              href="https://github.com/meathill/muicv"
              className="rounded-sm px-2.5 py-1.5 transition hover:bg-paper hover:text-ink"
            >
              GitHub
            </a>
            <a
              href="#install"
              className="ml-1 inline-flex items-center gap-1 rounded-sm bg-ink px-3 py-1.5 text-cream transition hover:bg-forest-deep"
            >
              立即安装
              <ArrowUpRight />
            </a>
          </nav>
        </div>
      </header>

      {/* ============ HERO ============ */}
      <section className="relative overflow-hidden border-b border-rule">
        <div className="absolute inset-0 bg-grid opacity-70" aria-hidden />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-rule-strong to-transparent" aria-hidden />

        <div className="relative mx-auto grid max-w-6xl gap-10 px-5 py-16 md:px-8 md:py-24 lg:grid-cols-12 lg:gap-12 lg:py-32">
          {/* 左 - 文字 */}
          <div className="lg:col-span-7">
            <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.18em] text-mute">
              <span className="inline-block h-px w-8 bg-rule-strong" />
              <span>v0.1 · skills + cloudflare api</span>
            </div>

            <h1 className="mt-7 font-display text-[clamp(2.6rem,7.5vw,5.5rem)] font-medium leading-[1.02] tracking-tight text-ink">
              在你熟悉的{' '}
              <span className="italic text-forest" style={{ fontVariationSettings: '"opsz" 144, "SOFT" 100' }}>
                AI&nbsp;agent
              </span>{' '}
              里
              <br />
              管理简历。
            </h1>

            <p className="mt-7 max-w-xl text-[17px] leading-[1.7] text-ink-soft">
              素材以 Markdown 存在你自己的项目目录，由你用 git 管。配套 Cloudflare API
              负责 PDF 渲染、JD 抓取这类本地不便做的事。
              <span className="text-mute">不用学新 UI、不用注册账号。</span>
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <a
                href="#install"
                className="inline-flex items-center gap-2 rounded-sm bg-ink px-5 py-3 text-[15px] font-medium text-cream shadow-edge transition hover:bg-forest-deep"
              >
                开始使用
                <ArrowDown />
              </a>
              <a
                href="https://github.com/meathill/muicv"
                className="inline-flex items-center gap-2 rounded-sm border border-rule-strong bg-cream px-5 py-3 text-[15px] font-medium text-ink transition hover:border-ink hover:bg-paper"
              >
                看 GitHub
                <ArrowUpRight />
              </a>
            </div>

            <dl className="mt-12 grid max-w-lg grid-cols-3 gap-4 border-t border-rule pt-6">
              {[
                { n: '5', l: 'skills' },
                { n: '2', l: 'API endpoints' },
                { n: '40+', l: 'compatible agents' },
              ].map((s) => (
                <div key={s.l}>
                  <dt className="font-display text-3xl font-medium text-ink tabular-nums">{s.n}</dt>
                  <dd className="mt-0.5 font-mono text-[11px] uppercase tracking-wider text-mute">{s.l}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* 右 - 终端 mock */}
          <div className="lg:col-span-5">
            <div className="relative">
              {/* 阴影投影但极轻 */}
              <div className="absolute -inset-x-2 -inset-y-2 rounded-md bg-ink/5 blur-md" aria-hidden />
              <div className="relative overflow-hidden rounded-md border border-ink/15 bg-[#1a1815] font-mono text-[12.5px] leading-relaxed text-cream/90 shadow-edge">
                <div className="flex items-center justify-between border-b border-cream/8 px-4 py-2">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-cream/15" />
                    <span className="h-2.5 w-2.5 rounded-full bg-cream/15" />
                    <span className="h-2.5 w-2.5 rounded-full bg-cream/15" />
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-cream/40">~/career — claude</span>
                </div>
                <pre className="overflow-x-auto px-4 py-4">
                  <code>
                    <span className="text-[oklch(0.78_0.13_70)]">$</span>{' '}
                    <span className="text-cream">claude</span>
                    {'\n\n'}
                    <span className="text-cream/55"># 跟它聊：</span>
                    {'\n'}
                    <span className="text-cream">{'>'}</span>{' '}
                    <span className="text-cream/90">帮我针对 Google L5 写一份简历</span>
                    {'\n\n'}
                    <span className="text-[oklch(0.7_0.15_150)]">✓</span>{' '}
                    <span className="text-cream/85">muicv-jobs:fetch</span>
                    {'   '}
                    <span className="text-cream/40">targets/google-l5.md</span>
                    {'\n'}
                    <span className="text-[oklch(0.7_0.15_150)]">✓</span>{' '}
                    <span className="text-cream/85">muicv-jobs:match</span>
                    {'    '}
                    <span className="text-cream/40">9/12 关键词覆盖</span>
                    {'\n'}
                    <span className="text-[oklch(0.7_0.15_150)]">✓</span>{' '}
                    <span className="text-cream/85">muicv-generate</span>
                    {'      '}
                    <span className="text-cream/40">versions/google-l5-2026-04-25.md</span>
                    {'\n'}
                    <span className="text-[oklch(0.7_0.15_150)]">✓</span>{' '}
                    <span className="text-cream/85">muicv-render</span>
                    {'        '}
                    <span className="text-cream/40">→ google-l5.pdf</span>{' '}
                    <span className="text-[oklch(0.78_0.13_70)]">2 页 · 148 KB</span>
                    {'\n\n'}
                    <span className="text-cream/55">done in 8.2s</span>
                  </code>
                </pre>
              </div>
              <div className="mt-3 flex items-center gap-2 font-mono text-[11px] text-mute">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-forest" />
                端到端，全程在 terminal 内
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ 为什么 ============ */}
      <section className="border-b border-rule">
        <div className="mx-auto max-w-6xl px-5 py-20 md:px-8 md:py-28">
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-mute">— 设计原则</p>
              <h2 className="mt-3 font-display text-[clamp(2rem,4vw,3rem)] font-medium leading-[1.05] tracking-tight">
                为什么<br />
                <span className="italic">不</span>做 Chatbot？
              </h2>
            </div>
            <div className="lg:col-span-8">
              <p className="font-display text-[clamp(1.3rem,2vw,1.55rem)] italic leading-[1.45] text-ink">
                AI agent 本身就会对话、有记忆、能操作文件——再做一遍 chat UI 和记忆库是重复建设。
                Mui简历只做 AI agent 做不好的事：结构化的简历工作流，和服务端能力。
              </p>

              <div className="mt-12 grid gap-8 sm:grid-cols-3">
                {[
                  {
                    n: '01',
                    t: '数据主权',
                    d: '所有素材是 Markdown 文件，存在你自己的项目里。要不要入 git、备份、同步——完全由你决定。',
                  },
                  {
                    n: '02',
                    t: 'agent 无关',
                    d: '一套 skill 在 Claude Code、Codex、Cursor、OpenCode 等 40+ agent 通用。换工具不换数据。',
                  },
                  {
                    n: '03',
                    t: '不编造',
                    d: '所有生成严格限定在你明确写下的事实里。缺素材就追问或留空，绝不替你"发挥"。',
                  },
                ].map((item) => (
                  <div key={item.n} className="space-y-2">
                    <div className="font-display text-2xl font-medium tabular-nums text-forest">{item.n}</div>
                    <div className="text-[15px] font-semibold text-ink">{item.t}</div>
                    <p className="text-[14px] leading-[1.65] text-ink-soft">{item.d}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ 工作流（editorial 目录式） ============ */}
      <section className="border-b border-rule">
        <div className="mx-auto max-w-6xl px-5 py-20 md:px-8 md:py-28">
          <div className="flex items-end justify-between gap-8">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-mute">— 端到端</p>
              <h2 className="mt-3 font-display text-[clamp(2rem,4vw,3rem)] font-medium leading-[1.05] tracking-tight">
                从空目录到 PDF，<br className="hidden md:block" />
                七个 skill 走完。
              </h2>
            </div>
            <p className="hidden max-w-xs text-[14px] leading-[1.65] text-ink-soft md:block">
              全程在 terminal 内对话完成，文件落到你项目里，git 即可追踪。
            </p>
          </div>

          <ol className="mt-14 divide-y divide-rule border-y border-rule">
            {WORKFLOW_STEPS.map((step, idx) => (
              <li
                key={step.skill}
                className="group grid grid-cols-[auto_1fr] items-baseline gap-x-6 gap-y-1 px-1 py-5 transition-colors hover:bg-forest-soft/60 sm:grid-cols-[auto_minmax(0,11rem)_1fr] sm:gap-x-8 md:px-3"
              >
                <span className="font-display text-3xl font-medium tabular-nums text-mute transition-colors group-hover:text-forest sm:text-4xl">
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <span className="col-span-1 font-mono text-[14px] font-medium text-ink sm:col-span-1">
                  {step.skill}
                </span>
                <span className="col-span-2 max-w-2xl text-[15px] leading-[1.65] text-ink-soft sm:col-span-1">
                  <span className="font-semibold text-ink">{step.title}</span>
                  <span className="mx-2 text-rule-strong">·</span>
                  {step.desc}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ============ Claude Code 用户专区（深色翻面） ============ */}
      <section id="install" className="relative overflow-hidden border-b border-forest-deep bg-[oklch(0.16_0.022_150)] text-cream">
        <div className="absolute inset-0 opacity-30" aria-hidden>
          <div
            className="h-full w-full"
            style={{
              backgroundImage:
                'radial-gradient(circle, oklch(0.95 0.03 150 / 0.06) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />
        </div>

        <div className="relative mx-auto max-w-6xl px-5 py-20 md:px-8 md:py-28">
          <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-5">
              <span className="inline-flex items-center gap-2 rounded-full border border-cream/15 bg-cream/5 px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-cream/80">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[oklch(0.72_0.16_150)]" />
                已经可用
              </span>
              <h2 className="mt-5 font-display text-[clamp(1.9rem,3.5vw,2.75rem)] font-medium leading-[1.1] tracking-tight">
                已经在用 AI agent？<br />
                <span className="italic text-cream/85">现在就能开始。</span>
              </h2>
              <p className="mt-5 max-w-md text-[15px] leading-[1.7] text-cream/75">
                不需要等桌面 app。装了 Claude Code、Codex、Cursor、OpenCode 等任何一种支持
                skill 协议的 agent，下面任选一种安装方式，5 秒装完。
              </p>

              <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-[13px]">
                <a
                  href="https://github.com/meathill/muicv/blob/master/docs/walkthrough.md"
                  className="inline-flex items-center gap-1.5 text-cream/85 underline decoration-cream/30 decoration-1 underline-offset-4 hover:decoration-cream"
                >
                  7 步演示
                  <ArrowUpRight />
                </a>
                <a
                  href="https://github.com/meathill/muicv#使用"
                  className="inline-flex items-center gap-1.5 text-cream/85 underline decoration-cream/30 decoration-1 underline-offset-4 hover:decoration-cream"
                >
                  完整文档
                  <ArrowUpRight />
                </a>
              </div>
            </div>

            <div className="grid gap-4 lg:col-span-7">
              <InstallCard
                title="Claude Code Plugin Marketplace"
                meta="官方机制 / /plugin 命令"
                code={`/plugin marketplace add meathill/muicv
/plugin install muicv@meathill`}
                preferred
              />
              <InstallCard
                title="npx skills"
                meta="多 agent 通用 / 40+ 兼容"
                code={`npx skills add meathill/muicv -g`}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ============ FAQ + Waitlist 平行栏 ============ */}
      <section className="border-b border-rule">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 md:px-8 md:py-28 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-7">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-mute">— 常见问题</p>
            <h2 className="mt-3 font-display text-[clamp(2rem,4vw,3rem)] font-medium leading-[1.05] tracking-tight">
              想问的<span className="italic">大概率</span>在这里。
            </h2>

            <div className="mt-10 divide-y divide-rule border-y border-rule">
              {FAQ_ITEMS.map((item, idx) => (
                <details key={item.q} className="group" open={idx === 0}>
                  <summary className="flex cursor-pointer list-none items-start gap-4 py-5 transition-colors hover:bg-paper">
                    <span className="mt-1 font-display text-base font-medium tabular-nums text-mute">
                      Q{String(idx + 1).padStart(2, '0')}
                    </span>
                    <span className="flex-1 font-display text-[18px] font-medium leading-snug text-ink">
                      {item.q}
                    </span>
                    <span
                      className="mt-1 inline-block transition-transform duration-200 group-open:rotate-45 text-mute"
                      aria-hidden
                    >
                      +
                    </span>
                  </summary>
                  <div className="pb-5 pl-[3.25rem] pr-8 text-[15px] leading-[1.7] text-ink-soft">{item.a}</div>
                </details>
              ))}
            </div>
          </div>

          {/* 右侧 waitlist + 技术栈 */}
          <aside className="space-y-10 lg:col-span-5 lg:sticky lg:top-24 lg:self-start">
            {/* Waitlist */}
            <div className="relative overflow-hidden rounded-md border border-rule bg-paper p-7">
              <div
                className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-amber-soft blur-2xl"
                aria-hidden
              />
              <div className="relative">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-mute">— Waitlist</p>
                <h3 className="mt-3 font-display text-2xl font-medium leading-tight text-ink">
                  桌面 app <span className="italic text-amber">开发中</span>。
                </h3>
                <p className="mt-3 text-[14px] leading-[1.7] text-ink-soft">
                  独立 desktop app，让不用 AI agent 的求职者也能用。支持 BYOK 或通过 muirouter 购买额度。
                  留个邮箱，发布时第一时间通知你。
                </p>
                <div className="mt-5">
                  <WaitlistForm source="landing-hero" />
                </div>
              </div>
            </div>

            {/* 技术栈 */}
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-mute">— 技术栈</p>
              <ul className="mt-4 space-y-3 text-[14px] leading-[1.6] text-ink-soft">
                {[
                  ['Skills', 'Markdown + YAML frontmatter（Claude skill 规范）'],
                  ['API', 'Cloudflare Worker + Hono'],
                  ['PDF / 抓取', 'Cloudflare Container · Chromium · Puppeteer'],
                  ['分发', 'Plugin Marketplace + npx skills + GitHub'],
                ].map(([k, v]) => (
                  <li key={k} className="flex items-baseline gap-3">
                    <span className="w-20 shrink-0 font-mono text-[11px] uppercase tracking-wider text-mute">
                      {k}
                    </span>
                    <span className="flex-1 text-ink-soft">{v}</span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </section>

      {/* ============ Footer ============ */}
      <footer className="bg-paper">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:px-8 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <a href="/" className="flex items-center gap-2.5 text-ink no-underline">
              <Monogram />
              <span className="font-display text-[17px] font-medium tracking-tight">Mui简历</span>
            </a>
            <p className="mt-4 max-w-xs text-[13px] leading-[1.65] text-ink-soft">
              在你熟悉的 AI agent 里管理简历。Skills + 本地 Markdown + Cloudflare API。
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 text-[13px] sm:grid-cols-3 lg:col-span-7">
            <FooterCol
              label="产品"
              links={[
                ['立即安装', '#install'],
                ['Waitlist', '#install'],
                ['桌面 app', '#'],
              ]}
            />
            <FooterCol
              label="文档"
              links={[
                ['walkthrough', 'https://github.com/meathill/muicv/blob/master/docs/walkthrough.md'],
                ['README', 'https://github.com/meathill/muicv#readme'],
                ['DEPLOYMENT', 'https://github.com/meathill/muicv/blob/master/DEPLOYMENT.md'],
              ]}
            />
            <FooterCol
              label="社区"
              links={[
                ['GitHub', 'https://github.com/meathill/muicv'],
                ['Issues', 'https://github.com/meathill/muicv/issues'],
                ['作者博客', 'https://meathill.com'],
              ]}
            />
          </div>
        </div>
        <div className="border-t border-rule">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-6 text-[12px] text-mute md:flex-row md:items-center md:justify-between md:px-8">
            <span>© 2026 meathill · UNLICENSED（暂时）</span>
            <span className="font-mono text-[11px] uppercase tracking-wider">
              built with skills · cloudflare · puppeteer
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/** 安装方式卡片：深色 section 内嵌的玻璃感卡（克制版，不滥用 blur）。 */
function InstallCard({
  title,
  meta,
  code,
  preferred,
}: {
  title: string;
  meta: string;
  code: string;
  preferred?: boolean;
}) {
  return (
    <div className="group relative overflow-hidden rounded-md border border-cream/12 bg-cream/[0.04] p-5 transition-colors hover:border-cream/22 hover:bg-cream/[0.06]">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-display text-[17px] font-medium text-cream">{title}</h3>
            {preferred && (
              <span className="rounded-full border border-[oklch(0.72_0.16_150)] bg-[oklch(0.72_0.16_150)]/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[oklch(0.78_0.16_150)]">
                推荐
              </span>
            )}
          </div>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-cream/55">{meta}</p>
        </div>
      </div>
      <pre className="mt-4 overflow-x-auto rounded-sm border border-cream/8 bg-[oklch(0.1_0.015_150)] p-4 font-mono text-[12.5px] leading-relaxed text-cream/85">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function FooterCol({ label, links }: { label: string; links: [string, string][] }) {
  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-mute">{label}</p>
      <ul className="mt-4 space-y-2">
        {links.map(([name, href]) => (
          <li key={name}>
            <a
              href={href}
              className="text-ink-soft underline decoration-rule decoration-1 underline-offset-4 transition hover:text-ink hover:decoration-ink"
            >
              {name}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
