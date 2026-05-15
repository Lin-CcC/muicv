'use client';

import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'auto';

const STORAGE_KEY = 'muicv-theme';

export function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === 'dark' || v === 'auto' ? v : 'light';
}

function applyTheme(t: Theme) {
  const html = document.documentElement;
  if (t === 'light') {
    html.removeAttribute('data-theme');
  } else {
    html.setAttribute('data-theme', t);
  }
}

/**
 * 三态主题切换：light / auto / dark。token 与 data-theme 联动在 globals.css 里。
 * 初始值由 _theme/theme-init-script 在 React 挂载前读 localStorage 决定，
 * 这里只负责挂载后的 state + 写入。
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('light');

  useEffect(() => {
    setThemeState(readStoredTheme());
  }, []);

  function setTheme(t: Theme) {
    setThemeState(t);
    try {
      window.localStorage.setItem(STORAGE_KEY, t);
    } catch {
      // ignore quota / private-mode errors
    }
    applyTheme(t);
  }

  return { theme, setTheme };
}
