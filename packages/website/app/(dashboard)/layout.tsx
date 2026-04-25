import { headers } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { CorgiMascot } from '@/components/corgi-mascot';
import { getAuth } from '@/lib/auth';

import { SignOutButton } from './sign-out-button';

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
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3 md:px-8">
          <Link href="/dashboard" className="flex items-center gap-2.5 text-ink no-underline">
            <CorgiMascot className="h-8 w-8" />
            <span className="text-[17px] font-bold tracking-tight">Mui简历</span>
            <span className="hidden font-mono text-[10px] font-semibold uppercase tracking-wider text-mute sm:inline">
              dashboard
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-[13px] text-ink-soft sm:inline">
              👋 <span className="font-semibold text-ink">{userName}</span>
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-10 md:px-8 md:py-14">{children}</main>
    </div>
  );
}
