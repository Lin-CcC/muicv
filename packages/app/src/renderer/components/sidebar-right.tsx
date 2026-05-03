import { XIcon } from '@phosphor-icons/react';

import { useAppStore } from '../lib/store';
import { FileTree } from './file-tree';

/**
 * 右栏：只承载文件树。文件预览改走全局 PreviewDrawer（preview-drawer.tsx），
 * 不再跟文件树共用同一容器。
 */
export function SidebarRight() {
  const treeRoot = useAppStore((s) => s.rightPanelTreeRoot);
  const closePanel = useAppStore((s) => s.closeRightPanel);
  const openPreview = useAppStore((s) => s.openRightPanel);
  const activeProfile = useAppStore((s) => s.activeProfile);

  if (!treeRoot) return null;

  return (
    <aside className="relative flex h-full w-full flex-col border-l-2 border-ink bg-paper">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-rule bg-cream px-4 py-2">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-wider text-mute">文件浏览</p>
          <p className="truncate text-[13px] font-bold text-ink" title={treeRoot}>
            {activeProfile?.name ?? '工作目录'}
          </p>
        </div>
        <button
          type="button"
          onClick={closePanel}
          title="关闭"
          aria-label="关闭"
          className="flex shrink-0 items-center justify-center rounded-md px-2 py-1 text-mute hover:bg-fluff hover:text-ink"
        >
          <XIcon size={14} weight="bold" />
        </button>
      </header>
      <div className="flex-1 overflow-y-auto px-2 py-2">
        <FileTree rootPath={treeRoot} onPickFile={openPreview} />
      </div>
    </aside>
  );
}
