'use client';

import type { CnPackKey } from '@muicv/shared';
import { useState } from 'react';

/**
 * CN 月包/年包购买按钮（取代 BuyButton kind='subscription' 在 CN 视图下的角色）。
 *
 * 受控渲染：cooldownEnd 非 null 时 disabled + 显示「下次可购买：YYYY-MM-DD」；
 * 否则点击 POST /api/cn-pack → 跳 Stripe hosted Checkout。
 *
 * 不在前端做 cooldown 判断的最终结论 —— server /api/cn-pack 再查一次（防 stale state）。
 * 这里的 cooldownEnd 来自 server 端 `getCnPackCooldownEnd`，给 UI 即时反馈用。
 */
export function CnPackButton({
  pack,
  label,
  cooldownEnd,
  primary,
}: {
  pack: CnPackKey;
  label: string;
  cooldownEnd: Date | null;
  primary?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locked = cooldownEnd && cooldownEnd > new Date();
  const lockedLabel = locked ? `下次可购买：${cooldownEnd.toLocaleDateString('zh-CN')}` : null;

  async function handleClick() {
    if (locked || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/cn-pack', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pack }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string; message?: string };
      if (!res.ok || !data.url) {
        setError(data.message || data.error || `请求失败（${res.status}）`);
        setBusy(false);
        return;
      }
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : '网络错误');
      setBusy(false);
    }
  }

  const className = primary
    ? 'press inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-yellow px-4 py-2.5 text-[14px] font-bold text-ink disabled:opacity-50'
    : 'press-ink inline-flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-ink bg-cream px-4 py-2.5 text-[14px] font-bold text-ink disabled:opacity-50';

  return (
    <div className="mt-6 flex w-full flex-col gap-2">
      <button type="button" disabled={busy || !!locked} onClick={handleClick} className={className}>
        {busy ? '跳转中…' : lockedLabel || label}
      </button>
      {error && <p className="text-center text-[12px] leading-tight text-amber">{error}</p>}
    </div>
  );
}
