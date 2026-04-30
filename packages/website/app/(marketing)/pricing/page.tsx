import { SUBSCRIPTION_PLANS, TOPUP_PACKS } from '@muicv/shared';
import type { Metadata } from 'next';
import { headers } from 'next/headers';

import { getAuth } from '@/lib/auth';

import { ArrowUpRight, Highlight, Sparkle } from '../_icons';
import { Footer } from '../_sections/footer';
import { Header } from '../_sections/header';

export const metadata: Metadata = {
  title: '定价',
  description: '按 token 计费，永不过期。注册即送 10K tokens，月卡每月续，补充包随用随买。',
};

export const dynamic = 'force-dynamic';

type SubTier = {
  key: keyof typeof SUBSCRIPTION_PLANS;
  name: string;
  tagline: string;
  features: string[];
  highlight?: boolean;
  badge?: string;
};

const SUB_TIERS: SubTier[] = [
  {
    key: 'pro',
    name: 'Pro 月卡',
    tagline: '认真求职阶段。',
    features: [
      `每月 ${SUBSCRIPTION_PLANS.pro.monthlyTokens.toLocaleString()} tokens 自动到账`,
      '所有功能（LLM / PDF / JD / 招聘库）按 token 自由分配',
      '取消订阅，已发 token 永不过期',
      '优先邮件支持',
    ],
    highlight: true,
    badge: '最受欢迎',
  },
  {
    key: 'max',
    name: 'Max 月卡',
    tagline: '密集求职专用。',
    features: [
      `每月 ${SUBSCRIPTION_PLANS.max.monthlyTokens.toLocaleString()} tokens 自动到账`,
      '所有 Pro 功能',
      '抢先体验新模块',
      '专属支持渠道',
    ],
  },
];

const PRICING_FAQ: { q: string; a: string }[] = [
  {
    q: 'Token 怎么用？',
    a: 'LLM 调用按上游 prompt + completion token × 1.1（覆盖第三方成本与少量利润）；PDF 渲染每次扣 200 tokens；JD 抓取每次扣 300 tokens。所有调用都会在 dashboard 流水里看到明细。',
  },
  {
    q: '月卡和补充包能同时用吗？',
    a: '可以。月卡是"每月自动续"，补充包是"用完手动加"。两边到账的 tokens 都进同一个余额，不分先后用。',
  },
  {
    q: '可以随时升降档 / 取消吗？',
    a: '可以。在 dashboard 点"管理订阅"会跳到 Stripe Customer Portal，取消、切档、换支付方式都在那里。已发的 tokens 永不过期，取消之后接着用旧余额。',
  },
  {
    q: '不满意能退款吗？',
    a: '订阅 7 天内未消耗主要功能可全额退款，邮件联系。补充包付款立刻入账，原则上不退；如果是误购或重大问题，依然可邮件协商。',
  },
  {
    q: '我有 BYOK，还要付费吗？',
    a: '可以选只用 BYOK：把 muirouter key 绑到 dashboard，所有 LLM 调用走你自己的 muirouter 余额，不消耗 muicv tokens。但 PDF 渲染 / JD 抓取仍按 muicv tokens 扣（这两个是 Cloudflare Browser Rendering 的真实成本）。',
  },
  {
    q: 'Skill 套件本身收费吗？',
    a: '不收费。npx skills add 装到 Claude Code / Codex / Cursor 等任意 AI agent 完全免费——平台计费只针对服务端能力（云端 LLM / PDF / JD）和你已购买的 tokens。',
  },
];

export default async function PricingPage() {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  const isLoggedIn = !!session?.user;

  return (
    <div className="relative">
      <Header isLoggedIn={isLoggedIn} />

      <section className="relative overflow-hidden border-b border-rule">
        <div className="absolute inset-0 bg-sun" aria-hidden />
        <div className="absolute inset-0 bg-grid opacity-50" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-yellow-deep">— 定价</p>
            <h1 className="mt-3 text-[clamp(2.25rem,5vw,3.75rem)] font-extrabold leading-[1.05] tracking-tight text-ink">
              按 <Highlight>token</Highlight> 计费，
              <br />
              永不过期。
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-[16px] leading-[1.7] text-ink-soft">
              注册即送 10,000 tokens；不够用了选月卡或补充包。Skill 始终免费，BYOK 始终可用。
            </p>
            <div className="mx-auto mt-6 inline-flex items-center gap-2 rounded-full border-2 border-corgi/60 bg-fluff px-3.5 py-1 text-[12px] font-semibold text-yellow-deep">
              <Sparkle />
              一个余额，覆盖所有云端服务
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-rule">
        <div className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-20">
          <div className="grid gap-5 md:grid-cols-3">
            <FreeCard isLoggedIn={isLoggedIn} />
            {SUB_TIERS.map((tier) => (
              <SubscriptionCard key={tier.key} tier={tier} isLoggedIn={isLoggedIn} />
            ))}
          </div>

          <div className="mt-12">
            <h2 className="text-[20px] font-extrabold text-ink">补充包（一次性买，永不过期）</h2>
            <p className="mt-2 max-w-2xl text-[14px] text-ink-soft">没准备订月卡，或者偶尔超用一次。任何时候都能买。</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {(['small', 'medium', 'large'] as const).map((key) => {
                const pack = TOPUP_PACKS[key];
                return (
                  <div key={key} className="rounded-2xl border-2 border-rule bg-cream p-5">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-mute">{key}</p>
                    <p className="mt-2 text-[20px] font-extrabold text-ink tabular-nums">
                      {pack.tokens.toLocaleString()} tokens
                    </p>
                    <p className="mt-1 font-mono text-[12px] tabular-nums text-yellow-deep">{pack.priceCnyDisplay}</p>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 font-mono text-[11px] text-mute">在 dashboard 点"补充包"完成支付。</p>
          </div>
        </div>
      </section>

      <section className="border-b border-rule">
        <div className="mx-auto max-w-3xl px-5 py-16 md:px-8 md:py-20">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-yellow-deep">— 关于定价</p>
          <h2 className="mt-3 text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight">
            一些会被问到的细节。
          </h2>
          <div className="mt-10 space-y-3">
            {PRICING_FAQ.map((item, idx) => (
              <details
                key={item.q}
                className="group rounded-xl border-2 border-rule bg-cream transition-colors hover:border-corgi"
                open={idx === 0}
              >
                <summary className="flex cursor-pointer list-none items-start gap-4 px-5 py-4">
                  <span className="mt-0.5 inline-flex h-7 shrink-0 items-center rounded-md bg-fluff px-2 font-mono text-[11px] font-bold tabular-nums text-yellow-deep">
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
                <div className="border-t border-rule px-5 pb-5 pt-4 pl-[4.5rem] text-[15px] leading-[1.7] text-ink-soft">
                  {item.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

function FreeCard({ isLoggedIn }: { isLoggedIn: boolean }) {
  const ctaHref = isLoggedIn ? '/dashboard' : '/sign-up';
  const ctaLabel = isLoggedIn ? '进入 Dashboard' : '免费注册领 10K tokens';
  return (
    <article className="relative flex flex-col rounded-2xl border-2 border-rule bg-cream p-6 transition-transform hover:-translate-y-1">
      <h3 className="text-[20px] font-extrabold text-ink">免费起步</h3>
      <p className="mt-1 text-[13px] leading-[1.6] text-ink-soft">想试一下，先从这开始。</p>
      <div className="mt-5">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-extrabold text-ink tabular-nums">10,000</span>
          <span className="text-[14px] font-bold text-ink-soft">tokens</span>
        </div>
        <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-mute">注册即送 · 一次性</p>
      </div>
      <ul className="mt-6 flex-1 space-y-2.5 text-[14px] leading-[1.6]">
        <li className="flex items-start gap-2 text-ink-soft">
          <CheckBullet /> 所有云端服务（LLM / PDF / JD）都能用
        </li>
        <li className="flex items-start gap-2 text-ink-soft">
          <CheckBullet /> 本地素材管理无限
        </li>
        <li className="flex items-start gap-2 text-ink-soft">
          <CheckBullet /> 接入 BYOK 即可"无限"用 LLM
        </li>
        <li className="flex items-start gap-2 text-ink-soft">
          <CheckBullet /> 社区支持
        </li>
      </ul>
      <a
        href={ctaHref}
        className="press-ink mt-6 inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-ink bg-cream px-4 py-2.5 text-[14px] font-bold text-ink"
      >
        {ctaLabel}
        <ArrowUpRight />
      </a>
    </article>
  );
}

function SubscriptionCard({ tier, isLoggedIn }: { tier: SubTier; isLoggedIn: boolean }) {
  const plan = SUBSCRIPTION_PLANS[tier.key];
  const ctaHref = isLoggedIn ? '/dashboard' : '/sign-up';
  const ctaLabel = isLoggedIn ? '在 Dashboard 升级' : '注册后开通';

  return (
    <article
      className={
        tier.highlight
          ? 'relative flex flex-col rounded-2xl border-2 border-ink bg-cream p-6 shadow-[0_5px_0_0_var(--color-yellow-deep)]'
          : 'relative flex flex-col rounded-2xl border-2 border-rule bg-cream p-6 transition-transform hover:-translate-y-1'
      }
    >
      {tier.badge && (
        <span className="absolute -top-3 right-5 inline-flex items-center gap-1 rounded-full bg-yellow px-3 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-ink shadow-[0_2px_0_0_var(--color-yellow-deep)]">
          <Sparkle />
          {tier.badge}
        </span>
      )}
      <h3 className="text-[20px] font-extrabold text-ink">{tier.name}</h3>
      <p className="mt-1 text-[13px] leading-[1.6] text-ink-soft">{tier.tagline}</p>
      <div className="mt-5">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-extrabold text-ink tabular-nums">{plan.priceCnyDisplay}</span>
        </div>
        <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-mute">
          每月 {plan.monthlyTokens.toLocaleString()} tokens
        </p>
      </div>
      <ul className="mt-6 flex-1 space-y-2.5 text-[14px] leading-[1.6]">
        {tier.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-ink-soft">
            <CheckBullet />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <a
        href={ctaHref}
        className={
          tier.highlight
            ? 'press mt-6 inline-flex items-center justify-center gap-1.5 rounded-xl bg-yellow px-4 py-2.5 text-[14px] font-bold text-ink'
            : 'press-ink mt-6 inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-ink bg-cream px-4 py-2.5 text-[14px] font-bold text-ink'
        }
      >
        {ctaLabel}
        <ArrowUpRight />
      </a>
    </article>
  );
}

function CheckBullet() {
  return (
    <span className="mt-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-fluff text-yellow-deep">
      ✓
    </span>
  );
}
