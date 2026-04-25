import { Button } from '@muicv/ui';

import { WaitlistForm } from './waitlist-form';

export default function WebsiteHomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-16 p-8 md:p-12">
      {/* Hero */}
      <section className="flex flex-col gap-6 pt-12 md:pt-20">
        <div className="space-y-4">
          <p className="inline-flex items-center gap-2 rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-600">
            Skill + 本地 Markdown · 兼容 Claude Code / Codex / Cursor ...
          </p>
          <h1 className="text-5xl font-bold tracking-tight md:text-6xl">Mui简历</h1>
          <p className="max-w-2xl text-lg text-zinc-600 md:text-xl">
            在你熟悉的 AI agent 里管理简历。素材存在你自己的项目目录， 由你用 git 管。不用学新 UI、不用注册账号。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <a href="https://github.com/meathill/muicv#安装" className="no-underline">
            <Button type="button">开始使用</Button>
          </a>
          <a href="https://github.com/meathill/muicv" className="no-underline">
            <Button type="button" variant="secondary">
              GitHub
            </Button>
          </a>
        </div>

        <pre className="mt-2 max-w-xl overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm">
          <code>{`# 装到所有 AI agent
npx skills add meathill/muicv -g

# 或 Claude Code plugin
/plugin marketplace add meathill/muicv
/plugin install muicv@meathill`}</code>
        </pre>

        {/* Waitlist */}
        <div className="mt-4 space-y-3 rounded-xl border border-zinc-200 bg-white p-5">
          <div>
            <h3 className="text-base font-semibold">桌面 app 开发中</h3>
            <p className="mt-1 text-sm text-zinc-600">
              准备一个独立的 desktop app，让不用 AI agent 的求职者也能用，支持 BYOK 或通过 muirouter
              购买额度。留个邮箱，发布时第一时间通知你。
            </p>
          </div>
          <WaitlistForm source="landing-hero" />
        </div>
      </section>

      {/* 为什么 */}
      <section className="space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">为什么不做 Chatbot？</h2>
        <p className="max-w-3xl text-zinc-600">
          AI agent 本身就会对话、有记忆、能操作文件，我们再做一遍 chat UI 和记忆库， 是重复建设。Mui简历只做 AI agent
          做不好的事：**结构化的简历工作流** 和 **服务端能力**（PDF 渲染、JD 抓取）。
        </p>
        <div className="grid w-full gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-zinc-200 p-5">
            <div className="font-semibold">数据主权</div>
            <p className="mt-2 text-sm text-zinc-600">
              所有简历素材是 Markdown 文件，存在你自己的项目里。 要不要入 git、怎么备份、如何同步，完全由你决定。
            </p>
          </div>
          <div className="rounded-lg border border-zinc-200 p-5">
            <div className="font-semibold">agent 无关</div>
            <p className="mt-2 text-sm text-zinc-600">
              一套 skill 在 Claude Code、Codex、Cursor、OpenCode 等 40+ agent 通用。 换工具不换数据。
            </p>
          </div>
          <div className="rounded-lg border border-zinc-200 p-5">
            <div className="font-semibold">不编造</div>
            <p className="mt-2 text-sm text-zinc-600">
              所有生成严格限定在你明确写下的事实里。缺素材就追问或留空， 绝不替你"发挥"。
            </p>
          </div>
        </div>
      </section>

      {/* 工作流 */}
      <section className="space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">端到端工作流</h2>
        <p className="max-w-3xl text-zinc-600">从零到投递一份针对性简历，全程在你的 terminal 里对话完成：</p>
        <ol className="space-y-4">
          {[
            {
              step: 'muicv-core',
              title: '收集素材',
              desc: '首次说"帮我准备简历"，skill 自动建 .claude/muicv/，引导收集 profile / experience / projects 等。',
            },
            {
              step: 'muicv-jobs:fetch',
              title: '抓取 JD',
              desc: '粘一个招聘 URL，skill 调 API 清洗成 markdown 写到 targets/。',
            },
            {
              step: 'muicv-jobs:match',
              title: '匹配度分析',
              desc: '对比 JD 和本地素材，告诉你覆盖了多少关键词、缺什么，避免盲投。',
            },
            {
              step: 'muicv-generate',
              title: '生成简历',
              desc: '针对具体 JD 挑选、排序、改写素材到 versions/<slug>-<date>.md。',
            },
            {
              step: 'muicv-critique',
              title: '评审迭代',
              desc: 'STAR / 量化 / 关键词对齐 / 长度 等 7 维度评分，P0/P1/P2 提建议。',
            },
            {
              step: 'muicv-render',
              title: '导出 PDF',
              desc: '调服务端 API（Cloudflare Container + Puppeteer）渲染成 A4 PDF。',
            },
            {
              step: 'muicv-jobs:apply',
              title: '准备投递',
              desc: '生成 cover letter + 投递 checklist 到 applications/。投递由你手动完成。',
            },
          ].map((row) => (
            <li key={row.step} className="flex gap-4">
              <code className="mt-1 shrink-0 rounded bg-zinc-900 px-2 py-0.5 font-mono text-xs text-zinc-100">
                {row.step}
              </code>
              <div>
                <div className="font-semibold">{row.title}</div>
                <p className="text-sm text-zinc-600">{row.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Claude Code 用户专区：你现在就能用 */}
      <section className="space-y-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-6 md:p-8">
        <div className="space-y-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            ✓ 已经可用
          </span>
          <h2 className="text-2xl font-bold tracking-tight">已经在用 AI agent？现在就能开始</h2>
          <p className="max-w-3xl text-zinc-600">
            你不需要等桌面 app。如果你已经装了 Claude Code、Codex、Cursor、OpenCode
            等任何一种支持 skill 协议的 agent，下面任选一种安装方式，5 秒装完，立刻可用。
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 rounded-lg border border-zinc-200 bg-white p-4">
            <div className="text-sm font-semibold">Claude Code Plugin Marketplace</div>
            <p className="text-sm text-zinc-600">官方机制，`/plugin` 命令管理。</p>
            <pre className="overflow-x-auto rounded bg-zinc-900 p-3 text-xs text-zinc-100">
              <code>{`/plugin marketplace add meathill/muicv
/plugin install muicv@meathill`}</code>
            </pre>
          </div>

          <div className="space-y-2 rounded-lg border border-zinc-200 bg-white p-4">
            <div className="text-sm font-semibold">npx skills（多 agent 通用）</div>
            <p className="text-sm text-zinc-600">兼容 40+ AI agent，一份 skill 通用。</p>
            <pre className="overflow-x-auto rounded bg-zinc-900 p-3 text-xs text-zinc-100">
              <code>{`npx skills add meathill/muicv -g`}</code>
            </pre>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 text-sm">
          <a
            href="https://github.com/meathill/muicv/blob/master/docs/walkthrough.md"
            className="text-zinc-900 underline hover:text-zinc-600"
          >
            看一遍 7 步演示（walkthrough）→
          </a>
          <a
            href="https://github.com/meathill/muicv#使用"
            className="text-zinc-900 underline hover:text-zinc-600"
          >
            完整文档 →
          </a>
        </div>
      </section>

      {/* FAQ */}
      <section className="space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">常见问题</h2>
        <dl className="max-w-3xl space-y-6">
          <div>
            <dt className="font-semibold">我的简历数据存在哪？谁能看到？</dt>
            <dd className="mt-1 text-sm text-zinc-600">
              全部存在你当前项目目录下的 <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">.claude/muicv/</code>{' '}
              文件夹里，纯 Markdown 文件。要不要入 git、要不要备份到云盘、要不要分享给别人——完全由你决定。
              我们的服务器只在你主动调 API（PDF 渲染、JD 抓取）时短暂经手数据，不留存。
            </dd>
          </div>

          <div>
            <dt className="font-semibold">现在要付费吗？</dt>
            <dd className="mt-1 text-sm text-zinc-600">
              不要。当前 MVP 阶段，PDF 渲染和 JD 抓取的 API 免费，按 IP 限速。
              将来会上 BYOK（用你自己的 OpenAI / Anthropic API key）和订阅档位，但 skill 本身永远免费。
            </dd>
          </div>

          <div>
            <dt className="font-semibold">什么是 BYOK？muirouter 是什么？</dt>
            <dd className="mt-1 text-sm text-zinc-600">
              BYOK = Bring Your Own Key，用你自己的 LLM API key（OpenAI / Anthropic / Gemini 等）。
              <a
                href="https://muirouter.com"
                className="underline hover:text-zinc-900"
              >
                muirouter
              </a>{' '}
              是一个统一接入多家 LLM 的代理（类似 OpenRouter），不想自己注册那么多家的话，
              通过 muirouter 充值就能在 muicv 桌面 app 里用。
            </dd>
          </div>

          <div>
            <dt className="font-semibold">桌面 app 什么时候发布？</dt>
            <dd className="mt-1 text-sm text-zinc-600">
              基于 OpenAI Agent SDK 的 electron 桌面端正在规划，给不用 AI agent 的求职者用。
              没有具体时间表，<strong>留邮箱进 waitlist</strong>，发布会第一时间通知你。
              在那之前，开发者可以直接用 skill 套件（上面有安装命令）。
            </dd>
          </div>

          <div>
            <dt className="font-semibold">支持英文 / 双语简历吗？</dt>
            <dd className="mt-1 text-sm text-zinc-600">
              Skill 不强制语言——你的素材是中文，简历就是中文；JD 是英文，simulate 出来的简历会按英文风格写。
              双语版（中英对照）作为后续模板规划中。
            </dd>
          </div>

          <div>
            <dt className="font-semibold">能投递到 LinkedIn / Boss 直聘吗？</dt>
            <dd className="mt-1 text-sm text-zinc-600">
              不能自动投递。我们只帮你抓 JD、生成针对性简历、写 cover letter，
              真正的"按提交按钮"由你手动完成——这是有意为之，避免账号风险和 ToS 违规。
            </dd>
          </div>
        </dl>
      </section>

      {/* 技术栈（给开发者看） */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold tracking-tight">技术栈</h2>
        <ul className="max-w-3xl space-y-1 text-sm text-zinc-600">
          <li>• Skills：Markdown + YAML frontmatter（Claude Code skill 规范）</li>
          <li>• API：Cloudflare Worker + Hono</li>
          <li>• PDF / JD 抓取：Cloudflare Container（Chromium + Puppeteer）</li>
          <li>• 分发：GitHub + Vercel Labs 的 skills CLI + Claude Code Plugin Marketplace</li>
        </ul>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-zinc-200 pt-6 text-sm text-zinc-500">
        <p>
          开源在{' '}
          <a href="https://github.com/meathill/muicv" className="underline hover:text-zinc-900">
            github.com/meathill/muicv
          </a>
          · 由 meathill 维护
        </p>
      </footer>
    </main>
  );
}
