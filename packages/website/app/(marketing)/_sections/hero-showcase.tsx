'use client';

import { useEffect, useRef, useState } from 'react';

import { CorgiMascot } from '@/components/corgi-mascot';

import type { Dictionary } from '../_i18n/types';
import { DocIcon } from '../_icons';

type Showcase = Dictionary['heroShowcase'];

const SLIDE_KEYS = ['import', 'library', 'resume'] as const;
type SlideKey = (typeof SLIDE_KEYS)[number];

const ROTATE_MS = 6000;

export function HeroShowcase({ showcase }: { showcase: Showcase }) {
  const [active, setActive] = useState<SlideKey>('import');
  const pausedRef = useRef(false);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (pausedRef.current) return;
      setActive((cur) => {
        const idx = SLIDE_KEYS.indexOf(cur);
        const next = SLIDE_KEYS[(idx + 1) % SLIDE_KEYS.length];
        return next ?? cur;
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
        <CorgiMascot className="h-16 w-16 drop-shadow-[0_3px_0_var(--color-yellow-shadow)]" />
      </div>
      <div className="absolute -inset-x-1 -inset-y-1 rounded-xl bg-yellow/15 blur-md" aria-hidden />

      <div className="relative">
        <div role="tablist" aria-label={showcase.tabsAria} className="mb-3 flex flex-wrap gap-1.5">
          {SLIDE_KEYS.map((key) => {
            const isActive = active === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                id={`hero-tab-${key}`}
                aria-selected={isActive}
                aria-controls={`hero-panel-${key}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setActive(key)}
                className={
                  isActive
                    ? 'rounded-full border-2 border-ink bg-yellow px-3 py-1 text-[12px] font-bold text-ink shadow-[0_2px_0_0_var(--color-yellow-shadow)]'
                    : 'rounded-full border-2 border-rule bg-cream px-3 py-1 text-[12px] font-semibold text-ink-soft transition-colors hover:border-corgi hover:text-ink'
                }
              >
                {showcase.slides[key]}
              </button>
            );
          })}
        </div>

        <div className="relative aspect-[4/3.1] w-full">
          <Slide active={active === 'import'} slideKey="import">
            <ImportSlide s={showcase} />
          </Slide>
          <Slide active={active === 'library'} slideKey="library">
            <LibrarySlide s={showcase} />
          </Slide>
          <Slide active={active === 'resume'} slideKey="resume">
            <ResumeSlide />
          </Slide>
        </div>

        <div className="mt-3 flex items-center gap-2 font-mono text-[12px] text-mute">
          <span className="inline-block h-2 w-2 rounded-full bg-yellow" />
          {showcase.caption}
        </div>
      </div>
    </div>
  );
}

function Slide({ active, slideKey, children }: { active: boolean; slideKey: SlideKey; children: React.ReactNode }) {
  return (
    <div
      role="tabpanel"
      id={`hero-panel-${slideKey}`}
      aria-labelledby={`hero-tab-${slideKey}`}
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

function ImportSlide({ s }: { s: Showcase }) {
  return (
    <div className="relative h-full overflow-hidden rounded-xl border-2 border-ink bg-cream shadow-press-ink-lg">
      <div className="flex items-center justify-between border-b-2 border-rule bg-paper px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-tongue/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-yellow/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-corgi/80" />
        </div>
        <span className="font-mono text-[12px] uppercase tracking-wider text-mute">{s.importHeader}</span>
      </div>
      <div className="p-5">
        <p className="text-[18px] font-extrabold text-ink">{s.importTitle}</p>
        <p className="mt-2 text-[14px] leading-[1.65] text-ink-soft">{s.importDesc}</p>
        <div className="mt-5 grid gap-3">
          {s.importItems.map((item) => (
            <div
              key={item.title}
              className="flex items-center gap-3 rounded-xl border-2 border-rule bg-paper/70 px-4 py-3"
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-yellow text-ink">
                <DocIcon className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-[14px] font-extrabold text-ink">{item.title}</span>
                <span className="block text-[12px] text-mute">{item.desc}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LibrarySlide({ s }: { s: Showcase }) {
  return (
    <div className="relative h-full overflow-hidden rounded-xl border-2 border-ink bg-cream shadow-press-ink-lg">
      <div className="flex items-center gap-2 border-b-2 border-rule bg-paper px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-tongue/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-yellow/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-corgi/80" />
        <span className="ml-3 font-mono text-[12px] uppercase tracking-wider text-mute">{s.libraryHeader}</span>
      </div>
      <div className="grid h-[calc(100%-2.6rem)] grid-cols-[7.5rem_1fr]">
        <aside className="border-r border-rule bg-paper/50 p-3 text-[12px]">
          <p className="font-mono text-[12px] font-bold uppercase tracking-wider text-yellow-deep">
            {s.libraryNavLabel}
          </p>
          <ul className="mt-2 space-y-1.5 text-ink-soft">
            {s.libraryNav.map((label, idx) => (
              <li
                key={label}
                className={idx === 0 ? 'rounded-md bg-yellow/30 px-2 py-1 font-semibold text-ink' : 'px-2 py-1'}
              >
                {label}
              </li>
            ))}
          </ul>
        </aside>
        <div className="p-4">
          <p className="text-[14px] font-extrabold text-ink">{s.libraryListLabel}</p>
          <ul className="mt-3 space-y-2">
            {s.libraryItems.map((item) => (
              <li
                key={item.title}
                className="flex items-center justify-between rounded-lg border border-rule bg-cream px-3 py-2"
              >
                <span className="text-[12px] font-semibold text-ink">{item.title}</span>
                <span className="font-mono text-[12px] font-bold text-yellow-deep">{item.match}</span>
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
        <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-yellow px-2 py-0.5 font-mono text-[12px] font-bold uppercase tracking-wider text-ink">
          A4
        </div>
        <div className="px-5 py-4">
          <div className="h-3 w-2/3 rounded bg-ink/85" />
          <div className="mt-1.5 h-2 w-2/5 rounded bg-mute/40" />
          <div className="mt-3 flex gap-1.5">
            {['React', 'TypeScript', 'Node.js'].map((skill) => (
              <span
                key={skill}
                className="rounded-full bg-fluff px-1.5 py-[1px] font-mono text-[12px] font-bold uppercase tracking-wider text-yellow-deep"
              >
                {skill}
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
