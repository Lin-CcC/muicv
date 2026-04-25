import { useEffect } from 'react';

import { ChatView } from './components/chat-view';
import { SettingsView } from './components/settings-view';
import { TitleBar } from './components/title-bar';
import { useAppStore } from './lib/store';

export function App() {
  const view = useAppStore((s) => s.view);
  const configLoaded = useAppStore((s) => s.configLoaded);
  const loadConfig = useAppStore((s) => s.loadConfig);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  return (
    <div className="flex h-screen flex-col bg-cream">
      <TitleBar />
      <main className="flex-1 overflow-hidden">
        {!configLoaded ? (
          <div className="flex h-full items-center justify-center text-mute">加载中…</div>
        ) : view === 'settings' ? (
          <SettingsView />
        ) : (
          <ChatView />
        )}
      </main>
    </div>
  );
}
