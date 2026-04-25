import { useAppStore } from '../lib/store';
import { CorgiMascot } from './corgi-mascot';

/**
 * macOS hidden titlebar 顶栏：
 * - 整条可拖动（titlebar-drag），子元素可点（titlebar-no-drag）
 * - 左侧 padding 80px 给红绿灯按钮让位
 */
export function TitleBar() {
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);
  const cfg = useAppStore((s) => s.config);
  const activeChannel = useAppStore((s) => s.activeChannel);
  const busy = activeChannel !== null;

  return (
    <header className="titlebar-drag flex h-11 shrink-0 items-center justify-between border-b border-rule bg-cream/85 pl-[80px] pr-3 backdrop-blur-sm">
      <div className="titlebar-no-drag flex items-center gap-2.5">
        <CorgiMascot className="h-6 w-6" />
        <span className="text-[14px] font-bold tracking-tight">Mui简历</span>
        {busy && (
          <span className="ml-1 inline-flex items-center gap-1.5 rounded-full bg-fluff px-2 py-0.5 font-mono text-[10px] font-semibold text-yellow-deep">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-yellow" />
            思考中
          </span>
        )}
        {cfg.workspaceDir && !busy && (
          <button
            type="button"
            title="在 Finder 打开"
            onClick={() => window.muicv.shell.openWorkspace()}
            className="hidden items-center gap-1 rounded px-2 py-0.5 font-mono text-[10.5px] text-mute hover:bg-fluff hover:text-ink md:inline-flex"
          >
            📁 {shorten(cfg.workspaceDir)}
          </button>
        )}
      </div>

      <nav className="titlebar-no-drag flex items-center gap-1 text-[12px]">
        <NavTab active={view === 'chat'} onClick={() => setView('chat')}>
          对话
        </NavTab>
        <NavTab active={view === 'settings'} onClick={() => setView('settings')}>
          设置
        </NavTab>
      </nav>
    </header>
  );
}

function NavTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1 font-semibold transition ${
        active ? 'bg-yellow text-ink' : 'text-ink-soft hover:bg-fluff hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}

function shorten(p: string): string {
  if (p.length < 48) return p;
  return `${p.slice(0, 16)}…${p.slice(-28)}`;
}
