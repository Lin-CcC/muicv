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
