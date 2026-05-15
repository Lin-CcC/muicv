import { CorgiMascot } from '@/components/corgi-mascot';

import { FAQ_ITEMS } from '../_data';
import { ArrowUpRight, Highlight } from '../_icons';

export function FaqAndWaitlist() {
  return (
    <section className="border-b border-rule">
      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 md:px-8 md:py-24 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-7">
          <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-yellow-deep">— 常见问题</p>
          <h2 className="mt-3 text-[clamp(2rem,4vw,3rem)] font-extrabold leading-[1.05] tracking-tight">
            想问的<Highlight>大概率</Highlight>在这里。
          </h2>

          <div className="mt-10 space-y-3">
            {FAQ_ITEMS.map((item, idx) => (
              <details
                key={item.q}
                className="group rounded-lg border-2 border-rule-strong bg-cream transition-colors hover:border-corgi"
                open={idx === 0}
              >
                <summary className="flex cursor-pointer list-none items-start gap-4 px-5 py-4">
                  <span className="mt-0.5 inline-flex h-7 shrink-0 items-center rounded-md bg-fluff px-2 font-mono text-[12px] font-bold tabular-nums text-yellow-deep">
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
                <div className="border-t border-rule px-5 pb-5 pt-4 pl-[4.5rem] text-[16px] leading-[1.7] text-ink-soft">
                  {item.a}
                </div>
              </details>
            ))}
          </div>
        </div>

        <aside className="space-y-6 lg:col-span-5 lg:sticky lg:top-24 lg:self-start">
          <a
            href="/download"
            className="group relative block overflow-hidden rounded-xl border-2 border-ink bg-corgi/30 p-7 shadow-press-yellow-lg transition-transform hover:-translate-y-1"
          >
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-yellow/30 blur-2xl" aria-hidden />
            <div className="absolute right-3 top-3">
              <CorgiMascot className="h-10 w-10" />
            </div>
            <div className="relative">
              <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-yellow-deep">— 桌面 App</p>
              <h3 className="mt-3 max-w-[260px] text-2xl font-extrabold leading-tight text-ink">
                桌面 app <span className="text-yellow-deep">已上线</span>。
              </h3>
              <p className="mt-3 text-[14px] leading-[1.7] text-ink-soft">
                macOS / Windows / Linux 全平台可用。 不想装 skill 也能用上同一套云端能力。
              </p>
              <span className="mt-5 inline-flex items-center gap-2 rounded-xl bg-yellow px-4 py-2.5 text-[14px] font-bold text-ink shadow-[0_2px_0_0_var(--color-yellow-deep)]">
                下载桌面 app
                <ArrowUpRight />
              </span>
            </div>
          </a>

          <a
            href="/pricing"
            className="group relative flex items-center justify-between gap-4 overflow-hidden rounded-xl border-2 border-ink bg-cream p-5 shadow-press-ink transition-transform hover:-translate-y-1"
          >
            <div>
              <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-yellow-deep">— 定价</p>
              <p className="mt-1.5 text-[16px] font-extrabold text-ink">查看价格方案</p>
              <p className="mt-1 text-[12px] text-ink-soft">Free / Pro / Max + BYOK 四档可选</p>
            </div>
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-yellow text-ink shadow-[0_2px_0_0_var(--color-yellow-deep)]">
              <ArrowUpRight />
            </span>
          </a>
        </aside>
      </div>
    </section>
  );
}
