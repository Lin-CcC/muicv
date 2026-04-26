import { useAppStore } from '../lib/store';
import { ChatView } from './chat-view';
import { SettingsView } from './settings-view';
import { SidebarLeft } from './sidebar-left';
import { SidebarRight } from './sidebar-right';
import { TitleBar } from './title-bar';

/**
 * 三栏布局：left navigator | center main | right artifact preview。
 *
 * 左栏可折叠（默认展开）；右栏只在 rightPanelPath 不为空时展开。
 * 中栏是 view 路由（chat / settings 切换），不再切左右栏。
 */
export function AppShell() {
  const view = useAppStore((s) => s.view);
  const leftCollapsed = useAppStore((s) => s.leftCollapsed);
  const rightCollapsed = useAppStore((s) => s.rightCollapsed);
  const rightPanelPath = useAppStore((s) => s.rightPanelPath);

  const showRight = !rightCollapsed && rightPanelPath !== null;

  return (
    <div className="flex h-screen flex-col bg-cream">
      <TitleBar />
      <div className="flex min-h-0 flex-1">
        {!leftCollapsed && (
          <div className="w-[260px] shrink-0">
            <SidebarLeft />
          </div>
        )}
        <main className="min-w-0 flex-1 overflow-hidden">{view === 'settings' ? <SettingsView /> : <ChatView />}</main>
        {showRight && (
          <div className="w-[440px] shrink-0">
            <SidebarRight />
          </div>
        )}
      </div>
    </div>
  );
}
