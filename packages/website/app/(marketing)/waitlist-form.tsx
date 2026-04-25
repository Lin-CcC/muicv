'use client';

import { useState } from 'react';

type Status = 'idle' | 'loading' | 'success' | 'already' | 'error';

const API_BASE = process.env.NEXT_PUBLIC_MUICV_API_BASE ?? 'https://api.muicv.com';

export function WaitlistForm({ source }: { source: string }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('loading');
    setErrorMsg(null);

    try {
      const res = await fetch(`${API_BASE}/waitlist`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), source }),
      });

      if (res.status === 201) {
        setStatus('success');
        setEmail('');
        return;
      }
      if (res.status === 409) {
        setStatus('already');
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setStatus('error');
      setErrorMsg(body.error ?? `HTTP ${res.status}`);
    } catch (error) {
      setStatus('error');
      setErrorMsg(error instanceof Error ? error.message : '网络错误');
    }
  }

  if (status === 'success' || status === 'already') {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
        {status === 'success' ? <>✓ 收到了。产品就绪会第一时间通知你。</> : <>你已经在 waitlist 里了 — 等通知就好。</>}
      </div>
    );
  }

  const isLoading = status === 'loading';

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-md flex-col gap-2 sm:flex-row">
      <input
        type="email"
        required
        disabled={isLoading}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your@email.com"
        className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none disabled:opacity-60"
      />
      <button
        type="submit"
        disabled={isLoading}
        className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60"
      >
        {isLoading ? '提交中…' : '加入 Waitlist'}
      </button>
      {status === 'error' && (
        <p className="text-sm text-rose-600 sm:col-span-2">提交失败：{errorMsg ?? '请稍后重试'}</p>
      )}
    </form>
  );
}
