import { useEffect, useState } from 'react';

import { useAppStore } from '../lib/store';
import { CorgiMascot } from './corgi-mascot';

const DASHBOARD_URL = 'https://muicv.com/dashboard';
const MUIROUTER_URL = 'https://muirouter.com';

const PLAN_LABEL: Record<string, string> = {
  free: '免费版',
  pro: 'Pro 会员',
  max: 'Max 会员',
};

/**
 * 登录后的"账号控制台"。简历管理在顶栏 dropdown 完成，这里只放：
 *
 *   1. 账号头部 + 退出登录
 *   2. 会员档位（含同步按钮——升级 / 充值是在网页 dashboard 做的，回 app 后点同步刷新状态）
 *   3. muirouter 介绍卡（广告式，引导去 muirouter 了解 + dashboard 绑定）
 *   4. "用我自己的模型和额度"（折叠，给高级用户配 endpoint / key / 模型 + muicv API base）
 */
export function SettingsView() {
  const session = useAppStore((s) => s.session);
  const refreshSession = useAppStore((s) => s.refreshSession);
  const logout = useAppStore((s) => s.logout);

  if (!session) return null;

  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col gap-6 overflow-y-auto px-6 py-10">
      <header className="flex items-center justify-between gap-3 rounded-2xl border-2 border-ink bg-cream p-5 shadow-[0_4px_0_0_var(--color-ink)]">
        <div className="flex items-center gap-3">
          <Avatar session={session} />
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-yellow-deep">已登录</p>
            <p className="text-[15px] font-extrabold text-ink">{session.name}</p>
            <p className="text-[12px] text-mute">{session.email}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className="rounded-lg border-2 border-rule-strong bg-cream px-3 py-1 text-[12px] font-medium text-tongue hover:bg-tongue/10"
        >
          退出登录
        </button>
      </header>

      <PlanCard plan={session.plan} onRefresh={refreshSession} />

      <MuirouterIntroCard hasBYOK={session.hasBYOK} />

      <CustomLlmCard />

      <footer className="flex items-center gap-2 text-[11px] text-mute">
        <CorgiMascot className="h-5 w-5" />
        <span>所有设置只存本地（macOS Keychain 加密），不上传服务器。</span>
      </footer>
    </div>
  );
}

// -------------------- 会员档位 --------------------

function PlanCard({ plan, onRefresh }: { plan: 'free' | 'pro' | 'max'; onRefresh: () => Promise<void> }) {
  const [refreshing, setRefreshing] = useState(false);
  const [justSynced, setJustSynced] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    setJustSynced(false);
    try {
      await onRefresh();
      setJustSynced(true);
      setTimeout(() => setJustSynced(false), 1800);
    } finally {
      setRefreshing(false);
    }
  }

  const planLabel = PLAN_LABEL[plan] ?? plan;
  const hint =
    plan === 'free'
      ? '免费版可以正常聊天和整理素材。升级 Pro 解锁 PDF 导出、招聘抓取、辅助投递等。'
      : plan === 'pro'
        ? '已是 Pro 会员。需要无限制？升级 Max。'
        : '已是 Max 会员，所有功能无限制。';

  return (
    <section className="rounded-2xl border-2 border-ink bg-cream p-5 shadow-[0_4px_0_0_var(--color-ink)]">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-yellow-deep">会员档位</p>
      <div className="mt-2 text-[15px] font-bold text-ink">
        当前：<span className="rounded-md bg-fluff px-2 py-0.5">{planLabel}</span>
      </div>
      <p className="mt-1.5 text-[12.5px] leading-[1.6] text-mute">{hint}</p>
      <div className="mt-3.5 flex flex-wrap items-center gap-2">
        <ExternalButton href={`${DASHBOARD_URL}#plans`} label="去看会员权益 →" primary={plan === 'free'} />
        <button
          type="button"
          onClick={() => void handleRefresh()}
          disabled={refreshing}
          title="在网页升级 / 充值后回来点这个，立刻同步"
          className="rounded-lg border-2 border-rule-strong bg-cream px-3.5 py-1.5 text-[12.5px] font-bold text-ink-soft hover:bg-fluff hover:text-ink disabled:opacity-60"
        >
          {refreshing ? '同步中…' : justSynced ? '✓ 已是最新' : '↻ 同步状态'}
        </button>
      </div>
    </section>
  );
}

// -------------------- muirouter 介绍 --------------------

function MuirouterIntroCard({ hasBYOK }: { hasBYOK: boolean }) {
  return (
    <section className="rounded-2xl border-2 border-rule bg-paper p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-fluff text-[16px]">💰</div>
        <div className="flex-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-yellow-deep">关于 muirouter</p>
          <h3 className="mt-1 text-[15px] font-bold text-ink">
            想用自己的 AI 余额？
            {hasBYOK && <span className="ml-2 text-[12px] font-medium text-yellow-deep">✓ 已绑定</span>}
          </h3>
          <p className="mt-1.5 text-[12.5px] leading-[1.65] text-ink-soft">
            muirouter 是一个独立的 AI 余额服务，类似话费充值。在它那边充一笔，可以用在所有支持 BYOK
            的服务里——muicv、其他 AI 工具都行，余额跨服务复用，更省、跑量更大。
            {hasBYOK ? '已经在 dashboard 绑定，AI 调用走你自己的余额。' : ''}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <ExternalButton href={MUIROUTER_URL} label="去 muirouter 看看" />
            <ExternalButton
              href={`${DASHBOARD_URL}#muirouter`}
              label={hasBYOK ? '管理绑定 →' : '在 dashboard 绑定 →'}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

// -------------------- 用我自己的模型和额度 --------------------

function CustomLlmCard() {
  const cfg = useAppStore((s) => s.config);
  const patch = useAppStore((s) => s.patchConfig);

  const [defaultModel, setDefaultModel] = useState(cfg.defaultModel);
  const [customLlmBase, setCustomLlmBase] = useState(cfg.customLlmBase ?? '');
  const [customLlmKey, setCustomLlmKey] = useState(cfg.customLlmKey ?? '');
  const [muicvApiBase, setMuicvApiBase] = useState(cfg.muicvApiBase);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDefaultModel(cfg.defaultModel);
    setCustomLlmBase(cfg.customLlmBase ?? '');
    setCustomLlmKey(cfg.customLlmKey ?? '');
    setMuicvApiBase(cfg.muicvApiBase);
  }, [cfg.defaultModel, cfg.customLlmBase, cfg.customLlmKey, cfg.muicvApiBase]);

  const customConfigured = !!(cfg.customLlmBase && cfg.customLlmKey);

  async function onSave() {
    await patch({
      defaultModel: defaultModel.trim() || 'gpt-4o-mini',
      customLlmBase: customLlmBase.trim() || null,
      customLlmKey: customLlmKey.trim() || null,
      muicvApiBase: muicvApiBase.trim() || 'https://api.muicv.com',
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  async function onClearCustom() {
    setCustomLlmBase('');
    setCustomLlmKey('');
    await patch({ customLlmBase: null, customLlmKey: null });
  }

  return (
    <details className="rounded-2xl border-2 border-rule bg-paper" open={customConfigured}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3.5">
        <div>
          <p className="text-[13px] font-bold text-ink-soft">用我自己的模型和额度</p>
          <p className="mt-0.5 text-[11.5px] text-mute">
            {customConfigured
              ? `✓ 当前直连 ${shortHost(cfg.customLlmBase ?? '')}（不走 muicv 平台）`
              : '默认走 muicv 平台调用 AI。普通用户不用动。'}
          </p>
        </div>
        <span className="text-[10px] text-mute">展开 ↓</span>
      </summary>

      <div className="space-y-4 border-t border-rule px-5 py-4">
        <p className="text-[12px] leading-[1.65] text-mute">
          有自己的 OpenAI 兼容 endpoint 和 API key？填在下面，AI 调用会直接打你配的端点，不再经过 muicv 平台。 支持任何
          OpenAI 兼容服务：OpenAI、muirouter、自部署的 ollama / vllm 等。
        </p>

        <Field
          label="API endpoint URL"
          hint="OpenAI 兼容的 base URL；留空 = 走 muicv 平台"
          value={customLlmBase}
          onChange={setCustomLlmBase}
          placeholder="https://api.openai.com/v1"
          mono
        />
        <Field
          label="API key"
          hint="跟上面那个 endpoint 配套；只存本地（Keychain 加密）"
          value={customLlmKey}
          onChange={setCustomLlmKey}
          placeholder="sk-... / 留空 = 不直连"
          mono
          password
        />
        <Field
          label="默认模型"
          hint="OpenAI 兼容的 model id，跟你 endpoint 支持的清单对齐"
          value={defaultModel}
          onChange={setDefaultModel}
          placeholder="gpt-4o-mini"
          mono
        />

        <details className="rounded-lg border border-rule bg-cream px-3 py-2">
          <summary className="cursor-pointer text-[11.5px] font-medium text-mute">高级 · muicv API base URL</summary>
          <div className="mt-2.5 space-y-2">
            <p className="text-[11px] text-mute">
              改错了 app 跑不起来。本地 dev wrangler 时指向 http://localhost:8787。
            </p>
            <Field label="" value={muicvApiBase} onChange={setMuicvApiBase} placeholder="https://api.muicv.com" mono />
          </div>
        </details>

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={() => void onSave()}
            className="press inline-flex items-center justify-center rounded-lg bg-yellow px-4 py-2 text-[13px] font-bold text-ink"
          >
            {saved ? '✓ 已保存' : '保存'}
          </button>
          {customConfigured && (
            <button
              type="button"
              onClick={() => void onClearCustom()}
              className="rounded-lg border-2 border-rule-strong bg-cream px-3.5 py-2 text-[12.5px] font-medium text-mute hover:text-ink"
            >
              清掉自带配置（恢复走 muicv 平台）
            </button>
          )}
        </div>
      </div>
    </details>
  );
}

// -------------------- 通用 --------------------

function Field({
  label,
  hint,
  value,
  onChange,
  placeholder,
  mono,
  password,
}: {
  label: string;
  hint?: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  password?: boolean;
}) {
  return (
    <label className="block">
      {label && <span className="block text-[13px] font-bold text-ink">{label}</span>}
      {hint && <span className="mt-0.5 block text-[11.5px] text-mute">{hint}</span>}
      <input
        type={password ? 'password' : 'text'}
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
    return <img src={session.image} alt="" className="h-12 w-12 rounded-full border-2 border-ink object-cover" />;
  }
  const initial = session.name?.[0]?.toUpperCase() || 'M';
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-ink bg-yellow font-display text-xl font-extrabold text-ink">
      {initial}
    </div>
  );
}

function ExternalButton({ href, label, primary }: { href: string; label: string; primary?: boolean }) {
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

function shortHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
