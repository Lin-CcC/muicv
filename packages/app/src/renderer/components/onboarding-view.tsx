import { useAppStore } from '../lib/store';
import { CorgiMascot } from './corgi-mascot';

const DASHBOARD_URL = 'https://muicv.com/dashboard';

/**
 * 登录后的第一次设置页 —— 选工作目录 + 提醒去 dashboard 绑 muirouter（如未绑定）。
 *
 * 完成必填项后自动切到 chat。
 */
export function OnboardingView() {
  const session = useAppStore((s) => s.session);
  const cfg = useAppStore((s) => s.config);
  const selectWorkspace = useAppStore((s) => s.selectWorkspace);
  const setView = useAppStore((s) => s.setView);

  if (!session) return null;
  const greet = session.name || session.email.split('@')[0];

  return (
    <div className="mx-auto flex h-full w-full max-w-xl flex-col gap-7 overflow-y-auto px-6 py-10">
      <header className="flex items-center gap-3">
        <CorgiMascot className="h-12 w-12" />
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-yellow-deep">
            欢迎回来，{greet}
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">来设置一下吧</h1>
          <p className="mt-1 text-[13px] text-ink-soft">两件事，1 分钟搞定。</p>
        </div>
      </header>

      <Step
        index={1}
        title="选工作目录"
        hint="所有简历素材会存在这里的 .claude/muicv/ 下，你可以用 git 自己管。"
        done={!!cfg.workspaceDir}
      >
        <div className="flex items-center gap-3 rounded-xl border-2 border-ink bg-cream px-4 py-3">
          <code className="flex-1 truncate font-mono text-[12.5px] text-ink-soft">
            {cfg.workspaceDir ?? '(未选)'}
          </code>
          <button
            type="button"
            onClick={selectWorkspace}
            className="press inline-flex items-center justify-center rounded-lg bg-yellow px-3.5 py-2 text-[12.5px] font-bold text-ink"
          >
            {cfg.workspaceDir ? '换一个' : '选目录'}
          </button>
        </div>
      </Step>

      <Step
        index={2}
        title="muirouter 余额（可选，当前 v1 必须）"
        hint={
          session.hasBYOK
            ? '已绑定。LLM 走你自己的 muirouter 余额。'
            : '在 muicv dashboard 绑定 muirouter API key。所有 LLM 调用走你的 muirouter 余额，muicv 不收 LLM 费用。M4 起 Pro/Max 档位可以用平台 token 配额免去这步。'
        }
        done={session.hasBYOK}
      >
        {!session.hasBYOK && (
          <div className="space-y-3 rounded-xl border-2 border-ink bg-fluff p-4">
            <p className="text-[13px] leading-[1.65] text-ink-soft">
              <strong className="text-ink">为什么需要</strong>：当前桌面 app 必须 BYOK 才能跑 LLM
              （Pro/Max 档位 M4 起开放）。muirouter 是统一 LLM 余额，跨任何 BYOK 服务复用，
              在 <ExternalLink href="https://muirouter.com">muirouter.com</ExternalLink> 充一笔即可。
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void window.muicv.shell.openExternal(`${DASHBOARD_URL}#muirouter`)}
                className="press inline-flex items-center gap-1.5 rounded-lg bg-yellow px-3.5 py-1.5 text-[12.5px] font-bold text-ink"
              >
                去 dashboard 绑定
              </button>
              <button
                type="button"
                onClick={() => useAppStore.getState().refreshSession()}
                className="rounded-lg border-2 border-ink bg-cream px-3.5 py-1.5 text-[12.5px] font-bold text-ink hover:bg-fluff"
              >
                我绑好了，刷新
              </button>
            </div>
          </div>
        )}
      </Step>

      {cfg.workspaceDir && session.hasBYOK && (
        <button
          type="button"
          onClick={() => setView('chat')}
          className="press mt-3 inline-flex items-center justify-center gap-2 rounded-xl bg-yellow px-5 py-3 text-[15px] font-bold text-ink"
        >
          开始对话 🐾
        </button>
      )}

      {cfg.workspaceDir && !session.hasBYOK && (
        <div className="rounded-xl border border-rule bg-paper p-3 text-[12px] leading-[1.6] text-mute">
          ⚠️ 还没绑定 muirouter。可以先进对话，但 LLM 调用会拿到 402 错误。绑好之后回这里点"我绑好了，刷新"。
          <button
            type="button"
            onClick={() => setView('chat')}
            className="mt-2 block font-semibold text-yellow-deep underline decoration-corgi decoration-2 underline-offset-4 hover:decoration-yellow"
          >
            还是先去对话页看看 →
          </button>
        </div>
      )}
    </div>
  );
}

function Step({
  index,
  title,
  hint,
  done,
  children,
}: {
  index: number;
  title: string;
  hint?: React.ReactNode;
  done?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline gap-3">
        <span
          className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-extrabold tabular-nums ${
            done ? 'bg-yellow text-ink' : 'border-2 border-ink-soft text-ink-soft'
          }`}
        >
          {done ? '✓' : index}
        </span>
        <div>
          <h2 className="text-[15px] font-bold text-ink">{title}</h2>
          {hint && <p className="mt-0.5 text-[12px] text-mute">{hint}</p>}
        </div>
      </div>
      <div className="pl-10">{children}</div>
    </section>
  );
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => void window.muicv.shell.openExternal(href)}
      className="font-semibold text-yellow-deep underline decoration-corgi decoration-2 underline-offset-4 hover:decoration-yellow"
    >
      {children}
    </button>
  );
}
