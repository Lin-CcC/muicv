import { headers } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { CorgiMascot } from '@/components/corgi-mascot';
import { getAuth } from '@/lib/auth';

import { DashboardNav } from './_components/dashboard-nav';
import { SignOutButton } from './sign-out-button';

function DownloadIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M12 3v12m0 0l-5-5m5 5l5-5M5 21h14"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// 整个 dashboard 段是 per-user 的，强制 SSR
export const dynamic = 'force-dynamic';

/**
 * Dashboard 受保护 layout —— Server Component 内验证 session（Workers 环境下
 * 比 middleware 更可靠，参见调研报告 issue #4203）。未登录跳 /sign-in。
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const auth = await getAuth();
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect('/sign-in');
  }

  const userName = session.user.name || session.user.email.split('@')[0];

  return (
    <div className="min-h-screen bg-cream">
      <header className="sticky top-0 z-30 border-b border-rule bg-cream/85 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3 md:px-8">
          <Link href="/" className="flex items-center gap-2.5 text-ink no-underline">
            <CorgiMascot className="h-8 w-8" />
            <span className="text-[17px] font-bold tracking-tight">Mui简历</span>
            <span className="hidden font-mono text-[10px] font-semibold uppercase tracking-wider text-mute sm:inline">
              dashboard
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/download"
              className="press inline-flex items-center gap-1.5 rounded-lg bg-yellow px-3 py-1.5 text-[13px] font-bold text-ink"
            >
              <DownloadIcon />
              <span className="hidden sm:inline">下载桌面 app</span>
              <span className="sm:hidden">桌面 app</span>
            </Link>
            <span className="hidden text-[13px] text-ink-soft sm:inline">
              👋 <span className="font-semibold text-ink">{userName}</span>
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <DashboardNav variant="tabs" />
        <div className="flex gap-10 py-8 md:py-12">
          <DashboardNav variant="sidebar" />
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </div>
  );
}
