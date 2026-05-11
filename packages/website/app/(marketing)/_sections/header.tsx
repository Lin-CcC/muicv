import { CorgiMascot } from '@/components/corgi-mascot';

import { ArrowUpRight } from '../_icons';

const NAV_LINKS: { label: string; href: string }[] = [
  { label: '怎么开始', href: '/#workflow' },
  { label: '能做什么', href: '/#features' },
  { label: '价格', href: '/pricing' },
  { label: '下载', href: '/download' },
];

export function Header({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
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
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="hidden rounded px-2.5 py-1.5 transition hover:bg-fluff hover:text-ink sm:inline-block"
            >
              {link.label}
            </a>
          ))}
          {isLoggedIn ? (
            <a
              href="/dashboard"
              className="press ml-1 inline-flex items-center gap-1.5 rounded-lg bg-yellow px-3.5 py-1.5 font-semibold text-ink"
            >
              进入控制台
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
                创建账号
                <ArrowUpRight />
              </a>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
