import { useState } from 'react';

import { useAppStore } from '../lib/store';
import { CorgiMascot } from './corgi-mascot';

const DASHBOARD_URL = 'https://muicv.com/dashboard';

/**
 * 第一屏：登录 muicv 账号。
 *
 * 没有 OAuth flow（v1）：用户在 dashboard 网页登录后复制 mui_ key 粘进来，
 * app 调 /me 验证。验证通过即"登录成功"，view 自动切到 onboarding（如果
 * 还没选工作目录）或 chat。
 *
 * 这一步本质是 paste-as-login，但 UI 包装成"两步登录"流程。完整 OAuth
 * device flow 留 v2。
 */
export function LoginView() {
  const setSession = useAppStore((s) => s.setSession);
  const setView = useAppStore((s) => s.setView);
  const apiBase = useAppStore((s) => s.config.muicvApiBase);

  const [step, setStep] = useState<'intro' | 'paste'>('intro');
  const [keyInput, setKeyInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openDashboard() {
    void window.muicv.shell.openExternal(`${DASHBOARD_URL}?from=app`);
    setStep('paste');
    setError(null);
  }

  async function onLogin() {
    const candidate = keyInput.trim();
    if (!candidate) return;
    setError(null);
    setBusy(true);
    try {
      const result = await window.muicv.session.login(candidate);
      if (result.status === 'ok') {
        setSession(result.session);
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
        {step === 'intro' && (
          <div className="rounded-3xl border-2 border-ink bg-cream p-8 shadow-[0_5px_0_0_var(--color-ink)]">
            <CorgiMascot className="mx-auto h-20 w-20" />
            <h1 className="mt-5 text-center text-3xl font-extrabold tracking-tight text-ink">
              欢迎来到 Mui简历
            </h1>
            <p className="mt-3 text-center text-[14px] leading-[1.65] text-ink-soft">
              登录你的 muicv 账号，开始简历工作流。
              <br />
              没账号？去网页注册一个，整个过程 1 分钟。
            </p>

            <button
              type="button"
              onClick={openDashboard}
              className="press mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-yellow px-5 py-3 text-[15px] font-bold text-ink"
            >
              打开 muicv.com 登录
              <ArrowOut />
            </button>

            <p className="mt-3 text-center text-[12px] text-mute">
              已经登录过？
              <button
                type="button"
                onClick={() => setStep('paste')}
                className="ml-1 font-semibold text-yellow-deep underline decoration-corgi decoration-2 underline-offset-4 hover:decoration-yellow"
              >
                直接粘贴 API key
              </button>
            </p>

            <div className="mt-6 rounded-xl border border-rule bg-paper p-3 text-[12px] leading-[1.6] text-mute">
              <strong className="text-ink-soft">桌面端为什么需要登录？</strong>
              <p className="mt-1">
                muicv 后端按账号管理订阅档位（Free/Pro/Max）、平台 token 配额、
                muirouter BYOK 路由。所有 LLM 调用都过 muicv 中转，由你的账号决定能用多少、走谁的余额。
              </p>
            </div>
          </div>
        )}

        {step === 'paste' && (
          <div className="rounded-3xl border-2 border-ink bg-cream p-8 shadow-[0_5px_0_0_var(--color-ink)]">
            <div className="flex items-start gap-3">
              <CorgiMascot className="h-12 w-12 shrink-0" />
              <div>
                <h1 className="text-[22px] font-extrabold tracking-tight text-ink">
                  粘贴你的 API key
                </h1>
                <p className="mt-1.5 text-[13px] leading-[1.65] text-ink-soft">
                  在网页 dashboard → "API Keys" 生成一个，复制 <code className="font-mono text-[12px]">mui_...</code> 粘到下面。
                </p>
              </div>
            </div>

            <ol className="mt-5 space-y-2 rounded-xl border border-rule bg-paper p-4 text-[12.5px] leading-[1.65] text-ink-soft">
              <li>
                <span className="font-bold text-ink">1.</span> 在浏览器登录{' '}
                <button
                  type="button"
                  onClick={() => void window.muicv.shell.openExternal(DASHBOARD_URL)}
                  className="font-semibold text-yellow-deep underline decoration-corgi decoration-2 underline-offset-4"
                >
                  muicv.com/dashboard
                </button>
              </li>
              <li>
                <span className="font-bold text-ink">2.</span> 找到"API Keys"section → 点"生成新 key" → <strong>立刻复制</strong>（仅显示一次）
              </li>
              <li>
                <span className="font-bold text-ink">3.</span> 回到这里粘贴并登录
              </li>
            </ol>

            <div className="mt-5 space-y-2">
              <input
                type="password"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !busy) void onLogin();
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
                onClick={() => void onLogin()}
                disabled={busy || !keyInput.trim()}
                className="press inline-flex w-full items-center justify-center gap-2 rounded-lg bg-yellow px-4 py-2.5 text-[14px] font-bold text-ink disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? '验证中…' : '登录'}
              </button>

              <button
                type="button"
                onClick={() => setStep('intro')}
                className="block w-full text-center text-[12px] text-mute hover:text-ink"
              >
                ← 返回
              </button>
            </div>

            <p className="mt-5 text-center text-[11px] text-mute">
              连接的 API: <code className="font-mono">{apiBase}</code>
              <br />
              想改？登录后去设置页调整。
            </p>
          </div>
        )}
      </div>
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
