'use client';

import { CorgiMascot } from '@/components/corgi-mascot';
import { useSession } from '@/lib/auth-client';

import { ThemeToggle } from '../../_theme/theme-toggle';
import { ArrowUpRight } from '../_icons';

const NAV_LINKS: { label: string; href: string }[] = [
  { label: '文章', href: '/posts/jobs' },
  { label: 'Skill', href: '/skills' },
  { label: '价格', href: '/pricing' },
  { label: '下载', href: '/download' },
];

/**
 * 站点公共顶部导航。
 *
 * 走客户端 useSession 读登录态，让营销页 HTML 全部走 ISR 缓存（不再 force-dynamic）。
 * 初始 SSR / 水合前先按未登录态渲染，已登录用户会有一次短切换——可接受。
 * 这条权衡是把 mobile LCP 从 force-dynamic 的 TTFB 中拉回来的核心。
 */
export function Header() {
  const { data: session, isPending } = useSession();
  const isLoggedIn = !isPending && !!session?.user;

  return (
    <header className="sticky top-0 z-30 border-b border-rule bg-cream/85 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 md:gap-4 md:px-8">
        <a href="/" className="flex min-w-0 items-center gap-2 text-ink no-underline md:gap-2.5">
          <CorgiMascot className="h-8 w-8" priority />
          <span className="shrink-0 whitespace-nowrap text-[16px] font-bold md:text-[18px]">Mui简历</span>
          <span className="hidden font-mono text-[12px] font-semibold uppercase tracking-wider text-mute sm:inline">
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
          <span className="ml-2 hidden md:inline-flex">
            <ThemeToggle />
          </span>
          {isLoggedIn ? (
            <a
              href="/dashboard"
              className="press ml-1 inline-flex items-center gap-1.5 rounded-md border-2 border-ink bg-yellow px-3 py-1.5 font-semibold whitespace-nowrap text-ink md:px-3.5"
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
                className="press ml-1 inline-flex items-center gap-1.5 rounded-md border-2 border-ink bg-yellow px-3 py-1.5 font-semibold whitespace-nowrap text-ink md:px-3.5"
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
