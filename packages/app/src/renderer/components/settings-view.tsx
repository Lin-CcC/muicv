import { ArrowLeftIcon } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';

import { useAppStore } from '../lib/store';
import { CorgiMascot } from './corgi-mascot';
import { Avatar } from './settings/bits';
import { CustomLlmCard } from './settings/custom-llm-card';
import { ModelCard } from './settings/model-card';
import { MuirouterCard } from './settings/muirouter-card';
import { PlanCard } from './settings/plan-card';

/**
 * 登录后的"账号控制台"。简历管理在顶栏 dropdown 完成，这里只放：
 *
 *   1. 账号头部（含返回按钮 + 退出登录）
 *   2. 会员档位 + token 余额（[PlanCard](settings/plan-card.tsx)）
 *   3. 模型选择卡（[ModelCard](settings/model-card.tsx)）
 *   4. muirouter 介绍卡（[MuirouterCard](settings/muirouter-card.tsx)）
 *   5. "用我自己的模型和额度"（[CustomLlmCard](settings/custom-llm-card.tsx)）
 *   6. footer 显示客户端版本号方便排查
 */
export function SettingsView() {
  const session = useAppStore((s) => s.session);
  const refreshSession = useAppStore((s) => s.refreshSession);
  const logout = useAppStore((s) => s.logout);
  const setView = useAppStore((s) => s.setView);
  const config = useAppStore((s) => s.config);
  const [version, setVersion] = useState<string>('');

  useEffect(() => {
    void window.muicv.app.getVersion().then(setVersion);
  }, []);

  if (!session) return null;

  const isBYOK = !!(config.customLlmBase && config.customLlmKey);

  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col gap-4 overflow-y-auto px-6 py-10">
      <button
        type="button"
        onClick={() => setView('chat')}
        title="返回对话"
        className="-mb-2 inline-flex w-fit items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] font-medium text-ink-soft hover:bg-fluff hover:text-ink"
      >
        <ArrowLeftIcon size={13} weight="bold" />
        <span>返回</span>
      </button>

      <header className="flex items-center justify-between gap-3 rounded-2xl border-2 border-ink bg-cream p-5 shadow-[0_4px_0_0_var(--color-ink)]">
        <div className="flex items-center gap-3">
          <Avatar session={session} />
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-yellow-deep">已登录</p>
            <p className="text-[15px] font-extrabold text-ink">{session.name}</p>
            <p className="text-[12px] text-mute">{session.email}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className="rounded-lg border-2 border-rule-strong bg-cream px-3 py-1 text-[12px] font-medium text-tongue hover:bg-tongue/10"
        >
          退出登录
        </button>
      </header>

      <PlanCard plan={session.plan} balance={session.balance} onRefresh={refreshSession} />

      <ModelCard isBYOK={isBYOK} currentModel={config.defaultModel} />

      <MuirouterCard hasBYOK={session.hasBYOK} muirouter={session.muirouter} onRefresh={refreshSession} />

      <CustomLlmCard />

      <footer className="flex items-center gap-2 text-[11px] text-mute">
        <CorgiMascot className="h-5 w-5" />
        <span>所有设置只存本地（macOS Keychain 加密），不上传服务器。</span>
        {version && <span className="ml-auto font-mono text-[10px] tabular-nums text-mute">v{version}</span>}
      </footer>
    </div>
  );
}
