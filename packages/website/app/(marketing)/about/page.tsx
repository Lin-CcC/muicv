import type { Metadata } from 'next';
import { headers } from 'next/headers';

import { CorgiMascot } from '@/components/corgi-mascot';
import { getAuth } from '@/lib/auth';

import { Footer } from '../_sections/footer';
import { Header } from '../_sections/header';
import { ArrowUpRight, Highlight, PawIcon } from '../_icons';

export const metadata: Metadata = {
  title: '关于我们',
  description: '我们想做一个真正帮你拿到 offer 的工具，而不是又一个简历模板生成器。',
  alternates: { canonical: '/about' },
};

export const dynamic = 'force-dynamic';

export default async function AboutPage() {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  const isLoggedIn = !!session?.user;

  return (
    <div className="relative">
      <Header isLoggedIn={isLoggedIn} />

      <section className="relative overflow-hidden border-b border-rule">
        <div className="absolute inset-0 bg-sun" aria-hidden />
        <div className="absolute inset-0 bg-grid opacity-50" aria-hidden />
        <div className="pointer-events-none absolute right-[8%] top-[20%] hidden text-corgi/40 lg:block">
          <PawIcon className="h-9 w-9" />
        </div>

        <div className="relative mx-auto max-w-4xl px-5 py-20 md:px-8 md:py-24">
          <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-yellow-deep">— 关于</p>
          <h1 className="mt-3 text-[clamp(2.25rem,5vw,3.75rem)] font-extrabold leading-[1.05] tracking-tight text-ink">
            一个真正帮你拿到 <Highlight>offer</Highlight> 的工具，
            <br />
            不是又一个模板生成器。
          </h1>
          <p className="mt-6 max-w-2xl text-[18px] leading-[1.7] text-ink-soft">
            Mui简历是一个一站式 AI 求职平台：从整理过往经历开始，到发现合适的岗位、定制简历、模拟面试、写求职信，
            全程围绕"拿到下一份工作"这件事——而不只是产出一个好看的 PDF。
          </p>
        </div>
      </section>

      <section className="border-b border-rule">
        <div className="mx-auto max-w-4xl px-5 py-16 md:px-8 md:py-20">
          <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-yellow-deep">— 我们做什么</p>
          <h2 className="mt-3 text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight">
            从素材到 offer 的完整链路。
          </h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {[
              {
                t: '不只是简历',
                d: '简历只是入口。我们看重的是后面真正决定你拿不拿到 offer 的环节：岗位匹配、面试准备、就业策略。',
              },
              {
                t: '数据自主',
                d: '所有素材以 Markdown 文件存在你自己电脑或项目里。我们不做云端"简历库"，不锁住你的数据。',
              },
              {
                t: '不替你发挥',
                d: '所有内容严格基于你写下的事实。缺素材就追问或留空，绝不替你"创作"——避免面试时被自己的简历坑到。',
              },
            ].map((item) => (
              <div
                key={item.t}
                className="rounded-xl border-2 border-ink bg-cream p-6 transition-transform hover:-translate-y-1"
              >
                <p className="text-[16px] font-extrabold text-ink">{item.t}</p>
                <p className="mt-2 text-[14px] leading-[1.7] text-ink-soft">{item.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-rule">
        <div className="mx-auto max-w-4xl px-5 py-16 md:px-8 md:py-20">
          <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-yellow-deep">— 为什么做</p>
          <h2 className="mt-3 text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight">
            找工作这件事，不该这么难。
          </h2>
          <div className="mt-8 space-y-5 text-[16px] leading-[1.8] text-ink-soft">
            <p>
              我们见过太多优秀的候选人栽在简历上：内容很厉害但讲不清楚、模板套了一个又一个、对着 JD
              改了一晚上还是不知道该不该投。
            </p>
            <p>
              市面上的简历工具大多只解决了"排版好看"，但找工作的真正难点在前后两端：前端是"自己有什么能讲的"，后端是"哪个岗位适合我、面试要准备什么"。
            </p>
            <p>
              我们想做的是一整条链路上的工具，把每个环节都做到不糊弄：从你写下第一段经历开始，一直到拿到 offer 的那天。
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-rule">
        <div className="mx-auto max-w-4xl px-5 py-16 md:px-8 md:py-20">
          <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-yellow-deep">— 团队</p>
          <h2 className="mt-3 text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight">
            一只柯基带一个工程师。
          </h2>
          <div className="mt-8 grid items-start gap-8 md:grid-cols-[auto_1fr]">
            <div className="relative">
              <div className="absolute -inset-3 rounded-full bg-yellow/20 blur-xl" aria-hidden />
              <div className="relative flex h-32 w-32 items-center justify-center rounded-full border-2 border-ink bg-cream shadow-[0_4px_0_0_var(--color-yellow-shadow)]">
                <CorgiMascot className="h-20 w-20" />
              </div>
            </div>
            <div className="text-[16px] leading-[1.8] text-ink-soft">
              <p>
                项目由 <strong className="text-ink">meathill</strong>（一名做了多年前端的开发者）发起， 由柯基{' '}
                <strong className="text-ink">Mui</strong> 监修——她是 meathill
                家的黄白色小狗，监修产品时会趴在键盘上影响代码合入。
              </p>
              <p className="mt-3">
                未来会有更多伙伴加入，但产品的初心不会变：做工具，不做营销噱头；把用户体验和数据自主放在最前面。
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-paper">
        <div className="mx-auto max-w-4xl px-5 py-16 text-center md:px-8 md:py-20">
          <h2 className="text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight">
            找到下一份工作，从这里开始。
          </h2>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href={isLoggedIn ? '/dashboard' : '/sign-up'}
              className="press inline-flex items-center gap-2 rounded-xl bg-yellow px-5 py-3 text-[16px] font-bold text-ink"
            >
              {isLoggedIn ? '进入控制台' : '免费开始'}
              <ArrowUpRight />
            </a>
            <a
              href="/contact"
              className="press-ink inline-flex items-center gap-2 rounded-xl border-2 border-ink bg-cream px-5 py-3 text-[16px] font-bold text-ink"
            >
              联系我们
              <ArrowUpRight />
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
