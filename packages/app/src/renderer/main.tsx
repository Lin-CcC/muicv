import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App.tsx';
import { bootstrapTheme } from './lib/use-theme.ts';
import './styles/globals.css';

// 在 React mount 之前 sync 设 data-theme，避免首帧浅色闪一下再切到暗色
bootstrapTheme();

const container = document.getElementById('root');
if (!container) throw new Error('root container missing');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
