import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { getCurrentSession } from '@/lib/session';

import { ApproveForm } from './approve-form';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '授权登录',
  description: '授权 Mui简历桌面端连接到你的账号。',
  robots: { index: false, follow: false },
};

/**
 * Desktop OAuth-style 授权页。
 *
 * 流程：
 *   1. Electron app 生成随机 state，打开 https://muicv.com/connect?state=xxx&redirect=muicv://callback&app=Mui简历
 *   2. 这一页：未登录 → 跳 /sign-in?next=<原 url>；已登录 → 展示授权 UI
 *   3. 用户点"授权" → POST /api/connect/approve → 返回 { redirectUrl: "muicv://callback?state=xxx&key=mui_xxx" }
 *   4. 浏览器 navigate 到 muicv:// → OS 唤起 electron → 主进程拿到 key 自动登录
 *
 * 安全考虑：
 *   - state 由 client（electron）生成 + 校验，防 CSRF
 *   - redirect 必须以 muicv:// 开头，防 open redirect
 *   - 即使授权页被钓鱼也只能拿到一个 mui_ key（用户能从 dashboard 撤销）
 */
export default async function ConnectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const state = pickStr(params.state);
  const redirectRaw = pickStr(params.redirect) ?? 'muicv://callback';
  const appName = pickStr(params.app) ?? 'Mui简历桌面端';

  // 防 open redirect：只允许 muicv:// scheme
  const redirect_uri = redirectRaw.startsWith('muicv://') ? redirectRaw : 'muicv://callback';

  if (!state || state.length < 8 || state.length > 128) {
    return <ErrorCard title="授权请求不完整" body="缺少 state 参数。请回到桌面 app 重新发起登录。" />;
  }

  const session = await getCurrentSession();
  if (!session?.user) {
    // 用 next 把整个 connect URL 带回，登录后回来继续
    const here = `/connect?state=${encodeURIComponent(state)}&redirect=${encodeURIComponent(redirect_uri)}&app=${encodeURIComponent(appName)}`;
    redirect(`/sign-in?next=${encodeURIComponent(here)}`);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-12">
      <div className="rounded-3xl border-2 border-ink bg-cream p-8 shadow-[0_5px_0_0_oklch(0.24_0.04_65)]">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-yellow-deep">授权登录请求</p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-ink">{appName} 想连接你的账号</h1>
        <p className="mt-3 text-[14px] leading-[1.65] text-ink-soft">
          授权后，桌面端会拿到一个 API key 代表你的身份调用 muicv API。你可以随时在 dashboard 撤销这个 key。
        </p>

        <div className="mt-5 rounded-xl border border-rule bg-paper p-4 text-[13px] leading-[1.65] text-ink-soft">
          <Row label="账号" value={session.user.email ?? '(无邮箱)'} />
          <Row label="授权对象" value={appName} />
          <Row label="回跳地址" value={redirect_uri} mono />
        </div>

        <ApproveForm state={state} redirect={redirect_uri} appName={appName} />

        <p className="mt-5 text-center text-[11.5px] text-mute">看着不对？关掉这个窗口，桌面 app 不会拿到任何东西。</p>
      </div>
    </main>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-[11px] font-bold uppercase tracking-wider text-mute">{label}</span>
      <span className={`text-right text-ink ${mono ? 'font-mono text-[12px]' : ''}`}>{value}</span>
    </div>
  );
}

function ErrorCard({ title, body }: { title: string; body: string }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <div className="rounded-3xl border-2 border-tongue/60 bg-tongue/5 p-7">
        <h1 className="text-xl font-extrabold text-ink">{title}</h1>
        <p className="mt-2 text-[14px] text-ink-soft">{body}</p>
      </div>
    </main>
  );
}

function pickStr(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}
