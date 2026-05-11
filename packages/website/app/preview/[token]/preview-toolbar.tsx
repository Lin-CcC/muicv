'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import styles from './preview.module.css';

export type PreviewToolbarProps = {
  token: string;
  shareUrl: string;
  shareMode: 'link' | 'public';
  expiresAt: number;
  /** D1 里 pdfCredit > 0 时为 true：表示 owner 已经渲染过一次，公开访客也能下载。 */
  canDownloadPdf: boolean;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://api.muicv.com';

function formatDateLocal(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function PreviewToolbar({ token, shareUrl, shareMode, expiresAt, canDownloadPdf }: PreviewToolbarProps) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const shareWrapperRef = useRef<HTMLDivElement>(null);

  // 点击 toolbar 之外关掉 share menu
  useEffect(() => {
    if (!shareOpen) return;
    function onPointer(event: PointerEvent) {
      if (!shareWrapperRef.current) return;
      if (!shareWrapperRef.current.contains(event.target as Node)) {
        setShareOpen(false);
      }
    }
    window.addEventListener('pointerdown', onPointer);
    return () => window.removeEventListener('pointerdown', onPointer);
  }, [shareOpen]);

  const handleDownload = useCallback(async () => {
    if (downloading) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      const res = await fetch(`${API_BASE}/preview/${token}/pdf`, { method: 'POST' });
      if (!res.ok) {
        if (res.status === 402) {
          const body = (await res.json().catch(() => ({}))) as { message?: string };
          throw new Error(body.message ?? '需要拥有者先生成一次 PDF 才能开放下载');
        }
        throw new Error(`下载失败 (HTTP ${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `resume-${token.slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : String(err));
    } finally {
      setDownloading(false);
    }
  }, [downloading, token]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // 退化路径：手动选中
      inputRef.current?.select();
    }
  }, [shareUrl]);

  return (
    <div className={styles.toolbar}>
      <div className={styles.toolbarLeft}>
        <span className={styles.toolbarBadge}>Resume preview</span>
        <span className={styles.toolbarMeta}>过期于 {formatDateLocal(expiresAt)}</span>
      </div>
      <div className={styles.toolbarRight}>
        {downloadError ? <span className={styles.downloadHint}>{downloadError}</span> : null}
        {!canDownloadPdf ? <span className={styles.downloadHint}>首次下载由拥有者完成</span> : null}
        <button
          type="button"
          className={`${styles.button} ${styles.buttonPrimary}`}
          onClick={handleDownload}
          disabled={downloading}
        >
          {downloading ? '生成中…' : '下载 PDF'}
        </button>
        <div className={styles.shareWrapper} ref={shareWrapperRef}>
          <button type="button" className={styles.button} onClick={() => setShareOpen((v) => !v)}>
            分享
          </button>
          {shareOpen ? (
            <div className={styles.shareMenu}>
              <strong>分享链接</strong>
              <div className={styles.shareMenuRow}>
                <input
                  ref={inputRef}
                  className={styles.shareMenuInput}
                  type="text"
                  readOnly
                  value={shareUrl}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button type="button" className={styles.button} onClick={handleCopy}>
                  {copied ? '已复制' : '复制'}
                </button>
              </div>
              <div className={styles.shareModeNote}>
                当前模式：{shareMode === 'public' ? '全网公开（可被搜索引擎抓取）' : '仅持链接者可见（noindex）'}。
                想切换访问范围，回到 dashboard 调整。
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
