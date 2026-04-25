import { useState } from 'react';

import { useAppStore } from '../lib/store';
import { CorgiMascot } from './corgi-mascot';

/**
 * 设置页 —— 桌面 app 现在只需要两件东西：
 *   1. 工作目录（所有简历素材落到这里的 .claude/muicv/）
 *   2. muicv API key（mui_...）—— 唯一身份凭证
 *
 * LLM、PDF、JD 抓取、订阅档位、BYOK（绑定 muirouter）等所有跟账号 / 计费
 * 相关的事都在 muicv.com/dashboard 里管。桌面端不直接连 muirouter。
 */
export function SettingsView() {
  const cfg = useAppStore((s) => s.config);
  const patch = useAppStore((s) => s.patchConfig);
  const selectWorkspace = useAppStore((s) => s.selectWorkspace);
  const setView = useAppStore((s) => s.setView);

  const [muicvApiKey, setMuicvApiKey] = useState(cfg.muicvApiKey ?? '');
  const [defaultModel, setDefaultModel] = useState(cfg.defaultModel);
  const [muicvApiBase, setApiBase] = useState(cfg.muicvApiBase);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSave() {
    setError(null);
    try {
      await patch({
        muicvApiKey: muicvApiKey.trim() || null,
        defaultModel: defaultModel.trim() || 'gpt-4o-mini',
        muicvApiBase: muicvApiBase.trim() || 'https://api.muicv.com',
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    }
  }

  const ready = !!cfg.workspaceDir && !!cfg.muicvApiKey;

  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col gap-7 overflow-y-auto px-6 py-10">
      <header className="flex items-center gap-3">
        <CorgiMascot className="h-10 w-10" />
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">设置</h1>
          <p className="text-[13px] text-ink-soft">
            两步搞定：选工作目录 + 粘 muicv API key。其它（订阅档位 / 绑定 muirouter / 看余额）都在
            <ExternalLink href="https://muicv.com/dashboard">网页 dashboard</ExternalLink> 管。
          </p>
        </div>
      </header>

      <Section
        title="① 工作目录"
        hint="所有简历素材会存在该目录下的 .claude/muicv/ 里，由你用 git 自己管。"
      >
        <div className="flex items-center gap-3 rounded-xl border-2 border-ink bg-cream px-4 py-3">
          <code className="flex-1 truncate font-mono text-[12.5px] text-ink-soft">
            {cfg.workspaceDir ?? '(未选)'}
          </code>
          <button
            type="button"
            onClick={selectWorkspace}
            className="press-ink rounded-lg border-2 border-ink bg-cream px-3 py-1.5 text-[12.5px] font-bold text-ink"
          >
            {cfg.workspaceDir ? '换一个' : '选目录'}
          </button>
        </div>
      </Section>

      <Section
        title="② muicv API key（登录账号）"
        hint={
          <>
            桌面端唯一凭证。在{' '}
            <ExternalLink href="https://muicv.com/dashboard">muicv.com/dashboard</ExternalLink>{' '}
            登录账号 → "API Keys" 生成 <code className="font-mono text-[11.5px]">mui_...</code>。
            LLM 调用、PDF 渲染、JD 抓取都通过它代理；档位 / 计费 / muirouter BYOK 都在 dashboard 里管。
          </>
        }
      >
        <Field type="password" value={muicvApiKey} onChange={setMuicvApiKey} placeholder="mui_…" mono />
      </Section>

      <div className="rounded-xl border-2 border-corgi/60 bg-fluff p-4 text-[12.5px] leading-[1.65] text-ink">
        <div className="font-bold">🐾 想调 LLM？</div>
        <p className="mt-1 text-ink-soft">
          桌面端不直连 muirouter。muicv 后端会按你的{' '}
          <strong>订阅档位</strong> + <strong>是否绑定 muirouter (BYOK)</strong> 路由：
        </p>
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-ink-soft">
          <li>
            <strong>BYOK</strong>：在 dashboard 绑定 muirouter API key，所有 LLM 走你自己的余额，
            <ExternalLink href="https://muirouter.com">muirouter.com</ExternalLink> 充值
          </li>
          <li>
            <strong>Free / Pro / Max</strong>（M4 起）：用平台 token 配额，订阅在 dashboard 升级
          </li>
        </ul>
      </div>

      <details className="rounded-xl border-2 border-rule bg-paper">
        <summary className="cursor-pointer px-5 py-3 text-[13px] font-bold text-ink-soft">
          高级 · 模型 / 端点
        </summary>
        <div className="space-y-4 border-t border-rule px-5 py-4">
          <Section
            title="默认模型"
            hint="OpenAI 兼容 model id；具体哪些可用看你 muirouter 账号支持的清单（dashboard 可查）"
          >
            <Field
              type="text"
              value={defaultModel}
              onChange={setDefaultModel}
              placeholder="gpt-4o-mini"
              mono
            />
          </Section>
          <Section title="muicv API base URL" hint="一般不用改；本地 dev wrangler 时指向 http://localhost:8787">
            <Field
              type="text"
              value={muicvApiBase}
              onChange={setApiBase}
              placeholder="https://api.muicv.com"
              mono
            />
          </Section>
        </div>
      </details>

      {error && (
        <div
          role="alert"
          className="rounded-lg border-2 border-tongue/60 bg-tongue/10 px-3 py-2 text-[13px] font-medium text-tongue"
        >
          {error}
        </div>
      )}

      <div className="flex items-center gap-3 pb-2">
        <button
          type="button"
          onClick={onSave}
          className="press inline-flex items-center justify-center rounded-lg bg-yellow px-5 py-2.5 text-[14px] font-bold text-ink"
        >
          {saved ? '✓ 已保存' : '保存'}
        </button>
        {ready && (
          <button
            type="button"
            onClick={() => setView('chat')}
            className="rounded-lg px-3 py-2.5 text-[13px] font-medium text-ink-soft hover:text-ink"
          >
            返回对话
          </button>
        )}
        {!ready && (
          <p className="text-[12px] text-mute">
            ⚠️ 至少要选工作目录 + 填 muicv API key 才能开始对话。
          </p>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div>
        <h2 className="text-[14px] font-bold text-ink">{title}</h2>
        {hint && <p className="mt-1 text-[12px] text-mute">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({
  type,
  value,
  onChange,
  placeholder,
  mono,
}: {
  type: 'text' | 'password';
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete="off"
      spellCheck={false}
      className={`block w-full rounded-lg border-2 border-rule-strong bg-cream px-3.5 py-2.5 text-[14px] text-ink placeholder:text-mute focus:border-ink focus:bg-fluff focus:outline-none focus:ring-4 focus:ring-yellow/40 ${mono ? 'font-mono text-[13px]' : ''}`}
    />
  );
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => window.muicv.shell.openExternal(href)}
      className="font-semibold text-yellow-deep underline decoration-corgi decoration-2 underline-offset-4 hover:decoration-yellow"
    >
      {children}
    </button>
  );
}
