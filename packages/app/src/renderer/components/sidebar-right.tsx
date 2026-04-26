import { useEffect, useState } from 'react';

import { useAppStore } from '../lib/store';
import { MarkdownView } from './markdown-view';

/**
 * 右栏：artifact 预览。
 *
 * 显示当前 rightPanelPath 指向的文件内容。.md 用 MarkdownView 渲染，
 * .pdf 走 shell.openPath（M1 不内嵌），其它扩展名 fallback 等宽文本。
 */
export function SidebarRight() {
  const path = useAppStore((s) => s.rightPanelPath);
  const closePanel = useAppStore((s) => s.closeRightPanel);

  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!path) {
      setContent(null);
      setError(null);
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
  }, [path]);

  if (!path) return null;

  const fileName = path.split(/[/\\]/).pop() ?? path;
  const isPdf = /\.pdf$/i.test(path);

  return (
    <aside className="flex h-full w-full flex-col border-l-2 border-ink bg-paper">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-rule bg-cream px-4 py-2">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-wider text-mute">预览</p>
          <p className="truncate text-[13px] font-bold text-ink" title={path}>
            {fileName}
          </p>
        </div>
        <button
          type="button"
          onClick={closePanel}
          title="关闭预览"
          className="rounded-md px-2 py-1 text-[14px] text-mute hover:bg-fluff hover:text-ink"
        >
          ✕
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading && <div className="text-[12px] text-mute">读取中…</div>}
        {error && (
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
          <div className="space-y-3 text-[12.5px] text-ink-soft">
            <p>PDF 预览暂时用系统默认 PDF 阅读器打开。</p>
            <button
              type="button"
              onClick={() => void window.muicv.fs.showInFolder(path)}
              className="press inline-flex items-center justify-center rounded-lg bg-yellow px-3 py-1.5 text-[12.5px] font-bold text-ink"
            >
              在文件管理器里打开
            </button>
          </div>
        )}
      </div>

      <footer className="flex shrink-0 items-center gap-2 border-t border-rule bg-cream px-4 py-2 text-[11.5px] text-mute">
        <button
          type="button"
          onClick={() => void window.muicv.fs.showInFolder(path)}
          className="rounded px-2 py-1 hover:bg-fluff hover:text-ink"
        >
          📁 在文件管理器
        </button>
        <button
          type="button"
          onClick={() => void navigator.clipboard.writeText(path)}
          className="rounded px-2 py-1 hover:bg-fluff hover:text-ink"
        >
          复制路径
        </button>
      </footer>
    </aside>
  );
}
