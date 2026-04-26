'use client';

import { useState } from 'react';

/**
 * 客户端：点"授权"调 POST /api/connect/approve 拿回跳 URL，用 location.href 触发
 * muicv:// scheme，让 OS 唤起 electron app。同时给一个"复制 key 手动粘贴"的 fallback。
 */
export function ApproveForm({ state, redirect, appName }: { state: string; redirect: string; appName: string }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ key: string; redirectUrl: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onApprove() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/connect/approve', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ state, redirect, name: `桌面端 ${appName}` }),
      });
      const data = (await res.json()) as { redirectUrl: string; key: string } | { error: string; detail?: string };
      if (!res.ok || !('redirectUrl' in data)) {
        throw new Error('detail' in data && data.detail ? data.detail : 'error' in data ? data.error : '授权失败');
      }
      setDone({ key: data.key, redirectUrl: data.redirectUrl });
      // 主动触发 deep link
      window.location.href = data.redirectUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : '授权失败');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="mt-6 space-y-3">
        <div className="rounded-xl border-2 border-ink bg-fluff p-4 text-[13px] leading-[1.65] text-ink">
          <p className="font-bold">已授权 ✓</p>
          <p className="mt-1.5 text-ink-soft">
            浏览器应该已经唤起桌面 app 了。如果没有反应，再点一下下面的按钮，或者复制 key 手动粘到 app 里。
          </p>
        </div>
        <a
          href={done.redirectUrl}
          className="press inline-flex w-full items-center justify-center rounded-lg bg-yellow px-4 py-2.5 text-[14px] font-bold text-ink"
        >
          再次唤起桌面 app
        </a>
        <button
          type="button"
          onClick={() => void navigator.clipboard.writeText(done.key)}
          className="block w-full rounded-lg border-2 border-rule-strong bg-cream px-4 py-2 text-[13px] font-bold text-ink hover:bg-fluff"
        >
          复制 API key 手动粘贴
        </button>
        <p className="text-center font-mono text-[11px] text-mute">{previewKey(done.key)}</p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-3">
      {error && (
        <div
          role="alert"
          className="rounded-lg border-2 border-tongue/60 bg-tongue/10 px-3 py-2 text-[13px] font-medium text-tongue"
        >
          {error}
        </div>
      )}
      <button
        type="button"
        onClick={() => void onApprove()}
        disabled={busy}
        className="press inline-flex w-full items-center justify-center gap-2 rounded-lg bg-yellow px-4 py-2.5 text-[15px] font-bold text-ink disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? '生成 key 中…' : '授权并打开桌面 app 🐾'}
      </button>
      <button
        type="button"
        onClick={() => window.close()}
        className="block w-full text-center text-[12px] text-mute hover:text-ink"
      >
        取消
      </button>
    </div>
  );
}

function previewKey(key: string): string {
  if (key.length < 12) return '••••';
  return `${key.slice(0, 8)}…${key.slice(-4)}`;
}
