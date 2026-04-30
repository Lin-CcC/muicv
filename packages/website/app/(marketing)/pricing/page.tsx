import type { Metadata } from 'next';
import { headers } from 'next/headers';

import { getAuth } from '@/lib/auth';

import { Footer } from '../_sections/footer';
import { Header } from '../_sections/header';
import { ArrowUpRight, Highlight, Sparkle } from '../_icons';

export const metadata: Metadata = {
  title: '定价',
  description: '按你的求职阶段选档；Skill 永远免费。Free / Pro / Max + BYOK 四档可选。',
};

export const dynamic = 'force-dynamic';

type Tier = {
  name: string;
  price: string;
  priceNote: string;
  tagline: string;
  features: string[];
  cta: { label: string; href: string };
  highlight?: boolean;
  badge?: string;
};

const TIERS: Tier[] = [
  {
    name: 'Free',
    price: '￥0',
    priceNote: '永久免费',
    tagline: '想试一下，先从这开始。',
    features: ['每月免费 LLM 额度', '输出 markdown 简历', '本地素材管理（无限）', '社区支持'],
    cta: { label: '免费开始', href: '/sign-up' },
  },
  {
    name: 'Pro',
    price: 'TBD',
    priceNote: '正式定价上线前公布',
    tagline: '认真求职阶段。',
    features: [
      '更多 LLM 额度',
      'A4 PDF 导出（不限次）',
      '岗位发现与匹配度评估',
      '辅助投递（数量受限）',
      '优先邮件支持',
    ],
    cta: { label: '加入 Waitlist', href: '/#waitlist' },
    highlight: true,
    badge: '最受欢迎',
  },
  {
    name: 'Max',
    price: 'TBD',
    priceNote: '密集求职专用',
    tagline: '不留余地，不被限制。',
    features: ['不受限 LLM 额度', '所有 Pro 功能', '辅助投递（不限）', '抢先体验新模块', '专属支持渠道'],
    cta: { label: '加入 Waitlist', href: '/#waitlist' },
  },
  {
    name: 'BYOK',
    price: '按用量',
    priceNote: '走你自己的 LLM 余额',
    tagline: '已经有 LLM 服务的用户。',
    features: [
      '在 dashboard 绑定自己的 key',
      'LLM 调用走你自己的账户',
      '功能权限按所在档（Free 即可启用）',
      '统一成本管理',
    ],
    cta: { label: '了解 BYOK', href: '/dashboard' },
  },
];

const PRICING_FAQ: { q: string; a: string }[] = [
  {
    q: '可以随时升降档吗？',
    a: '可以。在 dashboard 切换档位，按月计费按比例结算，不用走客服流程。',
  },
  {
    q: '不满意能退款吗？',
    a: '正式付费档位上线后，新用户首次订阅 7 天内未消耗主要功能可全额退款；具体细则在条款中明确。',
  },
  {
    q: '为什么 Pro 和 Max 的价格还是 TBD？',
    a: '我们想在正式定价前再次校准成本结构与用量数据。现阶段加入 Waitlist 的用户，定价确定后会拿到一份首批友好价。',
  },
  {
    q: '有企业版 / 团队版吗？',
    a: '有规划，但还在打磨需求。如果你代表公司想批量采购，请直接邮件联系，我们一对一聊。',
  },
  {
    q: 'Skill 套件本身收费吗？',
    a: '不收费。开发者用 npx skills add 等方式直接接入 Claude Code、Codex 等 AI agent 完全免费——平台档位只对服务端能力（PDF 渲染 / 岗位抓取 / 招聘库等）和云端 LLM 额度计费。',
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
              按你的求职阶段，
              <br />
              <Highlight>选一档</Highlight>。
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-[16px] leading-[1.7] text-ink-soft">
              Skill 永远免费；只对云端 LLM 额度和服务端能力计费。
            </p>
            <div className="mx-auto mt-6 inline-flex items-center gap-2 rounded-full border-2 border-corgi/60 bg-fluff px-3.5 py-1 text-[12px] font-semibold text-yellow-deep">
              <Sparkle />
              当前为预发布定价，正式版上线前可能微调
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-rule">
        <div className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-20">
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {TIERS.map((tier) => (
              <PricingCard key={tier.name} tier={tier} isLoggedIn={isLoggedIn} />
            ))}
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

function PricingCard({ tier, isLoggedIn }: { tier: Tier; isLoggedIn: boolean }) {
  const ctaHref = tier.cta.href === '/sign-up' && isLoggedIn ? '/dashboard' : tier.cta.href;
  const ctaLabel = tier.cta.href === '/sign-up' && isLoggedIn ? '进入 Dashboard' : tier.cta.label;

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
          <span className="text-3xl font-extrabold text-ink tabular-nums">{tier.price}</span>
        </div>
        <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-mute">{tier.priceNote}</p>
      </div>
      <ul className="mt-6 flex-1 space-y-2.5 text-[14px] leading-[1.6]">
        {tier.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-ink-soft">
            <span className="mt-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-fluff text-yellow-deep">
              ✓
            </span>
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
