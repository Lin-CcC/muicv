import { useEffect, useState } from 'react';

import { useAppStore } from '../lib/store';
import { CorgiMascot } from './corgi-mascot';

/**
 * 第一屏：登录 muicv 账号。
 *
 * 主流程是 **OAuth-style 自动登录**：
 *   1. 点"用 muicv 账号登录" → IPC 'session:beginConnect' → main 打开浏览器到 /connect
 *   2. 用户在网页授权 → 浏览器 muicv://callback 唤起 app
 *   3. main 验 state + 用 key 调 /me → 推 'session:autoLogin' 给 renderer
 *   4. store 在 onAutoLogin 里 setSession → router 自动切到 onboarding/chat
 *
 * 兜底：手动粘贴 mui_ key（适合开发 / 自部署 / 出问题时）。
 */
export function LoginView() {
  const setSession = useAppStore((s) => s.setSession);

  const [step, setStep] = useState<'oauth' | 'paste'>('oauth');
  const [busy, setBusy] = useState(false);
  const [waitingCallback, setWaitingCallback] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // OAuth 等待中订阅 auto-login 事件（成功 / 失败都会清 waitingCallback）
  useEffect(() => {
    const off = window.muicv.session.onAutoLogin((result) => {
      setWaitingCallback(false);
      if (result.status === 'ok') {
        // store 那边会处理 setSession；这里不重复
        setError(null);
      } else if (result.status === 'invalid-key') {
        setError(result.message || 'API key 无效');
      } else if (result.status === 'network-error') {
        setError(`网络错：${result.message}`);
      }
    });
    return off;
  }, []);

  async function onBeginConnect() {
    setError(null);
    setBusy(true);
    try {
      const result = await window.muicv.session.beginConnect();
      if (!result.ok) {
        setError(result.message || '打开浏览器失败');
      } else {
        setWaitingCallback(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '出错了');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden px-6 py-10">
      {/* 阳光底纹 */}
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        aria-hidden
        style={{
          background:
            'radial-gradient(ellipse 70% 60% at 50% -20%, oklch(0.86 0.13 85 / 0.45) 0%, oklch(0.96 0.05 88 / 0.35) 35%, transparent 75%)',
        }}
      />

      <div className="relative z-10 w-full max-w-md">
        {step === 'oauth' && (
          <div className="rounded-3xl border-2 border-ink bg-cream p-8 shadow-[0_5px_0_0_var(--color-ink)]">
            <CorgiMascot className="mx-auto h-20 w-20" />
            <h1 className="mt-5 text-center text-3xl font-extrabold tracking-tight text-ink">欢迎来到 Mui简历</h1>
            <p className="mt-3 text-center text-[14px] leading-[1.65] text-ink-soft">
              用 muicv 账号登录，开始简历工作流。
            </p>

            {!waitingCallback ? (
              <>
                <button
                  type="button"
                  onClick={() => void onBeginConnect()}
                  disabled={busy}
                  className="press mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-yellow px-5 py-3 text-[15px] font-bold text-ink disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy ? '准备中…' : '登录'}
                  <ArrowOut />
                </button>
                <p className="mt-3 text-center text-[12px] text-mute">会在浏览器里登录，完成后自动回到这里</p>
              </>
            ) : (
              <div className="mt-7 space-y-3 rounded-xl border-2 border-ink bg-fluff p-5 text-center">
                <div className="inline-flex items-center gap-2.5 text-[14px] font-bold text-ink">
                  <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-yellow-deep" />
                  在浏览器里完成登录…
                </div>
                <p className="text-[12.5px] leading-[1.6] text-ink-soft">登录完成后浏览器会自动回到这个 app。</p>
                <div className="flex items-center justify-center gap-3 text-[12px]">
                  <button type="button" onClick={() => setWaitingCallback(false)} className="text-mute hover:text-ink">
                    取消
                  </button>
                  <span className="text-mute">·</span>
                  <button
                    type="button"
                    onClick={() => {
                      setWaitingCallback(false);
                      setStep('paste');
                    }}
                    title="高级：直接用一段 API key 登录"
                    className="text-mute hover:text-ink"
                  >
                    卡住了？
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="mt-4 rounded-lg border-2 border-tongue/60 bg-tongue/10 px-3 py-2 text-[12.5px] font-medium text-tongue"
              >
                {error}
              </div>
            )}
          </div>
        )}

        {/*
          paste 模式仅作为 OAuth 唤起失败时的兜底（在 waitingCallback 状态里露出入口），
          不在主登录界面暴露给普通用户 —— API key 是底层凭证，不该是用户日常感知的概念。
        */}
        {step === 'paste' && <PasteFallback onBack={() => setStep('oauth')} onLogin={setSession} />}
      </div>
    </div>
  );
}

function PasteFallback({
  onBack,
  onLogin,
}: {
  onBack: () => void;
  onLogin: (session: import('../../shared/types.ts').SessionInfo) => void;
}) {
  const apiBase = useAppStore((s) => s.config.muicvApiBase);
  const [keyInput, setKeyInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onLoginClick() {
    const candidate = keyInput.trim();
    if (!candidate) return;
    setError(null);
    setBusy(true);
    try {
      const result = await window.muicv.session.login(candidate);
      if (result.status === 'ok') {
        onLogin(result.session);
      } else if (result.status === 'invalid-key') {
        setError(result.message || 'API key 无效');
      } else if (result.status === 'network-error') {
        setError(`网络错：${result.message}`);
      } else {
        setError('未知状态');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-3xl border-2 border-ink bg-cream p-8 shadow-[0_5px_0_0_var(--color-ink)]">
      <div className="flex items-start gap-3">
        <CorgiMascot className="h-12 w-12 shrink-0" />
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-ink">手动粘贴 API key</h1>
          <p className="mt-1.5 text-[13px] leading-[1.65] text-ink-soft">
            在 dashboard → "API Keys" 生成一个，复制 <code className="font-mono text-[12px]">mui_...</code>{' '}
            粘到下面。一般情况推荐用上一步的浏览器授权。
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-2">
        <input
          type="password"
          value={keyInput}
          onChange={(e) => setKeyInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !busy) void onLoginClick();
          }}
          disabled={busy}
          placeholder="mui_…"
          spellCheck={false}
          autoComplete="off"
          className="block w-full rounded-lg border-2 border-rule-strong bg-cream px-3.5 py-2.5 font-mono text-[13px] text-ink placeholder:text-mute focus:border-ink focus:bg-fluff focus:outline-none focus:ring-4 focus:ring-yellow/40 disabled:opacity-60"
        />

        {error && (
          <div
            role="alert"
            className="rounded-lg border-2 border-tongue/60 bg-tongue/10 px-3 py-2 text-[12.5px] font-medium text-tongue"
          >
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={() => void onLoginClick()}
          disabled={busy || !keyInput.trim()}
          className="press inline-flex w-full items-center justify-center gap-2 rounded-lg bg-yellow px-4 py-2.5 text-[14px] font-bold text-ink disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? '验证中…' : '登录'}
        </button>

        <button
          type="button"
          onClick={onBack}
          className="block w-full text-center text-[12px] text-mute hover:text-ink"
        >
          ← 用浏览器登录
        </button>
      </div>

      <p className="mt-5 text-center text-[11px] text-mute">
        连接的 API: <code className="font-mono">{apiBase}</code>
      </p>
    </div>
  );
}

function ArrowOut() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path
        d="M7 17L17 7M17 7H8M17 7v9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
