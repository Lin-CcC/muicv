import { ArrowLeftIcon, FolderOpenIcon, XIcon } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';

import { useAppStore } from '../lib/store';
import { FileTree } from './file-tree';
import { MarkdownView } from './markdown-view';

/**
 * 右栏：tree + preview 是独立两层。
 *   - 底层：tree（rightPanelTreeRoot 不空时一直挂着，expand 状态自然保留）
 *   - 上层：preview drawer，覆盖整个右栏，关掉后下面的 tree 立刻可见
 *
 * 这样用户回退到树不需要重新拉取目录子项，体感是真"drawer"。
 */
export function SidebarRight() {
  const treeRoot = useAppStore((s) => s.rightPanelTreeRoot);
  const previewPath = useAppStore((s) => s.rightPanelPreviewPath);
  const closePanel = useAppStore((s) => s.closeRightPanel);
  const closePreview = useAppStore((s) => s.closePreview);
  const openFileTree = useAppStore((s) => s.openFileTree);
  const openPreview = useAppStore((s) => s.openRightPanel);
  const activeProfile = useAppStore((s) => s.activeProfile);

  if (!treeRoot && !previewPath) return null;

  return (
    <aside className="relative h-full w-full border-l-2 border-ink bg-paper">
      {treeRoot && (
        <TreeMode
          rootPath={treeRoot}
          onPickFile={openPreview}
          onClose={closePanel}
          workspaceLabel={activeProfile?.name}
        />
      )}
      {/* 没开树但 preview 来了（artifact 卡片直接打开）—— 整个面板就只有 preview */}
      {!treeRoot && previewPath && (
        <PreviewMode
          path={previewPath}
          onClose={closePanel}
          onBackToTree={() => {
            openFileTree();
            closePreview();
          }}
        />
      )}
      {/* 树 + preview 同时存在：preview 作为 drawer overlay 盖在树上 */}
      {treeRoot && previewPath && (
        <div className="absolute inset-0 bg-paper">
          <PreviewMode path={previewPath} onClose={closePanel} onBackToTree={closePreview} />
        </div>
      )}
    </aside>
  );
}

function TreeMode({
  rootPath,
  onPickFile,
  onClose,
  workspaceLabel,
}: {
  rootPath: string;
  onPickFile: (path: string) => void;
  onClose: () => void;
  workspaceLabel?: string | undefined;
}) {
  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-rule bg-cream px-4 py-2">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-wider text-mute">文件浏览</p>
          <p className="truncate text-[13px] font-bold text-ink" title={rootPath}>
            {workspaceLabel ?? '工作目录'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          title="关闭"
          aria-label="关闭"
          className="flex shrink-0 items-center justify-center rounded-md px-2 py-1 text-mute hover:bg-fluff hover:text-ink"
        >
          <XIcon size={14} weight="bold" />
        </button>
      </header>
      <div className="flex-1 overflow-y-auto px-2 py-2">
        <FileTree rootPath={rootPath} onPickFile={onPickFile} />
      </div>
    </div>
  );
}

function PreviewMode({ path, onBackToTree, onClose }: { path: string; onBackToTree: () => void; onClose: () => void }) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fileName = path.split(/[/\\]/).pop() ?? path;
  const isPdf = /\.pdf$/i.test(path);

  useEffect(() => {
    // PDF 走 muicv-pdf:// 让 Chromium 内置 viewer 自己 fetch，
    // 不需要在 renderer 这边 fs.read 二进制内容。
    if (isPdf) {
      setContent(null);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setContent(null);
    void window.muicv.fs.read(path).then((text) => {
      if (cancelled) return;
      setLoading(false);
      if (text === null) setError('读不到这个文件，可能已被删 / 路径越界');
      else setContent(text);
    });
    return () => {
      cancelled = true;
    };
  }, [path, isPdf]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center gap-2 border-b border-rule bg-cream px-4 py-2">
        <button
          type="button"
          onClick={onBackToTree}
          title="返回文件树"
          className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[12px] text-mute hover:bg-fluff hover:text-ink"
        >
          <ArrowLeftIcon size={12} weight="bold" />
          <span>文件树</span>
        </button>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-wider text-mute">预览</p>
          <p className="truncate text-[13px] font-bold text-ink" title={path}>
            {fileName}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          title="关闭整个右栏"
          aria-label="关闭整个右栏"
          className="flex shrink-0 items-center justify-center rounded-md px-2 py-1 text-mute hover:bg-fluff hover:text-ink"
        >
          <XIcon size={14} weight="bold" />
        </button>
      </header>

      <div className={`flex-1 ${isPdf ? 'flex flex-col' : 'overflow-y-auto px-4 py-4'}`}>
        {loading && !isPdf && <div className="text-[12px] text-mute">读取中…</div>}
        {error && !isPdf && (
          <div className="rounded-lg border-2 border-tongue/60 bg-tongue/10 px-3 py-2 text-[12.5px] text-tongue">
            {error}
          </div>
        )}
        {content !== null && !error && !isPdf && /\.md$/i.test(path) && <MarkdownView source={content} />}
        {content !== null && !error && !isPdf && !/\.md$/i.test(path) && (
          <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[12px] leading-[1.55] text-ink-soft">
            {content}
          </pre>
        )}
        {isPdf && (
          // muicv-pdf:// 协议在 main 进程注册（src/main/index.ts），把 path 当 host
          // 之外的 absolute pathname 传，main 端 decodeURIComponent 后做 workspace 越权校验。
          // encodeURI 保留 / 不被编码，但中文 / 空格会被转义。
          // iframe 用绝对填充：父级 flex 容器在某些链路下 h-full 会塌成 0，inline style
          // 强保 100% 最稳。
          <iframe
            key={path}
            title={fileName}
            src={`muicv-pdf://local${encodeURI(path)}`}
            className="border-0 bg-white"
            style={{ width: '100%', height: '100%', flex: 1 }}
          />
        )}
      </div>

      <footer className="flex shrink-0 items-center gap-2 border-t border-rule bg-cream px-4 py-2 text-[11.5px] text-mute">
        <button
          type="button"
          onClick={() => void window.muicv.fs.showInFolder(path)}
          className="inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-fluff hover:text-ink"
        >
          <FolderOpenIcon size={12} />
          <span>在文件管理器</span>
        </button>
        <button
          type="button"
          onClick={() => void navigator.clipboard.writeText(path)}
          className="rounded px-2 py-1 hover:bg-fluff hover:text-ink"
        >
          复制路径
        </button>
      </footer>
    </div>
  );
}
