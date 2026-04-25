import type { Metadata } from 'next';
import { headers } from 'next/headers';

import { getAuth } from '@/lib/auth';

import { ApiKeysSection } from './api-keys-section';
import { MuirouterSection } from './muirouter-section';
import { PlansSection } from './plans-section';

export const metadata: Metadata = {
  title: 'Dashboard',
};

export default async function DashboardPage() {
  const auth = await getAuth();
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  // layout 已守过门，这里再读是为了拿 user 信息渲染
  const user = session?.user;
  if (!user) return null;

  return (
    <div className="space-y-10">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-yellow-deep">— 个人中心</p>
        <h1 className="mt-3 text-[clamp(2rem,4vw,2.75rem)] font-extrabold leading-[1.1] tracking-tight text-ink">
          欢迎回来{user.name ? `，${user.name}` : ''}。
        </h1>
        <p className="mt-2 max-w-xl text-[14px] text-ink-soft">
          M2 阶段：账号系统先到岗，余额 / API key / 订阅档位等会陆续上线。有什么希望先做的， GitHub Issue 见。
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card label="邮箱" value={user.email} />
        <Card label="账号 ID" value={user.id} mono />
        <Card label="API Keys" value="见下方管理 ↓" hint="桌面 app 唯一登录凭证" />
        <Card label="muirouter (BYOK)" value="见下方绑定 ↓" hint="LLM 走你自己余额" />
        <Card label="订阅档位" value="Free" hint="见下方升级（M4 起开放）" />
        <Card label="本月用量" value="—" hint="M4 起统计" muted />
      </section>

      <ApiKeysSection />

      <MuirouterSection />

      <PlansSection />

      <section className="rounded-2xl border-2 border-ink bg-cream p-6 shadow-[0_4px_0_0_oklch(0.24_0.04_65)]">
        <h2 className="text-[18px] font-extrabold text-ink">下一步</h2>
        <p className="mt-2 text-[14px] leading-[1.7] text-ink-soft">目前账号开通后还没有付费功能可用，但你已经能：</p>
        <ol className="mt-4 space-y-2 text-[14px] leading-[1.7] text-ink-soft">
          <li>
            🐾 在自己 terminal 里安装 skill：
            <code className="ml-1 rounded bg-fluff px-1.5 py-0.5 font-mono text-[12.5px] text-yellow-deep ring-1 ring-corgi/40">
              npx skills add meathill/muicv -g
            </code>
          </li>
          <li>🐾 跟 Claude / Codex 说"帮我准备简历"，skill 会接管引导</li>
          <li>🐾 等 muirouter 余额开通后，就能在桌面 app（开发中）里直接消费</li>
        </ol>
      </section>
    </div>
  );
}

function Card({
  label,
  value,
  hint,
  mono,
  muted,
}: {
  label: string;
  value: string;
  hint?: string;
  mono?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border-2 p-5 ${
        muted ? 'border-rule bg-paper' : 'border-ink bg-cream shadow-[0_4px_0_0_oklch(0.24_0.04_65)]'
      }`}
    >
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-yellow-deep">{label}</p>
      <p
        className={`mt-2 break-words text-[16px] font-bold text-ink ${mono ? 'font-mono text-[13px]' : ''} ${
          muted ? 'text-mute' : ''
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-2 text-[11px] text-mute">{hint}</p>}
    </div>
  );
}
