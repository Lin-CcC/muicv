import { ArrowClockwiseIcon, ArrowLeftIcon, CheckIcon, CpuIcon, WalletIcon } from '@phosphor-icons/react';
import { DEFAULT_LLM_MODEL, LLM_DISPLAY_META, SUPPORTED_LLM_MODELS } from '@muicv/shared';
import { useEffect, useState } from 'react';

import type { MuirouterInfo } from '../../shared/types';
import { useAppStore } from '../lib/store';
import { CorgiMascot } from './corgi-mascot';

const DASHBOARD_URL = 'https://muicv.com/dashboard';
const MUIROUTER_URL = 'https://muirouter.com';

function formatCents(cents: number | null | undefined, currency: string | null = 'CNY'): string {
  if (typeof cents !== 'number') return '—';
  const symbol = currency === 'CNY' ? '¥' : currency === 'USD' ? '$' : `${currency ?? ''} `;
  return `${symbol}${(cents / 100).toFixed(2)}`;
}

function formatTimestamp(ms: number | null | undefined): string {
  if (typeof ms !== 'number') return '—';
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

const PLAN_LABEL: Record<string, string> = {
  free: '免费版',
  pro: 'Pro 会员',
  max: 'Max 会员',
};

/**
 * 登录后的"账号控制台"。简历管理在顶栏 dropdown 完成，这里只放：
 *
 *   1. 账号头部（含返回按钮 + 退出登录）
 *   2. 会员档位 + token 余额（含同步按钮——升级 / 充值在网页 dashboard 做，回 app 点同步刷新）
 *   3. 模型选择卡（4 个平台模型 + 价格；BYOK 时降级为提示）
 *   4. muirouter 介绍卡（已绑显示余额；未绑引导去关联）
 *   5. "用我自己的模型和额度"（折叠，给高级用户配 endpoint / key / 模型 + muicv API base）
 *   6. footer 显示客户端版本号方便排查
 */
export function SettingsView() {
  const session = useAppStore((s) => s.session);
  const refreshSession = useAppStore((s) => s.refreshSession);
  const logout = useAppStore((s) => s.logout);
  const setView = useAppStore((s) => s.setView);
  const config = useAppStore((s) => s.config);
  const [version, setVersion] = useState<string>('');

  useEffect(() => {
    void window.muicv.app.getVersion().then(setVersion);
  }, []);

  if (!session) return null;

  const isBYOK = !!(config.customLlmBase && config.customLlmKey);

  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col gap-4 overflow-y-auto px-6 py-10">
      <button
        type="button"
        onClick={() => setView('chat')}
        title="返回对话"
        className="-mb-2 inline-flex w-fit items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] font-medium text-ink-soft hover:bg-fluff hover:text-ink"
      >
        <ArrowLeftIcon size={13} weight="bold" />
        <span>返回</span>
      </button>

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

      <PlanCard plan={session.plan} balance={session.balance} onRefresh={refreshSession} />

      <ModelCard isBYOK={isBYOK} currentModel={config.defaultModel} />

      <MuirouterCard hasBYOK={session.hasBYOK} muirouter={session.muirouter} onRefresh={refreshSession} />

      <CustomLlmCard />

      <footer className="flex items-center gap-2 text-[11px] text-mute">
        <CorgiMascot className="h-5 w-5" />
        <span>所有设置只存本地（macOS Keychain 加密），不上传服务器。</span>
        {version && <span className="ml-auto font-mono text-[10px] tabular-nums text-mute">v{version}</span>}
      </footer>
    </div>
  );
}

// -------------------- 会员档位 --------------------

function PlanCard({
  plan,
  balance,
  onRefresh,
}: {
  plan: 'free' | 'pro' | 'max' | undefined;
  balance: number;
  onRefresh: () => Promise<void>;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const [justSynced, setJustSynced] = useState(false);

  // server 漏返字段时兜底为免费版（不能像之前那样掉到 Max）。
  const safePlan: 'free' | 'pro' | 'max' = plan ?? 'free';

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

  const planLabel = PLAN_LABEL[safePlan] ?? safePlan;
  const hint =
    safePlan === 'free'
      ? '免费版可以正常聊天和整理素材。升级 Pro 解锁 PDF 导出、招聘抓取、辅助投递等。'
      : safePlan === 'pro'
        ? '已是 Pro 会员。需要无限制？升级 Max。'
        : '已是 Max 会员，所有功能无限制。';

  return (
    <section className="rounded-2xl border-2 border-ink bg-cream p-5 shadow-[0_4px_0_0_var(--color-ink)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-yellow-deep">会员档位</p>
          <div className="mt-2 text-[15px] font-bold text-ink">
            当前：<span className="rounded-md bg-fluff px-2 py-0.5">{planLabel}</span>
          </div>
        </div>
        <div className="shrink-0 rounded-xl border-2 border-rule-strong bg-paper px-3 py-2 text-right">
          <p className="font-mono text-[10px] uppercase tracking-wider text-mute">余额</p>
          <p className="mt-0.5 font-mono text-[15px] font-extrabold tabular-nums text-ink">{formatTokens(balance)}</p>
          <p className="text-[10px] text-mute">tokens</p>
        </div>
      </div>
      <p className="mt-2 text-[12.5px] leading-[1.6] text-mute">{hint}</p>
      <div className="mt-3.5 flex flex-wrap items-center gap-2">
        <ExternalButton href={`${DASHBOARD_URL}#plans`} label="去看会员权益 →" primary={safePlan === 'free'} />
        <ExternalButton href={`${DASHBOARD_URL}#wallet`} label="充值 →" />
        <button
          type="button"
          onClick={() => void handleRefresh()}
          disabled={refreshing}
          title="在网页升级 / 充值后回来点这个，立刻同步"
          className="inline-flex items-center gap-1.5 rounded-lg border-2 border-rule-strong bg-cream px-3.5 py-1.5 text-[12.5px] font-bold text-ink-soft hover:bg-fluff hover:text-ink disabled:opacity-60"
        >
          {refreshing ? (
            <span>同步中…</span>
          ) : justSynced ? (
            <>
              <CheckIcon size={12} weight="bold" />
              <span>已是最新</span>
            </>
          ) : (
            <>
              <ArrowClockwiseIcon size={12} weight="bold" />
              <span>同步状态</span>
            </>
          )}
        </button>
      </div>
    </section>
  );
}

function formatTokens(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (n >= 1) return Math.round(n).toLocaleString();
  return n.toFixed(2);
}

// -------------------- 模型选择 --------------------

function ModelCard({ isBYOK, currentModel }: { isBYOK: boolean; currentModel: string }) {
  const patch = useAppStore((s) => s.patchConfig);

  if (isBYOK) {
    return (
      <section className="rounded-2xl border-2 border-rule bg-paper p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-fluff text-yellow-deep">
            <CpuIcon size={18} weight="duotone" />
          </div>
          <div className="flex-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-yellow-deep">模型</p>
            <h3 className="mt-1 text-[14px] font-bold text-ink">正在用你自己的 endpoint</h3>
            <p className="mt-1 text-[12.5px] leading-[1.6] text-mute">
              已配置自带 OpenAI 兼容 endpoint，平台模型清单不生效。下方"用我自己的模型和额度"里改默认模型名。
            </p>
            <p className="mt-1.5 font-mono text-[12px] text-ink-soft">当前模型：{currentModel}</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border-2 border-ink bg-cream p-5 shadow-[0_4px_0_0_var(--color-ink)]">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-yellow-deep">模型</p>
      <h3 className="mt-1 text-[14px] font-bold text-ink">选默认模型</h3>
      <p className="mt-1 text-[12.5px] leading-[1.6] text-mute">
        所有对话用这个 model 调 LLM。token 价按上游差异不一样，按需切换；切了立刻生效。
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {SUPPORTED_LLM_MODELS.map((id) => {
          const meta = LLM_DISPLAY_META[id];
          if (!meta) return null;
          const selected = currentModel === id;
          return (
            <button
              type="button"
              key={id}
              onClick={() => void patch({ defaultModel: id })}
              className={`flex items-start gap-3 rounded-xl border-2 px-3.5 py-2.5 text-left transition ${
                selected
                  ? 'border-ink bg-fluff shadow-[0_3px_0_0_var(--color-ink)]'
                  : 'border-rule-strong bg-cream hover:bg-paper'
              }`}
            >
              <span
                className={`mt-1 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border-2 ${
                  selected ? 'border-ink bg-yellow' : 'border-rule-strong bg-cream'
                }`}
              >
                {selected && <span className="h-1.5 w-1.5 rounded-full bg-ink" />}
              </span>
              <span className="flex-1">
                <span className="flex flex-wrap items-baseline gap-1.5">
                  <span className="text-[13.5px] font-bold text-ink">{meta.label}</span>
                  {meta.isDefault && (
                    <span className="rounded-md bg-yellow px-1.5 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-wider text-ink">
                      默认
                    </span>
                  )}
                  <span className="font-mono text-[10px] uppercase tracking-wider text-mute">
                    {meta.vendor === 'openai' ? 'OpenAI' : 'Xiaomi'}
                  </span>
                  <span className="text-[11.5px] text-ink-soft">· {meta.hint}</span>
                </span>
                <span className="mt-1 block font-mono text-[11.5px] text-mute">
                  输入 {meta.inputPrice} · 输出 {meta.outputPrice}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// -------------------- muirouter --------------------

function MuirouterCard({
  hasBYOK,
  muirouter,
  onRefresh,
}: {
  hasBYOK: boolean;
  muirouter: MuirouterInfo | null;
  onRefresh: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onLink() {
    setError(null);
    setBusy(true);
    try {
      const res = await window.muicv.session.beginLinkMuirouter();
      if (!res.ok) setError(res.message ?? '打开浏览器失败');
    } finally {
      setBusy(false);
    }
  }

  if (hasBYOK && muirouter) {
    return (
      <section className="rounded-2xl border-2 border-corgi/60 bg-fluff p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cream text-yellow-deep">
            <WalletIcon size={18} weight="duotone" />
          </div>
          <div className="flex-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-yellow-deep">muirouter（已关联）</p>
            <h3 className="mt-1 text-[15px] font-bold text-ink">
              余额：<span className="tabular-nums">{formatCents(muirouter.balanceCents, muirouter.currency)}</span>
            </h3>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12px] text-ink-soft">
              <dt className="font-mono text-[10px] uppercase tracking-wider text-mute">账号</dt>
              <dd>{muirouter.email ?? '—'}</dd>
              <dt className="font-mono text-[10px] uppercase tracking-wider text-mute">默认模型</dt>
              <dd>{muirouter.defaultModel}</dd>
              <dt className="font-mono text-[10px] uppercase tracking-wider text-mute">余额更新</dt>
              <dd>{formatTimestamp(muirouter.balanceUpdatedAt)}</dd>
            </dl>
            <p className="mt-2 text-[12px] text-mute">
              muicv 平台余额优先；耗尽后自动走 muirouter。模型切换和详细管理在网页 dashboard。
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void onRefresh()}
                className="inline-flex items-center gap-1.5 rounded-lg border-2 border-rule-strong bg-cream px-3.5 py-1.5 text-[12.5px] font-bold text-ink-soft hover:bg-paper"
              >
                <ArrowClockwiseIcon size={12} weight="bold" />
                <span>同步状态</span>
              </button>
              <ExternalButton href={`${DASHBOARD_URL}/muirouter`} label="去 dashboard 管理 →" />
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border-2 border-rule bg-paper p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-fluff text-yellow-deep">
          <WalletIcon size={18} weight="duotone" />
        </div>
        <div className="flex-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-yellow-deep">关于 muirouter</p>
          <h3 className="mt-1 text-[15px] font-bold text-ink">muicv 余额耗尽？关联 muirouter，按需 fallback</h3>
          <p className="mt-1.5 text-[12.5px] leading-[1.65] text-ink-soft">
            muirouter 是一个独立的 AI 余额服务。在它那边充一笔，跨服务复用：muicv 平台余额扣完后自动走 muirouter，
            桌面端不掉链子。授权全程在 muirouter 完成，muicv 只保管 OAuth token（AES-GCM 加密）。
          </p>
          {error && <p className="mt-2 text-[12px] font-medium text-tongue">{error}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void onLink()}
              disabled={busy}
              className="press inline-flex items-center justify-center gap-1.5 rounded-lg bg-yellow px-3.5 py-1.5 text-[12.5px] font-bold text-ink disabled:opacity-60"
            >
              {busy ? '正在打开浏览器…' : '关联 muirouter'}
            </button>
            <ExternalButton href={MUIROUTER_URL} label="先去 muirouter 看看" />
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
      defaultModel: defaultModel.trim() || DEFAULT_LLM_MODEL,
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
          <p className="mt-0.5 inline-flex items-center gap-1 text-[11.5px] text-mute">
            {customConfigured ? (
              <>
                <CheckIcon size={11} weight="bold" className="shrink-0" />
                <span>当前直连 {shortHost(cfg.customLlmBase ?? '')}（不走 muicv 平台）</span>
              </>
            ) : (
              <span>您也可以使用其它平台的模型，减少 MuiCV token 消耗。</span>
            )}
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
          hint="走 muicv 平台支持：gpt-5.5 / gpt-5.4 / mimo-v2.5-pro / mimo-v2.5（前两个国际，后两个国内便宜）。自带 endpoint 时按你的清单填。"
          value={defaultModel}
          onChange={setDefaultModel}
          placeholder="gpt-5.4"
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
            className="press inline-flex items-center justify-center gap-1.5 rounded-lg bg-yellow px-4 py-2 text-[13px] font-bold text-ink"
          >
            {saved ? (
              <>
                <CheckIcon size={13} weight="bold" />
                <span>已保存</span>
              </>
            ) : (
              <span>保存</span>
            )}
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
