import { ArrowLeftIcon, FolderOpenIcon, XIcon } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { useAppStore } from '../lib/store';
import { MarkdownView } from './markdown-view';

/**
 * 文件预览 drawer。从右侧滑入，覆盖整个窗口（含 titlebar）；ESC / 点 backdrop 关闭。
 *
 * 跟文件树 (SidebarRight) 解耦：
 *   - 触发条件 = rightPanelPreviewPath 不空（不再连带触发右栏展开）
 *   - 关闭 = closePreview()，treeRoot 不动
 *   - "← 文件树" = openFileTree() + closePreview()，确保关掉预览后用户能落到文件树上
 */
export function PreviewDrawer() {
  const previewPath = useAppStore((s) => s.rightPanelPreviewPath);
  const closePreview = useAppStore((s) => s.closePreview);
  const openFileTree = useAppStore((s) => s.openFileTree);

  useEffect(() => {
    if (!previewPath) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closePreview();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [previewPath, closePreview]);

  if (!previewPath) return null;

  function backToTree() {
    openFileTree();
    closePreview();
  }

  return createPortal(
    <div className="fixed inset-0 z-[90] flex justify-end">
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]" aria-hidden onClick={closePreview} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="文件预览"
        className="relative flex h-full w-full max-w-[1100px] flex-col border-l-2 border-ink bg-paper shadow-[-5px_0_0_0_var(--color-ink)] sm:w-[80%]"
      >
        <PreviewContent path={previewPath} onBackToTree={backToTree} onClose={closePreview} />
      </aside>
    </div>,
    document.body,
  );
}

function PreviewContent({
  path,
  onBackToTree,
  onClose,
}: {
  path: string;
  onBackToTree: () => void;
  onClose: () => void;
}) {
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
    <>
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
          title="关闭预览"
          aria-label="关闭预览"
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
    </>
  );
}
