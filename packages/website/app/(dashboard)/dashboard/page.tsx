import { microToDisplay } from '@muicv/shared';
import type { Metadata } from 'next';
import { headers } from 'next/headers';

import { getAuth } from '@/lib/auth';
import { ensureBalance } from '@/lib/wallet';

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

  // 进 dashboard 也是 lazy init 入口（用户可能从未访问 /api/me），
  // 第一次进来给写 signup_bonus + 余额行
  const wallet = await ensureBalance(user.id);

  return (
    <div className="space-y-10">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-yellow-deep">— 个人中心</p>
        <h1 className="mt-3 text-[clamp(2rem,4vw,2.75rem)] font-extrabold leading-[1.1] tracking-tight text-ink">
          欢迎回来{user.name ? `，${user.name}` : ''}。
        </h1>
        <p className="mt-2 max-w-xl text-[14px] text-ink-soft">
          所有 muicv 服务（云端大语言模型、PDF 导出、岗位抓取）都按 Token 计费，余额永不过期。 注册一次性送 10K
          tokens；用完后订阅（月付 / 年付）或买补充包都能续。
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        <Card label="邮箱" value={user.email} />
        <Card
          label="Token 余额"
          value={microToDisplay(wallet.balance).toLocaleString()}
          hint={wallet.justInitialized ? '注册赠送已到账' : '永不过期'}
        />
      </section>

      <section className="rounded-2xl border-2 border-ink bg-corgi/30 p-6 shadow-[0_4px_0_0_oklch(0.62_0.14_70)]">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center sm:gap-6">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-yellow-deep">— 桌面应用 · 推荐</p>
            <h2 className="mt-2 text-[18px] font-extrabold text-ink">下载桌面应用直接开始</h2>
            <p className="mt-2 text-[14px] leading-[1.7] text-ink-soft">
              macOS / Windows / Linux 全平台可用。简历、岗位、面试、求职信全部在一个应用里完成；
              云端能力（大语言模型、PDF 导出、岗位抓取）按 Token 从余额扣。
            </p>
          </div>
          <a
            href="/download"
            className="press inline-flex shrink-0 items-center gap-2 rounded-xl bg-yellow px-5 py-3 text-[14px] font-bold text-ink"
          >
            下载桌面应用
          </a>
        </div>
      </section>

      <section className="rounded-2xl border-2 border-ink bg-cream p-6 shadow-[0_4px_0_0_oklch(0.24_0.04_65)]">
        <h2 className="text-[18px] font-extrabold text-ink">已经在用 AI 助手？走技能路径</h2>
        <p className="mt-2 text-[14px] leading-[1.7] text-ink-soft">
          Claude Code / Codex / Cursor / OpenCode 等支持技能协议的 AI 助手都能直接接入：
        </p>
        <ol className="mt-4 space-y-2 text-[14px] leading-[1.7] text-ink-soft">
          <li>
            🐾 在自己电脑的命令行里安装技能：
            <code className="ml-1 rounded bg-fluff px-1.5 py-0.5 font-mono text-[12.5px] text-yellow-deep ring-1 ring-corgi/40">
              npx skills add muicv -g
            </code>
          </li>
          <li>🐾 跟 Claude / Codex 说"帮我准备简历"，技能会接管引导</li>
          <li>🐾 云端调用都从这个余额里扣，跟桌面应用共用一个钱包</li>
        </ol>
      </section>
    </div>
  );
}

function Card({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border-2 border-ink bg-cream p-5 shadow-[0_4px_0_0_oklch(0.24_0.04_65)]">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-yellow-deep">{label}</p>
      <p className="mt-2 break-words text-[16px] font-bold text-ink">{value}</p>
      {hint && <p className="mt-2 text-[11px] text-mute">{hint}</p>}
    </div>
  );
}
