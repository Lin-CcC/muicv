import { ArrowUpRight, Highlight, PawIcon, Sparkle } from '../_icons';
import { HeroShowcase } from './hero-showcase';

export function Hero({ isLoggedIn }: { isLoggedIn: boolean }) {
  const accountHref = isLoggedIn ? '/dashboard' : '/sign-up';
  const accountLabel = isLoggedIn ? '进入个人中心' : '创建账号';

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
          <div className="inline-flex items-center gap-2 rounded-full border-2 border-corgi/60 bg-fluff px-3 py-1 text-[12px] font-semibold text-yellow-deep">
            <Sparkle />
            <span>桌面 app 已上线，先从一份素材开始</span>
          </div>

          <h1 className="mt-7 text-[clamp(2.5rem,7vw,5.25rem)] font-extrabold leading-[1.05] tracking-tight text-ink">
            把简历和经历
            <br />
            <Highlight>交给 Mui 整理</Highlight>。
          </h1>

          <p className="mt-7 max-w-xl text-[18px] leading-[1.7] text-ink-soft">
            下载桌面 app，导入现有简历或粘贴一段经历。Mui 会先帮你整理成可复用的职业素材库，
            再针对不同岗位生成、评审和导出简历。
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <a
              href="/download"
              className="press inline-flex items-center gap-2 rounded-md border-2 border-ink bg-yellow px-5 py-3 text-[16px] font-bold text-ink"
            >
              下载桌面 app
              <ArrowUpRight />
            </a>
            <a
              href="#workflow"
              className="press-ink inline-flex items-center gap-2 rounded-md border-2 border-ink bg-cream px-5 py-3 text-[16px] font-bold text-ink"
            >
              看 3 步怎么开始
              <ArrowUpRight />
            </a>
            <a
              href={accountHref}
              className="ml-1 inline-flex items-center gap-1.5 text-[14px] font-semibold text-ink-soft underline decoration-rule decoration-2 underline-offset-4 transition hover:text-ink hover:decoration-yellow"
            >
              {accountLabel}
            </a>
          </div>

          <p className="mt-10 max-w-lg border-t-2 border-dotted border-rule-strong pt-5 text-[14px] leading-[1.7] text-mute">
            已经熟悉 Claude Code、Codex 或 Cursor？首页后面保留 skill 安装方式，可以继续走你习惯的工具链。
          </p>
        </div>

        <div className="lg:col-span-5">
          <HeroShowcase />
        </div>
      </div>
    </section>
  );
}
