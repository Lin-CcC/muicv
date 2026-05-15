'use client';

import { MoonIcon, SunIcon } from '@phosphor-icons/react';

import { type Theme, useTheme } from './use-theme';

const OPTIONS: { value: Theme; label: string; ariaLabel: string }[] = [
  { value: 'light', label: '浅', ariaLabel: '浅色模式' },
  { value: 'auto', label: '自动', ariaLabel: '跟随系统' },
  { value: 'dark', label: '暗', ariaLabel: '暗色模式' },
];

/**
 * 三档主题切换。Header / Dashboard nav 都可以用。
 * 视觉：紧凑 pill 容器 + 当前档位走 yellow press 风。
 */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  return (
    <div
      role="radiogroup"
      aria-label="主题切换"
      className={`inline-flex items-center gap-0.5 rounded-md border border-rule-strong bg-paper/60 p-0.5 ${className}`}
    >
      {OPTIONS.map((opt) => {
        const active = theme === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={opt.ariaLabel}
            onClick={() => setTheme(opt.value)}
            className={
              active
                ? 'inline-flex items-center gap-1 rounded-sm bg-yellow px-2 py-0.5 font-mono text-[12px] font-bold text-ink shadow-[0_1px_0_0_var(--color-yellow-deep)]'
                : 'inline-flex items-center gap-1 rounded-sm px-2 py-0.5 font-mono text-[12px] font-semibold text-mute transition-colors hover:text-ink'
            }
          >
            {opt.value === 'light' && <SunIcon size={12} weight={active ? 'fill' : 'regular'} />}
            {opt.value === 'dark' && <MoonIcon size={12} weight={active ? 'fill' : 'regular'} />}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
