'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

type ActionType = 'wipe' | 'restore' | 'delete-history';

export function WipeButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    if (pending) return;
    if (!confirm('清空云端的活动版和全部历史快照？此操作不可逆，但本地文件不会受影响。')) return;
    start(async () => {
      setError(null);
      const res = await fetch('/api/resume/sync', { method: 'DELETE' });
      if (!res.ok) {
        setError(`清空失败：${res.status}`);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="rounded-xl border-2 border-ink bg-paper px-4 py-2 text-[13px] font-bold text-ink shadow-[0_3px_0_0_oklch(0.24_0.04_65)] transition active:translate-y-[2px] active:shadow-[0_1px_0_0_oklch(0.24_0.04_65)] disabled:opacity-60"
      >
        {pending ? '清空中…' : '清空云端'}
      </button>
      {error && <p className="mt-2 text-[12px] text-tongue">{error}</p>}
    </div>
  );
}

export function HistoryRowActions({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busyAction, setBusyAction] = useState<ActionType | null>(null);
  const [error, setError] = useState<string | null>(null);

  function call(action: ActionType, url: string, method: 'POST' | 'DELETE', confirmText: string) {
    if (pending) return;
    if (!confirm(confirmText)) return;
    setBusyAction(action);
    start(async () => {
      setError(null);
      const res = await fetch(url, { method });
      setBusyAction(null);
      if (!res.ok) {
        setError(`${action === 'restore' ? '恢复' : '删除'}失败：${res.status}`);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() =>
            call(
              'restore',
              `/api/resume/sync/history/${id}/restore`,
              'POST',
              '把这份历史快照恢复为活动版？当前活动版会被自动归档到历史。',
            )
          }
          disabled={pending}
          className="rounded-lg border border-ink bg-fluff px-2.5 py-1 text-[12px] font-bold text-ink transition hover:bg-corgi disabled:opacity-60"
        >
          {busyAction === 'restore' ? '恢复中…' : '恢复'}
        </button>
        <button
          type="button"
          onClick={() =>
            call('delete-history', `/api/resume/sync/history/${id}`, 'DELETE', '删除这份历史快照？此操作不可逆。')
          }
          disabled={pending}
          className="rounded-lg border border-rule bg-paper px-2.5 py-1 text-[12px] font-bold text-ink-soft transition hover:border-ink hover:text-ink disabled:opacity-60"
        >
          {busyAction === 'delete-history' ? '删除中…' : '删除'}
        </button>
      </div>
      {error && <p className="text-[11px] text-tongue">{error}</p>}
    </div>
  );
}
