import { useEffect } from 'react';

import { AppShell } from './components/app-shell';
import { LoginView } from './components/login-view';
import { bootstrap, useAppStore } from './lib/store';

export function App() {
  const view = useAppStore((s) => s.view);
  const bootstrapping = useAppStore((s) => s.bootstrapping);

  useEffect(() => {
    void bootstrap();
  }, []);

  if (bootstrapping) {
    return <div className="flex h-screen items-center justify-center bg-cream text-mute">加载中…</div>;
  }

  if (view === 'login') {
    // 登录页保留原来的全屏卡片布局，不套 AppShell（没 session 没法显示左栏）
    return (
      <div className="flex h-screen flex-col bg-cream">
        <LoginView />
      </div>
    );
  }

  return <AppShell />;
}
