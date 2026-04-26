import { useEffect } from 'react';

import { ChatView } from './components/chat-view';
import { LoginView } from './components/login-view';
import { SettingsView } from './components/settings-view';
import { TitleBar } from './components/title-bar';
import { bootstrap, useAppStore } from './lib/store';

export function App() {
  const view = useAppStore((s) => s.view);
  const bootstrapping = useAppStore((s) => s.bootstrapping);

  useEffect(() => {
    void bootstrap();
  }, []);

  return (
    <div className="flex h-screen flex-col bg-cream">
      <TitleBar />
      <main className="flex-1 overflow-hidden">
        {bootstrapping ? (
          <div className="flex h-full items-center justify-center text-mute">加载中…</div>
        ) : view === 'login' ? (
          <LoginView />
        ) : view === 'settings' ? (
          <SettingsView />
        ) : (
          <ChatView />
        )}
      </main>
    </div>
  );
}
