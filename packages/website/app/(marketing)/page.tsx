import { headers } from 'next/headers';

import { CorgiMascot } from '@/components/corgi-mascot';
import { getAuth } from '@/lib/auth';

import { WaitlistForm } from './waitlist-form';

// 顶部 nav 要根据登录态切显"登录"或"Dashboard"，所以页面跑 SSR（不要 SSG），
// 否则 build 时 prerender 会失败：Cloudflare D1 在 build context 拿不到。
export const dynamic = 'force-dynamic';

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
        全部存在你当前项目目录下的 <Code>.claude/muicv/</Code> 文件夹里，纯 Markdown 文件。要不要入
        git、要不要备份到云盘、要不要分享给别人——完全由你决定。 我们的服务器只在你主动调 API（PDF 渲染、JD
        抓取）时短暂经手数据，不留存。
      </>
    ),
  },
  {
    q: '怎么收费？档位什么样？',
    a: (
      <>
        三档 + BYOK：
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong>Free</strong>：每月免费 token 试用，可输出 markdown 简历；不含 PDF 导出 / 招聘库 / 自动投递
          </li>
          <li>
            <strong>Pro</strong>（M4 起开放）：更多 token + PDF + 招聘库 + 辅助投递（数量有限）
          </li>
          <li>
            <strong>Max</strong>：不受限制
          </li>
          <li>
            <strong>BYOK</strong>（覆盖任意档）：在 dashboard 绑定 muirouter，LLM 走你自己 muirouter 余额， 不消耗平台
            token。功能权限按所在档（Free 即可启用）
          </li>
        </ul>
        Skill 本身永远免费——开发者用{' '}
        <code className="rounded bg-fluff px-1 py-0.5 font-mono text-[12px]">npx skills add</code> 直接接入 Claude Code
        等 agent。
      </>
    ),
  },
  {
    q: '什么是 BYOK？muirouter 是什么？',
    a: (
      <>
        BYOK = Bring Your Own Key。在{' '}
        <a
          href="https://muirouter.com"
          className="font-semibold text-yellow-deep underline decoration-corgi decoration-2 underline-offset-4 hover:decoration-yellow"
        >
          muirouter.com
        </a>{' '}
        充一笔 LLM 余额，把 sk-gw key 绑到 muicv dashboard。所有 LLM 调用都走你自己的 muirouter 余额—— muirouter
        是统一接入多家 LLM 的代理（OpenAI / Anthropic / Gemini 等都通），余额可以跨任何 BYOK 服务复用。
      </>
    ),
  },
  {
    q: '桌面 app 什么时候发布？',
    a: (
      <>
        基于 OpenAI Agent SDK 的 electron 桌面端正在规划，给不用 AI agent 的求职者用。 没有具体时间表，
        <strong>留邮箱进 waitlist</strong>，发布会第一时间通知你。 在那之前，开发者可以直接用 skill
        套件（上面有安装命令）。
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
    <code className="rounded bg-fluff px-1.5 py-0.5 font-mono text-[0.86em] text-yellow-deep ring-1 ring-corgi/40">
      {children}
    </code>
  );
}

/** 狗爪小印 —— 装饰用 */
function PawIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <ellipse cx="6" cy="9" rx="1.8" ry="2.4" fill="currentColor" />
      <ellipse cx="10.5" cy="6" rx="1.8" ry="2.4" fill="currentColor" />
      <ellipse cx="13.5" cy="6" rx="1.8" ry="2.4" fill="currentColor" />
      <ellipse cx="18" cy="9" rx="1.8" ry="2.4" fill="currentColor" />
      <path
        d="M12 11c-3 0-5 2.5-5 5 0 1.8 1.5 3 3.2 3 0.8 0 1.2-.4 1.8-.4s1 .4 1.8.4c1.7 0 3.2-1.2 3.2-3 0-2.5-2-5-5-5z"
        fill="currentColor"
      />
    </svg>
  );
}

function Sparkle() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 wiggle" aria-hidden>
      <path d="M12 2 L13.6 9.4 L21 12 L13.6 14.6 L12 22 L10.4 14.6 L3 12 L10.4 9.4 Z" fill="currentColor" />
    </svg>
  );
}

function ArrowDown() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path
        d="M12 4v16m0 0l-6-6m6 6l6-6"
        stroke="currentColor"
        strokeWidth="2"
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
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 荧光笔式块状高亮 —— 卡通氛围下用来强调。 */
function Highlight({ children }: { children: React.ReactNode }) {
  return (
    <span className="relative inline-block whitespace-nowrap">
      <span
        className="absolute inset-x-[-2px] bottom-[6%] -z-10 h-[42%] -skew-y-1 rounded-sm bg-corgi/80"
        aria-hidden
      />
      <span className="relative">{children}</span>
    </span>
  );
}

export default async function WebsiteHomePage() {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  const isLoggedIn = !!session?.user;

  return (
    <div className="relative">
      {/* ============ 顶部细栏 ============ */}
      <header className="sticky top-0 z-30 border-b border-rule bg-cream/85 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3 md:px-8">
          <a href="/" className="flex items-center gap-2.5 text-ink no-underline">
            <CorgiMascot className="h-8 w-8" />
            <span className="text-[17px] font-bold tracking-tight">Mui简历</span>
            <span className="hidden font-mono text-[10px] font-semibold uppercase tracking-wider text-mute sm:inline">
              by Mui 🐾
            </span>
          </a>
          <nav className="flex items-center gap-1 text-sm text-ink-soft">
            <a
              href="/download"
              className="hidden rounded px-2.5 py-1.5 transition hover:bg-fluff hover:text-ink sm:inline-block"
            >
              下载
            </a>
            <a
              href="https://github.com/meathill/muicv"
              className="rounded px-2.5 py-1.5 transition hover:bg-fluff hover:text-ink"
            >
              GitHub
            </a>
            {isLoggedIn ? (
              <a
                href="/dashboard"
                className="press ml-1 inline-flex items-center gap-1.5 rounded-lg bg-yellow px-3.5 py-1.5 font-semibold text-ink"
              >
                进入 Dashboard
                <ArrowUpRight />
              </a>
            ) : (
              <>
                <a
                  href="/sign-in"
                  className="hidden rounded px-2.5 py-1.5 transition hover:bg-fluff hover:text-ink sm:inline-block"
                >
                  登录
                </a>
                <a
                  href="/sign-up"
                  className="press ml-1 inline-flex items-center gap-1.5 rounded-lg bg-yellow px-3.5 py-1.5 font-semibold text-ink"
                >
                  注册
                  <ArrowUpRight />
                </a>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* ============ HERO ============ */}
      <section className="relative overflow-hidden border-b border-rule">
        <div className="absolute inset-0 bg-sun" aria-hidden />
        <div className="absolute inset-0 bg-grid opacity-50" aria-hidden />

        {/* 飘浮装饰 */}
        <div className="pointer-events-none absolute left-[8%] top-[18%] hidden text-corgi/40 lg:block">
          <PawIcon className="h-7 w-7" />
        </div>
        <div className="pointer-events-none absolute right-[6%] top-[60%] hidden text-corgi/30 lg:block">
          <PawIcon className="h-9 w-9 -rotate-12" />
        </div>

        <div className="relative mx-auto grid max-w-6xl gap-10 px-5 py-16 md:px-8 md:py-24 lg:grid-cols-12 lg:gap-12 lg:py-28">
          {/* 左 - 文字 */}
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full border-2 border-corgi/60 bg-fluff px-3 py-1 text-[11px] font-semibold text-yellow-deep">
              <Sparkle />
              <span>v0.1 · 由柯基 Mui 监修</span>
            </div>

            <h1 className="mt-7 text-[clamp(2.5rem,7vw,5.25rem)] font-extrabold leading-[1.05] tracking-tight text-ink">
              在你熟悉的 <Highlight>AI&nbsp;agent</Highlight> 里
              <br />
              管理简历。
            </h1>

            <p className="mt-7 max-w-xl text-[17px] leading-[1.7] text-ink-soft">
              素材以 Markdown 存在你自己的项目目录，由你用 git 管。配套 Cloudflare API 负责 PDF 渲染、JD
              抓取这类本地不便做的事。
              <span className="text-mute">不用学新 UI、不用注册账号。</span>
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <a
                href="/download"
                className="press inline-flex items-center gap-2 rounded-xl bg-yellow px-5 py-3 text-[15px] font-bold text-ink"
              >
                下载桌面 app
                <ArrowDown />
              </a>
              <a
                href="#install"
                className="press-ink inline-flex items-center gap-2 rounded-xl border-2 border-ink bg-cream px-5 py-3 text-[15px] font-bold text-ink"
              >
                或装 skill
                <ArrowUpRight />
              </a>
            </div>

            <dl className="mt-12 grid max-w-lg grid-cols-3 gap-4 border-t-2 border-dotted border-rule-strong pt-6">
              {[
                { n: '5', l: 'skills' },
                { n: '2', l: 'API endpoints' },
                { n: '40+', l: 'compatible agents' },
              ].map((s) => (
                <div key={s.l}>
                  <dt className="text-3xl font-extrabold text-yellow-deep tabular-nums">{s.n}</dt>
                  <dd className="mt-0.5 font-mono text-[11px] uppercase tracking-wider text-mute">{s.l}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* 右 - 终端 mock */}
          <div className="lg:col-span-5">
            <div className="relative">
              {/* 装饰：右上角立耳柯基头 */}
              <div className="absolute -right-3 -top-7 z-10 hidden md:block">
                <CorgiMascot className="h-16 w-16 drop-shadow-[0_3px_0_oklch(0.62_0.14_70)]" />
              </div>
              {/* 暖底投影 */}
              <div className="absolute -inset-x-1 -inset-y-1 rounded-2xl bg-yellow/15 blur-md" aria-hidden />
              <div className="relative overflow-hidden rounded-2xl border-2 border-ink/85 bg-[#1a1815] font-mono text-[12.5px] leading-relaxed text-cream/90 shadow-[0_5px_0_0_oklch(0.24_0.04_65)]">
                <div className="flex items-center justify-between border-b border-cream/8 px-4 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-tongue/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-yellow/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-corgi/80" />
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-cream/40">~/career — claude</span>
                </div>
                <pre className="overflow-x-auto px-4 py-4">
                  <code>
                    <span className="text-[oklch(0.86_0.13_85)]">$</span> <span className="text-cream">claude</span>
                    {'\n\n'}
                    <span className="text-cream/55"># 跟它聊：</span>
                    {'\n'}
                    <span className="text-[oklch(0.86_0.13_85)]">{'>'}</span>{' '}
                    <span className="text-cream/95">帮我针对 Google L5 写一份简历</span>
                    {'\n\n'}
                    <span className="text-[oklch(0.86_0.13_85)]">✓</span>{' '}
                    <span className="text-cream/85">muicv-jobs:fetch</span>
                    {'   '}
                    <span className="text-cream/40">targets/google-l5.md</span>
                    {'\n'}
                    <span className="text-[oklch(0.86_0.13_85)]">✓</span>{' '}
                    <span className="text-cream/85">muicv-jobs:match</span>
                    {'    '}
                    <span className="text-cream/40">9/12 关键词覆盖</span>
                    {'\n'}
                    <span className="text-[oklch(0.86_0.13_85)]">✓</span>{' '}
                    <span className="text-cream/85">muicv-generate</span>
                    {'      '}
                    <span className="text-cream/40">versions/google-l5-2026-04-25.md</span>
                    {'\n'}
                    <span className="text-[oklch(0.86_0.13_85)]">✓</span>{' '}
                    <span className="text-cream/85">muicv-render</span>
                    {'        '}
                    <span className="text-cream/40">→ google-l5.pdf</span>{' '}
                    <span className="text-[oklch(0.7_0.16_25)]">2 页 · 148 KB</span>
                    {'\n\n'}
                    <span className="text-cream/55">done in 8.2s 🐾</span>
                  </code>
                </pre>
              </div>
              <div className="mt-3 flex items-center gap-2 font-mono text-[11px] text-mute">
                <span className="inline-block h-2 w-2 rounded-full bg-yellow" />
                端到端，全程在 terminal 内
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ 为什么 ============ */}
      <section className="border-b border-rule">
        <div className="mx-auto max-w-6xl px-5 py-20 md:px-8 md:py-24">
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-yellow-deep">— 设计原则</p>
              <h2 className="mt-3 text-[clamp(2rem,4vw,3rem)] font-extrabold leading-[1.05] tracking-tight">
                为什么
                <br />
                <span className="relative inline-block">
                  <span
                    className="absolute inset-x-[-4px] bottom-[8%] -z-10 h-[36%] -skew-y-2 rounded-sm bg-corgi/80"
                    aria-hidden
                  />
                  <span className="relative">不</span>
                </span>{' '}
                做 Chatbot？
              </h2>
            </div>
            <div className="lg:col-span-8">
              <p className="text-[clamp(1.2rem,1.8vw,1.45rem)] font-semibold leading-[1.5] text-ink">
                AI agent 本身就会对话、有记忆、能操作文件——再做一遍 chat UI 和记忆库是重复建设。 Mui简历只做 AI agent
                做不好的事：结构化的简历工作流，和服务端能力。
              </p>

              <div className="mt-12 grid gap-5 sm:grid-cols-3">
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
                  <div
                    key={item.n}
                    className="rounded-2xl border-2 border-ink bg-cream p-5 transition-transform hover:-translate-y-1"
                  >
                    <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-yellow text-sm font-extrabold text-ink tabular-nums">
                      {item.n}
                    </div>
                    <div className="mt-3 text-[15px] font-bold text-ink">{item.t}</div>
                    <p className="mt-1.5 text-[14px] leading-[1.65] text-ink-soft">{item.d}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ 工作流 ============ */}
      <section className="border-b border-rule">
        <div className="mx-auto max-w-6xl px-5 py-20 md:px-8 md:py-24">
          <div className="flex items-end justify-between gap-8">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-yellow-deep">— 端到端</p>
              <h2 className="mt-3 text-[clamp(2rem,4vw,3rem)] font-extrabold leading-[1.05] tracking-tight">
                从空目录到 PDF，
                <br className="hidden md:block" />
                <Highlight>七个 skill</Highlight> 走完。
              </h2>
            </div>
            <p className="hidden max-w-xs text-[14px] leading-[1.65] text-ink-soft md:block">
              全程在 terminal 内对话完成，文件落到你项目里，git 即可追踪。
            </p>
          </div>

          <ol className="mt-12 space-y-3">
            {WORKFLOW_STEPS.map((step, idx) => (
              <li
                key={step.skill}
                className="group grid grid-cols-[auto_1fr] items-baseline gap-x-5 gap-y-1 rounded-xl border-2 border-rule bg-cream px-4 py-4 transition-all hover:border-corgi hover:bg-fluff hover:translate-x-1 sm:grid-cols-[auto_minmax(0,11rem)_1fr] sm:gap-x-6 sm:px-5"
              >
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-yellow text-sm font-extrabold text-ink tabular-nums shadow-[0_2px_0_0_var(--color-yellow-deep)] sm:h-11 sm:w-11 sm:text-base">
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <span className="font-mono text-[13.5px] font-semibold text-yellow-deep sm:text-[14px]">
                  {step.skill}
                </span>
                <span className="col-span-2 max-w-2xl text-[15px] leading-[1.65] text-ink-soft sm:col-span-1">
                  <span className="font-bold text-ink">{step.title}</span>
                  <span className="mx-2 text-rule-strong">·</span>
                  {step.desc}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ============ Claude Code 用户专区（阳光黄 spotlight） ============ */}
      <section id="install" className="relative overflow-hidden border-b border-rule">
        {/* 阳光底纹 */}
        <div
          className="absolute inset-0"
          aria-hidden
          style={{
            background:
              'radial-gradient(ellipse 90% 60% at 50% 0%, oklch(0.86 0.13 85 / 0.65) 0%, oklch(0.96 0.05 88 / 0.5) 35%, transparent 75%)',
          }}
        />
        <div className="absolute inset-0 bg-grid opacity-40" aria-hidden />

        <div className="relative mx-auto max-w-6xl px-5 py-20 md:px-8 md:py-24">
          <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-5">
              <span className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-cream px-3.5 py-1 text-[12px] font-bold text-ink">
                <span className="inline-block h-2 w-2 rounded-full bg-yellow-deep" />
                已经可用 · 5 秒装完
              </span>
              <h2 className="mt-5 text-[clamp(1.9rem,3.5vw,2.75rem)] font-extrabold leading-[1.1] tracking-tight">
                已经在用 AI agent？
                <br />
                <Highlight>现在就能开始</Highlight>。
              </h2>
              <p className="mt-5 max-w-md text-[15px] leading-[1.7] text-ink-soft">
                不需要等桌面 app。装了 Claude Code、Codex、Cursor、OpenCode 等任何一种支持 skill 协议的
                agent，下面任选一种安装方式，5 秒装完。
              </p>

              <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-[13px]">
                <a
                  href="https://github.com/meathill/muicv/blob/master/docs/walkthrough.md"
                  className="inline-flex items-center gap-1.5 font-semibold text-ink underline decoration-yellow decoration-2 underline-offset-4 hover:decoration-yellow-deep"
                >
                  7 步演示
                  <ArrowUpRight />
                </a>
                <a
                  href="https://github.com/meathill/muicv#使用"
                  className="inline-flex items-center gap-1.5 font-semibold text-ink underline decoration-yellow decoration-2 underline-offset-4 hover:decoration-yellow-deep"
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

      {/* ============ FAQ + Waitlist ============ */}
      <section className="border-b border-rule">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 md:px-8 md:py-24 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-7">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-yellow-deep">— 常见问题</p>
            <h2 className="mt-3 text-[clamp(2rem,4vw,3rem)] font-extrabold leading-[1.05] tracking-tight">
              想问的<Highlight>大概率</Highlight>在这里。
            </h2>

            <div className="mt-10 space-y-3">
              {FAQ_ITEMS.map((item, idx) => (
                <details
                  key={item.q}
                  className="group rounded-xl border-2 border-rule bg-cream transition-colors hover:border-corgi"
                  open={idx === 0}
                >
                  <summary className="flex cursor-pointer list-none items-start gap-4 px-5 py-4">
                    <span className="mt-0.5 inline-flex h-7 shrink-0 items-center rounded-md bg-fluff px-2 font-mono text-[11px] font-bold tabular-nums text-yellow-deep">
                      Q{String(idx + 1).padStart(2, '0')}
                    </span>
                    <span className="flex-1 text-[16px] font-bold leading-snug text-ink">{item.q}</span>
                    <span
                      className="mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-fluff text-yellow-deep transition-transform duration-200 group-open:rotate-45"
                      aria-hidden
                    >
                      +
                    </span>
                  </summary>
                  <div className="border-t border-rule px-5 pb-5 pt-4 pl-[4.5rem] text-[15px] leading-[1.7] text-ink-soft">
                    {item.a}
                  </div>
                </details>
              ))}
            </div>
          </div>

          {/* 右栏 waitlist + 技术栈 */}
          <aside className="space-y-10 lg:col-span-5 lg:sticky lg:top-24 lg:self-start">
            {/* Waitlist */}
            <div className="relative overflow-hidden rounded-2xl border-2 border-ink bg-corgi/30 p-7 shadow-[0_5px_0_0_oklch(0.62_0.14_70)]">
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-yellow/30 blur-2xl" aria-hidden />
              {/* 角落小柯基 */}
              <div className="absolute right-3 top-3">
                <CorgiMascot className="h-10 w-10" />
              </div>
              <div className="relative">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-yellow-deep">— Waitlist</p>
                <h3 className="mt-3 max-w-[220px] text-2xl font-extrabold leading-tight text-ink">
                  桌面 app <span className="text-yellow-deep">开发中</span>。
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
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-yellow-deep">— 技术栈</p>
              <ul className="mt-4 space-y-3 text-[14px] leading-[1.6]">
                {[
                  ['Skills', 'Markdown + YAML frontmatter（Claude skill 规范）'],
                  ['API', 'Cloudflare Worker + Hono'],
                  ['PDF / 抓取', 'Cloudflare Container · Chromium · Puppeteer'],
                  ['分发', 'Plugin Marketplace + npx skills + GitHub'],
                ].map(([k, v]) => (
                  <li key={k} className="flex items-baseline gap-3">
                    <span className="w-20 shrink-0 font-mono text-[11px] font-semibold uppercase tracking-wider text-yellow-deep">
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
              <CorgiMascot className="h-9 w-9" />
              <span className="text-[18px] font-bold tracking-tight">Mui简历</span>
            </a>
            <p className="mt-4 max-w-xs text-[13px] leading-[1.65] text-ink-soft">
              在你熟悉的 AI agent 里管理简历。Skills + 本地 Markdown + Cloudflare API。
            </p>
            <p className="mt-3 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-yellow-deep">
              <PawIcon className="h-3.5 w-3.5" />
              由柯基 Mui 监修
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 text-[13px] sm:grid-cols-3 lg:col-span-7">
            <FooterCol
              label="产品"
              links={[
                ['下载桌面 app', '/download'],
                ['Skill 安装', '#install'],
                ['Dashboard', '/dashboard'],
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

/** 安装方式卡片：奶油白底 + 双层 yellow 框 + 终端嵌入 */
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
    <div className="group relative rounded-2xl border-2 border-ink bg-cream p-5 shadow-[0_4px_0_0_oklch(0.24_0.04_65)] transition-transform hover:-translate-y-1">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[17px] font-extrabold text-ink">{title}</h3>
            {preferred && (
              <span className="inline-flex items-center gap-1 rounded-full bg-yellow px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-ink">
                <Sparkle />
                推荐
              </span>
            )}
          </div>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-mute">{meta}</p>
        </div>
      </div>
      <pre className="mt-4 overflow-x-auto rounded-lg border-2 border-ink/85 bg-[#1a1815] p-4 font-mono text-[12.5px] leading-relaxed text-cream/90">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function FooterCol({ label, links }: { label: string; links: [string, string][] }) {
  return (
    <div>
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-yellow-deep">{label}</p>
      <ul className="mt-4 space-y-2">
        {links.map(([name, href]) => (
          <li key={name}>
            <a
              href={href}
              className="text-ink-soft underline decoration-rule decoration-2 underline-offset-4 transition hover:text-ink hover:decoration-yellow"
            >
              {name}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
