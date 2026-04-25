import { useEffect, useState } from 'react';

import { useAppStore } from '../lib/store';
import { CorgiMascot } from './corgi-mascot';

const DASHBOARD_URL = 'https://muicv.com/dashboard';

const PLAN_LABEL: Record<string, string> = {
  free: 'Free',
  pro: 'Pro',
  max: 'Max',
};

/**
 * 登录后的"账号控制台"。
 *
 * 几件事：
 *   1. 账号信息 + 退出登录
 *   2. 订阅档位状态 → 升级到 dashboard
 *   3. BYOK 状态 → 绑定 / 解绑 / 切换都在 dashboard
 *   4. 工作目录（可换）
 *   5. 高级（默认模型 / API base）
 *   6. 刷新账号状态（用户在 dashboard 改完档位 / BYOK 回到 app 后点一下立刻同步）
 *
 * 桌面端**不**直接管订阅 / BYOK 绑定本身——这些都在网页 dashboard 完成。
 * 这里只负责显示状态 + 链接过去 + 触发 refresh。
 */
export function SettingsView() {
  const session = useAppStore((s) => s.session);
  const cfg = useAppStore((s) => s.config);
  const patch = useAppStore((s) => s.patchConfig);
  const selectWorkspace = useAppStore((s) => s.selectWorkspace);
  const refreshSession = useAppStore((s) => s.refreshSession);
  const logout = useAppStore((s) => s.logout);

  const [defaultModel, setDefaultModel] = useState(cfg.defaultModel);
  const [muicvApiBase, setApiBase] = useState(cfg.muicvApiBase);
  const [refreshing, setRefreshing] = useState(false);
  const [savedAdvanced, setSavedAdvanced] = useState(false);

  // session / config 变化时同步 form
  useEffect(() => {
    setDefaultModel(cfg.defaultModel);
    setApiBase(cfg.muicvApiBase);
  }, [cfg.defaultModel, cfg.muicvApiBase]);

  if (!session) return null;

  async function onRefresh() {
    setRefreshing(true);
    try {
      await refreshSession();
    } finally {
      setRefreshing(false);
    }
  }

  async function onSaveAdvanced() {
    await patch({
      defaultModel: defaultModel.trim() || 'gpt-4o-mini',
      muicvApiBase: muicvApiBase.trim() || 'https://api.muicv.com',
    });
    setSavedAdvanced(true);
    setTimeout(() => setSavedAdvanced(false), 1500);
  }

  const planLabel = PLAN_LABEL[session.plan] ?? session.plan;

  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col gap-6 overflow-y-auto px-6 py-10">
      <header className="flex items-center justify-between gap-3 rounded-2xl border-2 border-ink bg-cream p-5 shadow-[0_4px_0_0_var(--color-ink)]">
        <div className="flex items-center gap-3">
          <Avatar session={session} />
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-yellow-deep">
              已登录
            </p>
            <p className="text-[15px] font-extrabold text-ink">{session.name}</p>
            <p className="text-[12px] text-mute">{session.email}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={() => void onRefresh()}
            disabled={refreshing}
            className="rounded-lg border-2 border-ink bg-cream px-3 py-1 text-[12px] font-bold text-ink hover:bg-fluff disabled:opacity-60"
            title="同步账号状态（订阅档位 / BYOK 等）"
          >
            {refreshing ? '同步中…' : '↻ 同步'}
          </button>
          <button
            type="button"
            onClick={() => void logout()}
            className="text-[12px] font-medium text-tongue hover:underline"
          >
            退出登录
          </button>
        </div>
      </header>

      {/* 订阅档位 */}
      <Card
        eyebrow="订阅档位"
        title={
          <>
            当前：<span className="rounded-md bg-fluff px-2 py-0.5">{planLabel}</span>
          </>
        }
        hint={
          session.plan === 'free'
            ? 'M4 起开放升级 Pro / Max。Pro 解锁 PDF 导出、招聘库、辅助投递。'
            : session.plan === 'pro'
              ? '已是 Pro。需要无限制？升级 Max。'
              : '已是 Max，无功能限制。'
        }
        action={
          <ExternalButton href={`${DASHBOARD_URL}#plans`} label="在 dashboard 看档位 →" />
        }
      />

      {/* BYOK */}
      <Card
        eyebrow="muirouter (BYOK)"
        title={
          session.hasBYOK ? (
            <>
              <span className="text-yellow-deep">✓ 已绑定</span>
              <span className="ml-2 text-[13px] font-medium text-ink-soft">LLM 走你自己 muirouter 余额</span>
            </>
          ) : (
            <>
              <span className="text-mute">未绑定</span>
              <span className="ml-2 text-[13px] font-medium text-ink-soft">{session.plan === 'free' ? 'LLM 调不通' : '可选，省平台 token'}</span>
            </>
          )
        }
        hint={
          session.hasBYOK
            ? '想换一个 muirouter 账号 / 解绑：去 dashboard "muirouter 余额"section。'
            : '在 muirouter.com 充值后把 sk-gw key 绑到 dashboard。Free 档目前必须 BYOK 才能跑 LLM。'
        }
        action={
          <div className="flex flex-wrap gap-2">
            <ExternalButton
              href={`${DASHBOARD_URL}#muirouter`}
              label={session.hasBYOK ? '管理 BYOK →' : '去绑定 →'}
              primary={!session.hasBYOK}
            />
            <button
              type="button"
              onClick={() => void onRefresh()}
              disabled={refreshing}
              className="rounded-lg border-2 border-rule-strong bg-cream px-3.5 py-1.5 text-[12.5px] font-bold text-ink-soft hover:bg-fluff hover:text-ink disabled:opacity-60"
            >
              我刚改了，刷新
            </button>
          </div>
        }
      />

      {/* 工作目录 */}
      <Card
        eyebrow="工作目录"
        title={
          cfg.workspaceDir ? (
            <code className="break-all font-mono text-[12.5px] font-medium text-ink-soft">{cfg.workspaceDir}</code>
          ) : (
            <span className="text-mute">(未选)</span>
          )
        }
        hint="所有简历素材会存在该目录下的 .claude/muicv/ 里，由你用 git 自己管。换目录不会自动迁移已有素材。"
        action={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={selectWorkspace}
              className="press-ink rounded-lg border-2 border-ink bg-cream px-3.5 py-1.5 text-[12.5px] font-bold text-ink"
            >
              {cfg.workspaceDir ? '换一个' : '选目录'}
            </button>
            {cfg.workspaceDir && (
              <button
                type="button"
                onClick={() => void window.muicv.shell.openWorkspace()}
                className="rounded-lg border-2 border-rule-strong bg-cream px-3.5 py-1.5 text-[12.5px] font-bold text-ink-soft hover:bg-fluff hover:text-ink"
              >
                在 Finder 打开
              </button>
            )}
          </div>
        }
      />

      <details className="rounded-2xl border-2 border-rule bg-paper">
        <summary className="cursor-pointer px-5 py-3 text-[13px] font-bold text-ink-soft">
          高级 · 模型 / 端点
        </summary>
        <div className="space-y-4 border-t border-rule px-5 py-4">
          <Field
            label="默认模型"
            hint="OpenAI 兼容 model id；具体哪些可用看你 muirouter 账号支持的清单（dashboard 可查）"
            value={defaultModel}
            onChange={setDefaultModel}
            placeholder="gpt-4o-mini"
            mono
          />
          <Field
            label="muicv API base URL"
            hint="一般不用改；本地 dev wrangler 时指向 http://localhost:8787"
            value={muicvApiBase}
            onChange={setApiBase}
            placeholder="https://api.muicv.com"
            mono
          />
          <button
            type="button"
            onClick={() => void onSaveAdvanced()}
            className="press inline-flex items-center justify-center rounded-lg bg-yellow px-4 py-2 text-[13px] font-bold text-ink"
          >
            {savedAdvanced ? '✓ 已保存' : '保存高级设置'}
          </button>
        </div>
      </details>

      <footer className="flex items-center gap-2 text-[11px] text-mute">
        <CorgiMascot className="h-5 w-5" />
        <span>所有设置只存本地（macOS Keychain 加密），不上传服务器。</span>
      </footer>
    </div>
  );
}

function Card({
  eyebrow,
  title,
  hint,
  action,
}: {
  eyebrow: string;
  title: React.ReactNode;
  hint?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border-2 border-ink bg-cream p-5 shadow-[0_4px_0_0_var(--color-ink)]">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-yellow-deep">{eyebrow}</p>
      <div className="mt-2 text-[15px] font-bold text-ink">{title}</div>
      {hint && <p className="mt-1.5 text-[12.5px] leading-[1.6] text-mute">{hint}</p>}
      {action && <div className="mt-3.5">{action}</div>}
    </section>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
  placeholder,
  mono,
}: {
  label: string;
  hint?: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-[13px] font-bold text-ink">{label}</span>
      {hint && <span className="mt-0.5 block text-[11.5px] text-mute">{hint}</span>}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        className={`mt-1.5 block w-full rounded-lg border-2 border-rule-strong bg-cream px-3.5 py-2.5 text-[14px] text-ink placeholder:text-mute focus:border-ink focus:bg-fluff focus:outline-none focus:ring-4 focus:ring-yellow/40 ${mono ? 'font-mono text-[13px]' : ''}`}
      />
    </label>
  );
}

function Avatar({ session }: { session: { name: string; image: string | null } }) {
  if (session.image) {
    return (
      <img
        src={session.image}
        alt=""
        className="h-12 w-12 rounded-full border-2 border-ink object-cover"
      />
    );
  }
  const initial = session.name?.[0]?.toUpperCase() || 'M';
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-ink bg-yellow font-display text-xl font-extrabold text-ink">
      {initial}
    </div>
  );
}

function ExternalButton({
  href,
  label,
  primary,
}: {
  href: string;
  label: string;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => void window.muicv.shell.openExternal(href)}
      className={
        primary
          ? 'press inline-flex items-center justify-center gap-1.5 rounded-lg bg-yellow px-3.5 py-1.5 text-[12.5px] font-bold text-ink'
          : 'rounded-lg border-2 border-rule-strong bg-cream px-3.5 py-1.5 text-[12.5px] font-bold text-ink hover:bg-fluff'
      }
    >
      {label}
    </button>
  );
}
