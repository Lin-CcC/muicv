import { ArrowUpRight, Highlight, PawIcon, Sparkle } from '../_icons';
import { HeroShowcase } from './hero-showcase';

const HERO_STATS: { n: string; l: string }[] = [
  { n: '4', l: '核心能力' },
  { n: '40+', l: '兼容平台' },
  { n: '100%', l: '数据自主' },
];

export function Hero({ isLoggedIn }: { isLoggedIn: boolean }) {
  const primaryHref = isLoggedIn ? '/dashboard' : '/sign-up';
  const primaryLabel = isLoggedIn ? '进入 Dashboard' : '立即开始';

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
        <div className="lg:col-span-7">
          <div className="inline-flex items-center gap-2 rounded-full border-2 border-corgi/60 bg-fluff px-3 py-1 text-[11px] font-semibold text-yellow-deep">
            <Sparkle />
            <span>v0.1 · 由柯基 Mui 监修</span>
          </div>

          <h1 className="mt-7 text-[clamp(2.5rem,7vw,5.25rem)] font-extrabold leading-[1.05] tracking-tight text-ink">
            找到更好的工作，
            <br />
            <Highlight>从这里开始</Highlight>。
          </h1>

          <p className="mt-7 max-w-xl text-[17px] leading-[1.7] text-ink-soft">
            简历、岗位发现、模拟面试、就业辅导——一站式 AI 求职平台。
            <span className="text-ink">下载桌面 app 立即开始</span>
            <span className="text-mute">，或者在你熟悉的 AI agent 里跑。</span>
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <a
              href="/download"
              className="press inline-flex items-center gap-2 rounded-xl bg-yellow px-5 py-3 text-[15px] font-bold text-ink"
            >
              下载桌面 app
              <ArrowUpRight />
            </a>
            <a
              href={primaryHref}
              className="press-ink inline-flex items-center gap-2 rounded-xl border-2 border-ink bg-cream px-5 py-3 text-[15px] font-bold text-ink"
            >
              {primaryLabel}
              <ArrowUpRight />
            </a>
            <a
              href="#install"
              className="ml-1 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-ink-soft underline decoration-rule decoration-2 underline-offset-4 transition hover:text-ink hover:decoration-yellow"
            >
              或装 skill 直接接入
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

        <div className="lg:col-span-5">
          <HeroShowcase />
        </div>
      </div>
    </section>
  );
}
