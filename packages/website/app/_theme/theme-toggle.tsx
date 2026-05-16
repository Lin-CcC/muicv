'use client';

import { CaretDownIcon, MoonIcon, SunIcon } from '@phosphor-icons/react';

import { type Theme, useTheme } from './use-theme';

const OPTIONS: { value: Theme; label: string }[] = [
  { value: 'light', label: '浅' },
  { value: 'auto', label: '自动' },
  { value: 'dark', label: '暗' },
];
const DEFAULT_OPTION: { value: Theme; label: string } = { value: 'light', label: '浅' };

/**
 * Header / Dashboard nav 共用的紧凑主题选择。
 */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const selectedOption = OPTIONS.find((option) => option.value === theme) ?? DEFAULT_OPTION;

  return (
    <div className={`relative inline-flex h-8 w-[82px] items-center ${className}`}>
      <span className="pointer-events-none absolute left-2.5 flex text-ink" aria-hidden>
        {theme === 'dark' ? (
          <MoonIcon size={14} />
        ) : (
          <SunIcon size={14} weight={theme === 'light' ? 'fill' : 'regular'} />
        )}
      </span>
      <select
        aria-label={`主题：${selectedOption.label}`}
        value={theme}
        onChange={(event) => setTheme(event.target.value as Theme)}
        className="h-full w-full appearance-none rounded-md border border-rule-strong bg-paper/70 py-1 pr-6 pl-7 font-mono text-[12px] font-bold text-ink outline-none transition hover:bg-fluff focus-visible:border-ink focus-visible:ring-2 focus-visible:ring-yellow/45"
      >
        {OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <CaretDownIcon size={12} weight="bold" className="pointer-events-none absolute right-2 text-mute" aria-hidden />
    </div>
  );
}
