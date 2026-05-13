import { ChatCircleDotsIcon, ImageSquareIcon } from '@phosphor-icons/react';
import { useCallback, useEffect, useState } from 'react';

import type { PhotoHistoryItem } from '../../../shared/types.ts';

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * 设置页里的证件照管理卡（v0.4.x 重构后）。
 *
 * 上传入口已经收敛到对话：用户把图拖进 chat → AI 调 `upload_photo` agent tool →
 * 拿到 R2 URL 后写到 `.resume.json` 的 `photoUrl`。
 *
 * 这张卡片只剩"历史 + 复制 URL"作用：方便用户在没走 chat 时回看过往上传、
 * 一键复制 URL 手填到别的简历版本。卡片自身**不再上传**。
 *
 * 错误处理：listPhotos 失败时不显眼报错（生产端 D1 偶发故障 / migration 缺失
 * 都不该把整张设置页搞红），降级到"还没上传过照片"的文案 + 灰色 hint。
 */
export function PhotosCard() {
  const [history, setHistory] = useState<PhotoHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const res = await window.muicv.preview.listPhotos(20);
    setLoading(false);
    if (!res.ok) {
      // 不再红框报错：拉历史失败一般是后端 / migration 抖动，对用户来说"看不到旧照"
      // 不影响关键流程（要传新照去对话里传）。日志保留方便诊断。
      console.warn('listPhotos failed', res);
      setHistory([]);
      return;
    }
    setHistory(res.items);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function copyUrl(url: string, key: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    } catch {}
  }

  return (
    <section className="rounded-2xl border-2 border-ink bg-cream p-5 shadow-[0_4px_0_0_var(--color-ink)]">
      <header>
        <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-yellow-deep">
          <ImageSquareIcon size={11} />— 证件照
        </p>
        <h2 className="mt-1 text-[15px] font-extrabold text-ink">历史上传的简历照片</h2>
        <p className="mt-1 text-[12px] leading-[1.6] text-ink-soft">
          要给简历加照片？{' '}
          <span className="inline-flex items-center gap-1 rounded bg-fluff px-1.5 py-0.5 font-bold text-yellow-deep">
            <ChatCircleDotsIcon size={11} weight="bold" />
            回对话里
          </span>{' '}
          把图拖进输入框，告诉 AI"这是我的照片"——AI 会上传并自动填到{' '}
          <code className="rounded bg-fluff px-1 font-mono text-[11px]">*.resume.json</code> 的{' '}
          <code className="rounded bg-fluff px-1 font-mono text-[11px]">photoUrl</code> 字段。jpeg / png / webp， ≤ 2
          MB。这里只是回看历史 + 复制 URL 用。
        </p>
      </header>

      {loading && history.length === 0 ? (
        <p className="mt-4 text-[12px] text-mute">加载中…</p>
      ) : history.length === 0 ? (
        <p className="mt-4 text-[12px] text-mute">还没上传过照片。</p>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {history.map((p) => (
            <li key={p.id} className="flex items-start gap-2 rounded-xl border-2 border-rule bg-paper p-2">
              <img
                src={p.url}
                alt={p.originalName ?? '证件照'}
                loading="lazy"
                className="h-16 w-12 shrink-0 rounded-md border border-rule object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-bold text-ink">{p.originalName ?? '(未命名)'}</p>
                <p className="font-mono text-[10px] text-mute">
                  {formatBytes(p.sizeBytes)} · {p.contentType.replace('image/', '')}
                </p>
                <p className="mt-0.5 font-mono text-[10px] text-mute">{formatDate(p.createdAt)}</p>
                <button
                  type="button"
                  onClick={() => void copyUrl(p.url, p.r2Key)}
                  className="mt-1 rounded border-[1.5px] border-rule bg-cream px-2 py-0.5 text-[10.5px] font-bold text-ink-soft hover:border-ink hover:text-ink"
                >
                  {copiedKey === p.r2Key ? '已复制 URL' : '复制 URL'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
