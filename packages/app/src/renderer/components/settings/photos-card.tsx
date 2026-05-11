import { ImageSquareIcon, UploadSimpleIcon } from '@phosphor-icons/react';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { PhotoHistoryItem } from '../../../shared/types.ts';

const MAX_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

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
 * 设置页里的证件照管理卡。
 *
 * - 文件选择 → POST /upload/photo → R2（i.muicv.com）。仅 jpeg/png/webp，≤ 2 MB。
 * - 列出当前账号最近 20 张上传，URL 一键复制，方便手填到 `*.resume.json` 的 `photoUrl`。
 *
 * 不放在主 chat 流里，是因为目前 chat 输出是 markdown，新 JSON 模板由用户手工编辑；
 * 等 muicv-generate 改产 JSON 后可以再加一个 chat-side 上传入口。
 */
export function PhotosCard() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [history, setHistory] = useState<PhotoHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await window.muicv.preview.listPhotos(20);
    setLoading(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setHistory(res.items);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onPickFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!ALLOWED_MIME.has(file.type.toLowerCase())) {
      setError(`只支持 jpeg / png / webp，当前是 ${file.type || '未知类型'}`);
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError(`单文件不超过 ${Math.round(MAX_SIZE_BYTES / 1024 / 1024)} MB（当前 ${formatBytes(file.size)}）`);
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const res = await window.muicv.preview.uploadPhoto({ name: file.name, mimeType: file.type, bytes });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      await refresh();
    } finally {
      setUploading(false);
    }
  }

  async function copyUrl(url: string, key: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    } catch {}
  }

  return (
    <section className="rounded-2xl border-2 border-ink bg-cream p-5 shadow-[0_4px_0_0_var(--color-ink)]">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-yellow-deep">
            <ImageSquareIcon size={11} />— 证件照
          </p>
          <h2 className="mt-1 text-[15px] font-extrabold text-ink">简历上要用的照片</h2>
          <p className="mt-1 text-[12px] text-ink-soft">
            上传到 R2 拿一个公开 URL，把它填到{' '}
            <code className="rounded bg-fluff px-1 font-mono text-[11px]">*.resume.json</code> 的{' '}
            <code className="rounded bg-fluff px-1 font-mono text-[11px]">photoUrl</code> 字段就能在 t1~t6
            模板里看到。jpeg / png / webp，≤ 2 MB。
          </p>
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-yellow px-3 py-1.5 text-[12px] font-bold text-ink shadow-[0_2px_0_0_var(--color-yellow-deep)] transition active:translate-y-[1px] active:shadow-[0_1px_0_0_var(--color-yellow-deep)] disabled:opacity-60"
        >
          <UploadSimpleIcon size={12} />
          <span>{uploading ? '上传中…' : '上传照片'}</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => void onPickFile(e)}
        />
      </header>

      {error && (
        <p className="mt-3 rounded-lg border-2 border-tongue/40 bg-tongue/10 px-3 py-2 text-[12px] text-tongue">
          {error}
        </p>
      )}

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
