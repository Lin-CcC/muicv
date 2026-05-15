'use client';

import { useEffect, useRef, useState } from 'react';

import { CorgiMascot } from '@/components/corgi-mascot';

import { DocIcon } from '../_icons';

const SLIDES = [
  { key: 'import', label: '导入素材' },
  { key: 'library', label: '素材库' },
  { key: 'resume', label: '定制简历' },
] as const;

type SlideKey = (typeof SLIDES)[number]['key'];

const ROTATE_MS = 6000;

export function HeroShowcase() {
  const [active, setActive] = useState<SlideKey>('import');
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
        <CorgiMascot className="h-16 w-16 drop-shadow-[0_3px_0_var(--color-yellow-deep)]" />
      </div>
      <div className="absolute -inset-x-1 -inset-y-1 rounded-xl bg-yellow/15 blur-md" aria-hidden />

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
          <Slide active={active === 'import'}>
            <ImportSlide />
          </Slide>
          <Slide active={active === 'library'}>
            <LibrarySlide />
          </Slide>
          <Slide active={active === 'resume'}>
            <ResumeSlide />
          </Slide>
        </div>

        <div className="mt-3 flex items-center gap-2 font-mono text-[11px] text-mute">
          <span className="inline-block h-2 w-2 rounded-full bg-yellow" />
          先整理，再针对岗位迭代
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

function ImportSlide() {
  return (
    <div className="relative h-full overflow-hidden rounded-xl border-2 border-ink bg-cream shadow-press-ink-lg">
      <div className="flex items-center justify-between border-b-2 border-rule bg-paper px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-tongue/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-yellow/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-corgi/80" />
        </div>
        <span className="font-mono text-[10px] uppercase tracking-wider text-mute">Mui简历 · 第一步</span>
      </div>
      <div className="p-5">
        <h4 className="text-[18px] font-extrabold text-ink">先放进来一份真实材料</h4>
        <p className="mt-2 text-[13px] leading-[1.65] text-ink-soft">
          上传简历、粘贴经历，或者直接说“我想从零整理”。Mui 会从你已经有的内容开始。
        </p>
        <div className="mt-5 grid gap-3">
          {[
            { title: '现有简历.pdf', desc: '解析成可编辑素材' },
            { title: '一段项目经历', desc: '补齐背景、动作、结果' },
            { title: '目标岗位链接', desc: '之后用来生成版本' },
          ].map((item) => (
            <div
              key={item.title}
              className="flex items-center gap-3 rounded-xl border-2 border-rule bg-paper/70 px-4 py-3"
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-yellow text-ink">
                <DocIcon className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-[13px] font-extrabold text-ink">{item.title}</span>
                <span className="block text-[11.5px] text-mute">{item.desc}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LibrarySlide() {
  return (
    <div className="relative h-full overflow-hidden rounded-xl border-2 border-ink bg-cream shadow-press-ink-lg">
      <div className="flex items-center gap-2 border-b-2 border-rule bg-paper px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-tongue/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-yellow/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-corgi/80" />
        <span className="ml-3 font-mono text-[11px] uppercase tracking-wider text-mute">职业素材库</span>
      </div>
      <div className="grid h-[calc(100%-2.6rem)] grid-cols-[7.5rem_1fr]">
        <aside className="border-r border-rule bg-paper/50 p-3 text-[12px]">
          <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-yellow-deep">导航</p>
          <ul className="mt-2 space-y-1.5 text-ink-soft">
            <li className="rounded-md bg-yellow/30 px-2 py-1 font-semibold text-ink">经历</li>
            <li className="px-2 py-1">项目</li>
            <li className="px-2 py-1">技能</li>
            <li className="px-2 py-1">岗位</li>
          </ul>
        </aside>
        <div className="p-4">
          <h4 className="text-[14px] font-extrabold text-ink">可复用素材</h4>
          <ul className="mt-3 space-y-2">
            {[
              { title: '负责会员增长实验平台', match: '已量化' },
              { title: '重构前端发布链路', match: '可投递' },
              { title: '跨团队推进埋点规范', match: '待补充' },
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
    <div className="flex h-full items-center justify-center rounded-xl border-2 border-rule bg-paper/60 p-6">
      <div className="relative h-full w-[72%] overflow-hidden rounded-md border border-rule-strong bg-cream shadow-press-ink">
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
