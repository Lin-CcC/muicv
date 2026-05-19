'use client';

import type { Currency } from '@muicv/shared';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

/**
 * 展示币种 toggle —— ¥ CN / $ USD 二选一。
 *
 * 受控显示，当前选中币种由 server component 通过 `currency` prop 传入（来自 `getRequestCurrency`）。
 * 点击非当前币种时：POST /api/billing/currency 写 cookie，然后 router.refresh() 让 server
 * component 用新币种重新渲染对应的价格 / Checkout 流。
 *
 * 不在前端持有本地状态，避免和 cookie / SSR 结果不同步。
 */
export function CurrencyToggle({ currency }: { currency: Currency }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [requesting, setRequesting] = useState<Currency | null>(null);

  function switchTo(next: Currency) {
    if (next === currency || requesting !== null) return;
    setRequesting(next);
    fetch('/api/billing/currency', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ currency: next }),
    })
      .then((res) => res.json().catch(() => ({})))
      .then(() => {
        startTransition(() => router.refresh());
      })
      .finally(() => setRequesting(null));
  }

  return (
    <div className="inline-flex items-center gap-2 text-[12px]">
      <span className="font-mono uppercase tracking-wider text-mute">币种</span>
      <div className="inline-flex rounded-lg border-2 border-rule bg-paper p-0.5 font-bold">
        <button
          type="button"
          disabled={requesting !== null || pending}
          onClick={() => switchTo('cny')}
          className={`rounded-md px-2 py-1 disabled:opacity-50 ${
            currency === 'cny'
              ? 'bg-yellow text-ink shadow-[0_2px_0_0_var(--color-yellow-shadow)]'
              : 'text-ink-soft hover:text-ink'
          }`}
        >
          ¥ CN
        </button>
        <button
          type="button"
          disabled={requesting !== null || pending}
          onClick={() => switchTo('usd')}
          className={`rounded-md px-2 py-1 disabled:opacity-50 ${
            currency === 'usd'
              ? 'bg-yellow text-ink shadow-[0_2px_0_0_var(--color-yellow-shadow)]'
              : 'text-ink-soft hover:text-ink'
          }`}
        >
          $ USD
        </button>
      </div>
    </div>
  );
}
