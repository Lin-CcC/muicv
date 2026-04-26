import { CorgiMascot } from '@/components/corgi-mascot';

import { WaitlistForm } from '../waitlist-form';
import { FAQ_ITEMS } from '../_data';
import { Highlight } from '../_icons';

const TECH_STACK: [string, string][] = [
  ['Skills', 'Markdown + YAML frontmatter（Claude skill 规范）'],
  ['API', 'Cloudflare Worker + Hono'],
  ['PDF / 抓取', 'Cloudflare Container · Chromium · Puppeteer'],
  ['分发', 'Plugin Marketplace + npx skills + GitHub'],
];

export function FaqAndWaitlist() {
  return (
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

        <aside className="space-y-10 lg:col-span-5 lg:sticky lg:top-24 lg:self-start">
          <div className="relative overflow-hidden rounded-2xl border-2 border-ink bg-corgi/30 p-7 shadow-[0_5px_0_0_oklch(0.62_0.14_70)]">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-yellow/30 blur-2xl" aria-hidden />
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

          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-yellow-deep">— 技术栈</p>
            <ul className="mt-4 space-y-3 text-[14px] leading-[1.6]">
              {TECH_STACK.map(([k, v]) => (
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
  );
}
