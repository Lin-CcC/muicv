'use client';

import { type SubscriptionPlanKey, type TopupPackKey, SUBSCRIPTION_PLANS, TOPUP_PACKS } from '@muicv/shared';
import { useState } from 'react';

/**
 * Stripe 跳转按钮的 client component。
 *
 * 三类操作：
 *   - 升级月卡：POST /api/checkout → location.href = url
 *   - 买补充包：POST /api/topup → location.href = url
 *   - 管理订阅：POST /api/billing/portal → Stripe Portal
 *
 * 都返回 hosted URL；无前端 Stripe SDK 依赖（省 80KB bundle）。
 */
export function BillingActions({ hasActiveSubscription }: { hasActiveSubscription: boolean }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function jumpTo(endpoint: string, body: unknown, busyKey: string) {
    setBusy(busyKey);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string; message?: string };
      if (!res.ok || !data.url) {
        setError(data.message || data.error || `请求失败（${res.status}）`);
        setBusy(null);
        return;
      }
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : '网络错误');
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-[15px] font-extrabold text-ink">月卡（每月自动续 token）</h3>
        <p className="mt-1 text-[12.5px] text-ink-soft">
          {hasActiveSubscription ? '已订阅；切换档位 / 取消请走"管理订阅"。' : '订阅后每月自动到账，不用记着手动充。'}
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {(['pro', 'max'] as SubscriptionPlanKey[]).map((key) => {
            const plan = SUBSCRIPTION_PLANS[key];
            return (
              <button
                key={key}
                type="button"
                disabled={busy !== null || hasActiveSubscription}
                onClick={() => jumpTo('/api/checkout', { plan: key }, `plan-${key}`)}
                className="press-ink flex items-center justify-between rounded-xl border-2 border-ink bg-cream px-4 py-3 text-left disabled:opacity-50"
              >
                <span>
                  <span className="block text-[14px] font-extrabold text-ink">{plan.label}</span>
                  <span className="block font-mono text-[11px] text-mute">
                    {plan.monthlyTokens.toLocaleString()} tokens / 月
                  </span>
                </span>
                <span className="font-mono text-[13px] font-bold tabular-nums text-yellow-deep">
                  {plan.priceCnyDisplay}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="text-[15px] font-extrabold text-ink">补充包（一次性买）</h3>
        <p className="mt-1 text-[12.5px] text-ink-soft">没订月卡也能用。买完立刻到账，永不过期。</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {(['small', 'medium', 'large'] as TopupPackKey[]).map((key) => {
            const pack = TOPUP_PACKS[key];
            return (
              <button
                key={key}
                type="button"
                disabled={busy !== null}
                onClick={() => jumpTo('/api/topup', { pack: key }, `topup-${key}`)}
                className="press-ink flex flex-col items-start gap-1 rounded-xl border-2 border-rule bg-cream px-4 py-3 text-left hover:border-corgi disabled:opacity-50"
              >
                <span className="font-mono text-[11px] uppercase tracking-wider text-mute">{key}</span>
                <span className="text-[15px] font-extrabold text-ink">{pack.tokens.toLocaleString()} tokens</span>
                <span className="font-mono text-[12px] tabular-nums text-yellow-deep">{pack.priceCnyDisplay}</span>
              </button>
            );
          })}
        </div>
      </div>

      {hasActiveSubscription && (
        <div>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => jumpTo('/api/billing/portal', {}, 'portal')}
            className="press inline-flex items-center gap-1.5 rounded-xl bg-yellow px-4 py-2 text-[13px] font-bold text-ink disabled:opacity-50"
          >
            {busy === 'portal' ? '跳转中…' : '管理订阅 / 看发票 / 切换档位'}
          </button>
        </div>
      )}

      {error && <div className="rounded-lg border border-amber bg-fluff px-3 py-2 text-[12.5px] text-ink">{error}</div>}
    </div>
  );
}
