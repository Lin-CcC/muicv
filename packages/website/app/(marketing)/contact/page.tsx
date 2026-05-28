import type { Metadata } from 'next';

import { Footer } from '../_sections/footer';
import { Header } from '../_sections/header';
import { ArrowUpRight, Highlight } from '../_icons';

export const metadata: Metadata = {
  title: '联系我们',
  description: '产品反馈、商务合作、媒体询问——找对邮箱，回复更快。',
  alternates: { canonical: '/contact' },
};

export const revalidate = 3600;

const CONTACTS: { label: string; tag: string; email: string; desc: string }[] = [
  {
    label: '一般联系',
    tag: '产品反馈 / 用户支持',
    email: 'hi@muicv.com',
    desc: '使用问题、bug 反馈、功能建议——任何关于产品本身的问题都可以发到这里。',
  },
  {
    label: '商务合作',
    tag: '企业 / 团队 / 合作',
    email: 'partner@muicv.com',
    desc: '团队批量采购、教育机构合作、求职平台对接——商务相关请走这个邮箱，回复更快。',
  },
  {
    label: '媒体询问',
    tag: '采访 / 报道 / 品牌',
    email: 'press@muicv.com',
    desc: '采访邀约、媒体素材、品牌资料申请。简单介绍下报道方向，我们会尽快回复。',
  },
];

export default function ContactPage() {
  return (
    <div className="relative">
      <Header />

      <section className="relative overflow-hidden border-b border-rule">
        <div className="absolute inset-0 bg-sun" aria-hidden />
        <div className="absolute inset-0 bg-grid opacity-50" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-20">
          <div className="max-w-3xl">
            <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-yellow-deep">— 联系</p>
            <h1 className="mt-3 text-[clamp(2.25rem,5vw,3.75rem)] font-extrabold leading-[1.05] tracking-tight text-ink">
              想跟我们 <Highlight>说点什么</Highlight>？
            </h1>
            <p className="mt-6 max-w-2xl text-[16px] leading-[1.7] text-ink-soft">
              我们读每一封邮件。一般会在 1–3 个工作日内回复；高峰期可能稍慢，但一定会回。
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-rule">
        <div className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-20">
          <div className="grid gap-5 md:grid-cols-3">
            {CONTACTS.map((c) => (
              <article
                key={c.email}
                className="flex flex-col rounded-xl border-2 border-ink bg-cream p-6 shadow-[0_4px_0_0_var(--color-ink-line)] transition-transform hover:-translate-y-1"
              >
                <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-yellow-deep">{c.tag}</p>
                <h2 className="mt-2 text-[18px] font-extrabold text-ink">{c.label}</h2>
                <p className="mt-3 flex-1 text-[14px] leading-[1.7] text-ink-soft">{c.desc}</p>
                <a
                  href={`mailto:${c.email}`}
                  className="press mt-5 inline-flex items-center justify-between gap-2 rounded-xl bg-yellow px-4 py-2.5 text-[14px] font-bold text-ink"
                >
                  <span className="truncate font-mono">{c.email}</span>
                  <ArrowUpRight />
                </a>
              </article>
            ))}
          </div>

          <div className="mt-10 rounded-xl border-2 border-rule bg-paper/50 p-6 text-[14px] leading-[1.7] text-ink-soft md:p-8">
            <p>
              <strong className="text-ink">想直接试用？</strong>{' '}
              <a
                href="/download"
                className="font-semibold text-yellow-deep underline decoration-corgi decoration-2 underline-offset-4 hover:decoration-yellow"
              >
                下载桌面 app
              </a>{' '}
              立即开始，macOS / Windows / Linux 全平台可用。
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
