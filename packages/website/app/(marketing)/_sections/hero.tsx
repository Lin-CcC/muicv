import { CorgiMascot } from '@/components/corgi-mascot';

import { ArrowDown, ArrowUpRight, Highlight, PawIcon, Sparkle } from '../_icons';

const HERO_STATS: { n: string; l: string }[] = [
  { n: '5', l: 'skills' },
  { n: '2', l: 'API endpoints' },
  { n: '40+', l: 'compatible agents' },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-rule">
      <div className="absolute inset-0 bg-sun" aria-hidden />
      <div className="absolute inset-0 bg-grid opacity-50" aria-hidden />

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
            {HERO_STATS.map((s) => (
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
            <div className="absolute -right-3 -top-7 z-10 hidden md:block">
              <CorgiMascot className="h-16 w-16 drop-shadow-[0_3px_0_oklch(0.62_0.14_70)]" />
            </div>
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
  );
}
