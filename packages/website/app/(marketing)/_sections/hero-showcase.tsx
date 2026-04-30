'use client';

import { useEffect, useRef, useState } from 'react';

import { CorgiMascot } from '@/components/corgi-mascot';

import { ChatIcon, CompassIcon, DocIcon, TargetIcon } from '../_icons';

const SLIDES = [
  { key: 'cli', label: 'AI agent' },
  { key: 'app', label: '桌面 app' },
  { key: 'resume', label: '简历' },
  { key: 'capabilities', label: '能力' },
] as const;

type SlideKey = (typeof SLIDES)[number]['key'];

const ROTATE_MS = 6000;

export function HeroShowcase() {
  const [active, setActive] = useState<SlideKey>('cli');
  const pausedRef = useRef(false);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (pausedRef.current) return;
      setActive((cur) => {
        const idx = SLIDES.findIndex((s) => s.key === cur);
        const next = SLIDES[(idx + 1) % SLIDES.length];
        return next ? next.key : cur;
      });
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div
      className="relative"
      onMouseEnter={() => {
        pausedRef.current = true;
      }}
      onMouseLeave={() => {
        pausedRef.current = false;
      }}
    >
      <div className="absolute -right-3 -top-7 z-10 hidden md:block">
        <CorgiMascot className="h-16 w-16 drop-shadow-[0_3px_0_oklch(0.62_0.14_70)]" />
      </div>
      <div className="absolute -inset-x-1 -inset-y-1 rounded-2xl bg-yellow/15 blur-md" aria-hidden />

      <div className="relative">
        <div role="tablist" aria-label="演示切换" className="mb-3 flex flex-wrap gap-1.5">
          {SLIDES.map((slide) => {
            const isActive = active === slide.key;
            return (
              <button
                key={slide.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActive(slide.key)}
                className={
                  isActive
                    ? 'rounded-full border-2 border-ink bg-yellow px-3 py-1 text-[11.5px] font-bold text-ink shadow-[0_2px_0_0_var(--color-yellow-deep)]'
                    : 'rounded-full border-2 border-rule bg-cream px-3 py-1 text-[11.5px] font-semibold text-ink-soft transition-colors hover:border-corgi hover:text-ink'
                }
              >
                {slide.label}
              </button>
            );
          })}
        </div>

        <div className="relative aspect-[4/3.1] w-full">
          <Slide active={active === 'cli'}>
            <CliSlide />
          </Slide>
          <Slide active={active === 'app'}>
            <AppSlide />
          </Slide>
          <Slide active={active === 'resume'}>
            <ResumeSlide />
          </Slide>
          <Slide active={active === 'capabilities'}>
            <CapabilitiesSlide />
          </Slide>
        </div>

        <div className="mt-3 flex items-center gap-2 font-mono text-[11px] text-mute">
          <span className="inline-block h-2 w-2 rounded-full bg-yellow" />
          多种入口，一份数据
        </div>
      </div>
    </div>
  );
}

function Slide({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <div
      aria-hidden={!active}
      className={
        active
          ? 'absolute inset-0 opacity-100 transition-opacity duration-500'
          : 'pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500'
      }
    >
      {children}
    </div>
  );
}

function CliSlide() {
  return (
    <div className="relative h-full overflow-hidden rounded-2xl border-2 border-ink/85 bg-[#1a1815] font-mono text-[12.5px] leading-relaxed text-cream/90 shadow-[0_5px_0_0_oklch(0.24_0.04_65)]">
      <div className="flex items-center justify-between border-b border-cream/8 px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-tongue/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-yellow/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-corgi/80" />
        </div>
        <span className="text-[10px] uppercase tracking-wider text-cream/40">~/career — AI agent</span>
      </div>
      <pre className="overflow-hidden px-4 py-4">
        <code>
          <span className="text-[oklch(0.86_0.13_85)]">$</span> <span className="text-cream">muicv</span>
          {'\n\n'}
          <span className="text-cream/55"># 跟它聊：</span>
          {'\n'}
          <span className="text-[oklch(0.86_0.13_85)]">{'>'}</span>{' '}
          <span className="text-cream/95">帮我针对这个岗位准备简历</span>
          {'\n\n'}
          <span className="text-[oklch(0.86_0.13_85)]">✓</span> <span className="text-cream/85">抓取岗位</span>
          {'    '}
          <span className="text-cream/40">已整理为目标档案</span>
          {'\n'}
          <span className="text-[oklch(0.86_0.13_85)]">✓</span> <span className="text-cream/85">匹配度评估</span>
          {'  '}
          <span className="text-cream/40">9/12 关键词覆盖</span>
          {'\n'}
          <span className="text-[oklch(0.86_0.13_85)]">✓</span> <span className="text-cream/85">定制简历</span>
          {'    '}
          <span className="text-cream/40">v1 草稿已生成</span>
          {'\n'}
          <span className="text-[oklch(0.86_0.13_85)]">✓</span> <span className="text-cream/85">导出 PDF</span>
          {'      '}
          <span className="text-cream/40">→ resume.pdf</span>{' '}
          <span className="text-[oklch(0.7_0.16_25)]">2 页 · 148 KB</span>
          {'\n\n'}
          <span className="text-cream/55">done in 8.2s 🐾</span>
        </code>
      </pre>
    </div>
  );
}

function AppSlide() {
  return (
    <div className="relative h-full overflow-hidden rounded-2xl border-2 border-ink bg-cream shadow-[0_5px_0_0_oklch(0.24_0.04_65)]">
      <div className="flex items-center gap-2 border-b-2 border-rule bg-paper px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-tongue/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-yellow/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-corgi/80" />
        <span className="ml-3 font-mono text-[11px] uppercase tracking-wider text-mute">Mui简历</span>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-rule-strong bg-cream px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-mute">
          <span className="h-1.5 w-1.5 rounded-full bg-mute/60" />
          coming soon
        </span>
      </div>
      <div className="grid h-[calc(100%-2.6rem)] grid-cols-[7.5rem_1fr]">
        <aside className="border-r border-rule bg-paper/50 p-3 text-[12px]">
          <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-yellow-deep">导航</p>
          <ul className="mt-2 space-y-1.5 text-ink-soft">
            <li className="rounded-md bg-yellow/30 px-2 py-1 font-semibold text-ink">岗位</li>
            <li className="px-2 py-1">简历</li>
            <li className="px-2 py-1">面试</li>
            <li className="px-2 py-1">辅导</li>
          </ul>
        </aside>
        <div className="p-4">
          <h4 className="text-[14px] font-extrabold text-ink">目标岗位</h4>
          <ul className="mt-3 space-y-2">
            {[
              { title: 'Frontend Engineer · Acme', match: '92%' },
              { title: 'Senior FE · Globex', match: '78%' },
              { title: 'Lead UI · Initech', match: '64%' },
            ].map((item) => (
              <li
                key={item.title}
                className="flex items-center justify-between rounded-lg border border-rule bg-cream px-3 py-2"
              >
                <span className="text-[12.5px] font-semibold text-ink">{item.title}</span>
                <span className="font-mono text-[11px] font-bold text-yellow-deep">{item.match}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function ResumeSlide() {
  return (
    <div className="flex h-full items-center justify-center rounded-2xl border-2 border-rule bg-paper/60 p-6">
      <div className="relative h-full w-[72%] overflow-hidden rounded-md border border-rule-strong bg-cream shadow-[0_4px_0_0_oklch(0.24_0.04_65)]">
        <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-yellow px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-ink">
          A4
        </div>
        <div className="px-5 py-4">
          <div className="h-3 w-2/3 rounded bg-ink/85" />
          <div className="mt-1.5 h-2 w-2/5 rounded bg-mute/40" />
          <div className="mt-3 flex gap-1.5">
            {['React', 'TypeScript', 'Node.js'].map((s) => (
              <span
                key={s}
                className="rounded-full bg-fluff px-1.5 py-[1px] font-mono text-[8px] font-bold uppercase tracking-wider text-yellow-deep"
              >
                {s}
              </span>
            ))}
          </div>
          <div className="mt-4 space-y-2.5">
            {[1, 2, 3].map((i) => (
              <div key={i}>
                <div className="flex items-center justify-between">
                  <div className="h-2 w-1/3 rounded bg-ink/70" />
                  <div className="h-1.5 w-12 rounded bg-mute/30" />
                </div>
                <div className="mt-1 h-1.5 w-5/6 rounded bg-mute/30" />
                <div className="mt-1 h-1.5 w-3/5 rounded bg-mute/25" />
              </div>
            ))}
          </div>
          <div className="mt-4 h-2 w-1/4 rounded bg-ink/85" />
          <div className="mt-1.5 h-1.5 w-3/4 rounded bg-mute/30" />
          <div className="mt-1 h-1.5 w-2/3 rounded bg-mute/30" />
        </div>
      </div>
    </div>
  );
}

function CapabilitiesSlide() {
  const items: { title: string; Icon: React.ComponentType<{ className?: string }>; tag: string }[] = [
    { title: '智能简历', Icon: DocIcon, tag: '已上线' },
    { title: '岗位发现', Icon: TargetIcon, tag: '已上线' },
    { title: '模拟面试', Icon: ChatIcon, tag: '即将推出' },
    { title: '就业辅导', Icon: CompassIcon, tag: '即将推出' },
  ];
  return (
    <div className="grid h-full grid-cols-2 gap-3 rounded-2xl border-2 border-ink bg-cream p-4 shadow-[0_5px_0_0_oklch(0.24_0.04_65)]">
      {items.map(({ title, Icon, tag }) => (
        <div key={title} className="flex flex-col justify-between rounded-xl border-2 border-rule bg-paper/60 p-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-yellow text-ink">
            <Icon className="h-5 w-5" />
          </span>
          <div className="mt-3">
            <p className="text-[14px] font-extrabold text-ink">{title}</p>
            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-mute">{tag}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
