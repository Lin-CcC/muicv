'use client';

import { useEffect, useState } from 'react';

type Status = {
  linked: boolean;
  preview?: string;
  linkedAt?: string;
  currency?: string;
  balanceCents?: number;
  lifetimeToppedUpCents?: number | null;
  lifetimeSpentCents?: number | null;
  balanceUpdatedAt?: string;
  lastError?: string;
};

function formatCents(cents: number | null | undefined, currency = 'CNY'): string {
  if (typeof cents !== 'number') return '—';
  const symbol = currency === 'CNY' ? '¥' : currency === 'USD' ? '$' : `${currency} `;
  return `${symbol}${(cents / 100).toFixed(2)}`;
}

function formatDate(input: string | undefined): string {
  if (!input) return '—';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

export function MuirouterSection() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [showInput, setShowInput] = useState(false);

  async function load() {
    try {
      const res = await fetch('/api/muirouter');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as Status;
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/muirouter', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key: keyInput.trim() }),
      });
      const body = (await res.json()) as { error?: string; message?: string; balanceStatus?: string };
      if (!res.ok) {
        throw new Error(body.message ?? body.error ?? `HTTP ${res.status}`);
      }
      setKeyInput('');
      setShowInput(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '绑定失败');
    } finally {
      setBusy(false);
    }
  }

  async function onRefresh() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/muirouter/refresh', { method: 'POST' });
      const body = (await res.json()) as { status?: string; message?: string };
      if (!res.ok) {
        throw new Error(body.message ?? `HTTP ${res.status}`);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '刷新失败');
    } finally {
      setBusy(false);
    }
  }

  async function onUnlink() {
    if (!confirm('确定解绑 muirouter？skill / 桌面 app 会失去查余额能力。')) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/muirouter', { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '解绑失败');
    } finally {
      setBusy(false);
    }
  }

  if (status === null && !error) {
    return <PlaceholderCard>加载中…</PlaceholderCard>;
  }

  return (
    <section className="rounded-2xl border-2 border-ink bg-cream p-6 shadow-[0_4px_0_0_oklch(0.24_0.04_65)]">
      <header className="flex items-baseline justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-yellow-deep">
            — muirouter 余额
          </p>
          <h2 className="mt-2 text-[18px] font-extrabold text-ink">关联你的 muirouter 账号</h2>
          <p className="mt-1 text-[13px] text-ink-soft">
            把你在{' '}
            <a
              href="https://muirouter.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-yellow-deep underline decoration-corgi decoration-2 underline-offset-4 hover:decoration-yellow"
            >
              muirouter.com
            </a>{' '}
            的 API key（<code className="font-mono text-[12px]">sk-gw-…</code>）贴过来，dashboard 就能看到余额。Key 用 AES-GCM 加密存储，原文不明文留存。
            余额查询走 muirouter 的{' '}
            <a
              href="https://muirouter.com/mcp"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-corgi decoration-2 underline-offset-4 hover:text-yellow-deep"
            >
              MCP get_balance
            </a>{' '}
            工具。
          </p>
        </div>
      </header>

      {error && (
        <div role="alert" className="mt-4 rounded-lg border-2 border-tongue/60 bg-tongue/10 px-3 py-2 text-[13px] font-medium text-tongue">
          {error}
        </div>
      )}

      {/* 已绑定视图 */}
      {status?.linked && (
        <div className="mt-5 space-y-4">
          <div className="flex flex-col gap-4 rounded-xl border-2 border-corgi/60 bg-fluff p-5 sm:flex-row sm:items-center">
            <div className="flex-1">
              <div className="font-mono text-[11px] uppercase tracking-wider text-yellow-deep">余额</div>
              <div className="mt-1 font-display text-3xl font-extrabold text-ink tabular-nums">
                {formatCents(status.balanceCents, status.currency)}
              </div>
              <div className="mt-1 font-mono text-[11px] text-mute">
                上次更新：{formatDate(status.balanceUpdatedAt)}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-[12px] sm:grid-cols-1 sm:text-right">
              <Stat label="累计充值" value={formatCents(status.lifetimeToppedUpCents ?? null, status.currency)} />
              <Stat label="累计消费" value={formatCents(status.lifetimeSpentCents ?? null, status.currency)} />
            </div>
          </div>

          {status.lastError && (
            <div className="rounded-lg border-2 border-amber/70 bg-amber-soft px-3 py-2 text-[12.5px] text-yellow-deep">
              ⚠ 上次同步失败：{status.lastError}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-paper px-4 py-3">
            <div className="text-[13px]">
              <span className="font-bold text-ink">已绑定：</span>{' '}
              <code className="font-mono text-[12px] text-mute">{status.preview}</code>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onRefresh}
                disabled={busy}
                className="press inline-flex items-center justify-center gap-1.5 rounded-lg bg-yellow px-3 py-1.5 text-[12.5px] font-bold text-ink disabled:opacity-60"
              >
                {busy ? '同步中…' : '刷新余额'}
              </button>
              <button
                type="button"
                onClick={() => setShowInput(true)}
                disabled={busy}
                className="press-ink inline-flex items-center justify-center rounded-lg border-2 border-ink bg-cream px-3 py-1.5 text-[12.5px] font-bold text-ink disabled:opacity-60"
              >
                替换 key
              </button>
              <button
                type="button"
                onClick={onUnlink}
                disabled={busy}
                className="rounded-lg border-2 border-tongue/60 px-3 py-1.5 text-[12.5px] font-bold text-tongue transition hover:bg-tongue hover:text-cream disabled:opacity-60"
              >
                解绑
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 输入表单：未绑定时常驻；已绑定时点 "替换 key" 后弹出 */}
      {(!status?.linked || showInput) && (
        <form onSubmit={onLink} className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="block flex-1">
            <span className="block text-[12px] font-bold text-ink">muirouter API key</span>
            <input
              type="password"
              required
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              disabled={busy}
              placeholder="sk-gw-…"
              autoComplete="off"
              spellCheck={false}
              className="mt-1 block w-full rounded-lg border-2 border-rule-strong bg-cream px-3 py-2 font-mono text-[13px] text-ink placeholder:text-mute focus:border-ink focus:bg-fluff focus:outline-none focus:ring-4 focus:ring-yellow/40 disabled:opacity-60"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="press inline-flex items-center justify-center gap-1.5 rounded-lg bg-yellow px-4 py-2 text-[14px] font-bold text-ink disabled:opacity-60"
          >
            {busy ? '验证中…' : status?.linked ? '替换' : '绑定'}
          </button>
          {status?.linked && (
            <button
              type="button"
              onClick={() => {
                setShowInput(false);
                setKeyInput('');
                setError(null);
              }}
              className="rounded-lg px-3 py-2 text-[12.5px] font-medium text-mute hover:text-ink"
            >
              取消
            </button>
          )}
        </form>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-wider text-mute">{label}</div>
      <div className="mt-0.5 font-mono text-[13px] font-bold text-ink tabular-nums">{value}</div>
    </div>
  );
}

function PlaceholderCard({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border-2 border-rule bg-paper p-6 text-[13px] text-mute">
      {children}
    </section>
  );
}
