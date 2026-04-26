import { useAppStore } from '../lib/store';

/**
 * macOS hidden titlebar 顶栏（瘦身版）：
 *
 * 三栏改造后，profile 切换器 / 用户菜单 / 对话/设置 tabs 全搬到左栏。
 * 顶栏只剩：左侧栏折叠按钮 + 标题 + 思考状态 + 右侧栏折叠按钮。
 */
export function TitleBar() {
  const session = useAppStore((s) => s.session);
  const activeChannel = useAppStore((s) => s.activeChannel);
  const leftCollapsed = useAppStore((s) => s.leftCollapsed);
  const rightCollapsed = useAppStore((s) => s.rightCollapsed);
  const rightPanelPath = useAppStore((s) => s.rightPanelPath);
  const toggleLeft = useAppStore((s) => s.toggleLeft);
  const toggleRight = useAppStore((s) => s.toggleRight);

  const busy = activeChannel !== null;
  const canToggleRight = !!rightPanelPath; // 没有 path 时右栏即使展开也没内容

  return (
    <header className="titlebar-drag flex h-11 shrink-0 items-center justify-between border-b border-rule bg-cream/85 pl-[80px] pr-3 backdrop-blur-sm">
      <div className="titlebar-no-drag flex items-center gap-2.5">
        {session && (
          <button
            type="button"
            onClick={toggleLeft}
            title={leftCollapsed ? '展开左栏' : '收起左栏'}
            className="rounded-md px-2 py-0.5 text-[14px] text-mute hover:bg-fluff hover:text-ink"
          >
            {leftCollapsed ? '☰' : '◧'}
          </button>
        )}
        <span className="text-[14px] font-bold tracking-tight text-ink">Mui简历</span>

        {busy && (
          <span className="ml-1 inline-flex items-center gap-1.5 rounded-full bg-fluff px-2 py-0.5 font-mono text-[10px] font-semibold text-yellow-deep">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-yellow" />
            思考中
          </span>
        )}
      </div>

      <div className="titlebar-no-drag flex items-center gap-1">
        {session && canToggleRight && (
          <button
            type="button"
            onClick={toggleRight}
            title={rightCollapsed ? '展开右栏预览' : '收起右栏预览'}
            className="rounded-md px-2 py-0.5 text-[14px] text-mute hover:bg-fluff hover:text-ink"
          >
            {rightCollapsed ? '◨' : '☰'}
          </button>
        )}
      </div>
    </header>
  );
}
