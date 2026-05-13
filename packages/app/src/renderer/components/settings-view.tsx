import { ArrowLeftIcon, ArrowsClockwiseIcon, WarningIcon } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';

import type { UpdaterStatus } from '../../shared/types.ts';
import { useAppStore } from '../lib/store';
import { CorgiMascot } from './corgi-mascot';
import { Avatar } from './settings/bits';
import { CustomLlmCard } from './settings/custom-llm-card';
import { ModelCard } from './settings/model-card';
import { MuirouterCard } from './settings/muirouter-card';
import { PlanCard } from './settings/plan-card';
import { WhisperEngineCard } from './settings/whisper-engine-card';

const LATEST_FEEDBACK_MS = 5_000;

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
  const updaterStatus = useAppStore((s) => s.updaterStatus);
  const setUpdaterStatus = useAppStore((s) => s.setUpdaterStatus);
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

      <WhisperEngineCard />

      <footer className="flex items-center gap-2 text-[11px] text-mute">
        <CorgiMascot className="h-5 w-5" />
        <span className="min-w-0 flex-1">所有设置只存本地（macOS Keychain 加密），不上传服务器。</span>
        <div className="flex shrink-0 items-center gap-2">
          {version && <span className="font-mono text-[10px] tabular-nums text-mute">v{version}</span>}
          <SettingsUpdateButton status={updaterStatus} setStatus={setUpdaterStatus} />
        </div>
      </footer>
    </div>
  );
}

function SettingsUpdateButton({
  status,
  setStatus,
}: {
  status: UpdaterStatus;
  setStatus: (status: UpdaterStatus) => void;
}) {
  const [latestHint, setLatestHint] = useState(false);
  const [manualCheckActive, setManualCheckActive] = useState(false);

  useEffect(() => {
    if (!latestHint) return;
    const timer = window.setTimeout(() => setLatestHint(false), LATEST_FEEDBACK_MS);
    return () => window.clearTimeout(timer);
  }, [latestHint]);

  useEffect(() => {
    if (!manualCheckActive) return;
    if (status.phase === 'idle' && status.latestVersion) {
      setLatestHint(true);
      setManualCheckActive(false);
    }
    if (status.phase === 'downloading' || status.phase === 'ready' || status.phase === 'error') {
      setManualCheckActive(false);
    }
  }, [manualCheckActive, status.latestVersion, status.phase]);

  async function handleCheck() {
    setLatestHint(false);
    setManualCheckActive(true);
    try {
      const next = await window.muicv.updater.checkNow();
      setStatus(next);
    } catch (err) {
      setManualCheckActive(false);
      setStatus({
        phase: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (status.skipped) return null;

  const isChecking = status.phase === 'checking' || manualCheckActive;
  const isBusy = isChecking || status.phase === 'downloading';
  const hasError = status.phase === 'error';
  const disabled = isBusy || status.phase === 'ready';

  return (
    <button
      type="button"
      onClick={() => void handleCheck()}
      disabled={disabled}
      className="inline-flex items-center gap-1 rounded-md border border-rule bg-cream px-2 py-1 text-[11px] font-semibold text-ink-soft transition hover:border-rule-strong hover:bg-fluff hover:text-ink disabled:cursor-default disabled:text-mute disabled:hover:border-rule disabled:hover:bg-cream disabled:hover:text-mute"
    >
      {hasError ? (
        <WarningIcon size={12} weight="bold" className="text-tongue" />
      ) : (
        <ArrowsClockwiseIcon size={12} weight="bold" className={isChecking ? 'animate-spin' : ''} />
      )}
      <span>{getUpdateButtonLabel(status, latestHint, isChecking)}</span>
    </button>
  );
}

function getUpdateButtonLabel(status: UpdaterStatus, latestHint: boolean, isChecking: boolean): string {
  if (isChecking) return '检查中';
  if (status.phase === 'downloading') return '下载更新';
  if (status.phase === 'ready') return '新版本已就绪';
  if (status.phase === 'error') return '重试更新';
  if (latestHint) return '已是最新版';
  return '检查更新';
}
