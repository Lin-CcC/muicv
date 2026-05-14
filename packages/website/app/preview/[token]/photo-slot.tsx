'use client';

import { type DragEvent, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import styles from './preview.module.css';

type PhotoItem = {
  id: number;
  r2Key: string;
  url: string;
  contentType: string;
  sizeBytes: number;
  originalName: string | null;
  createdAt: number;
};

/**
 * 客户端把 File 用 canvas 压到最长边 ≤ MAX_W/H，输出 image/jpeg，质量 0.85。
 * 后端依然校验 ≤ 2MB / mime 白名单。
 *
 * 头像不需要透明，统一吐 JPEG 简化（带 alpha 的 PNG 会得到白底，可接受）。
 */
const MAX_W = 600;
const MAX_H = 800;
const QUALITY = 0.85;

async function compressImage(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('图片解码失败'));
      el.src = url;
    });
    const ratio = Math.min(MAX_W / img.naturalWidth, MAX_H / img.naturalHeight, 1);
    const w = Math.max(1, Math.round(img.naturalWidth * ratio));
    const h = Math.max(1, Math.round(img.naturalHeight * ratio));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d 不可用');
    // 白底兜 PNG / WebP alpha
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
    if (!blob) throw new Error('canvas toBlob 返回 null');
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * 上传区组件——默认支持点击 / 拖拽 / 粘贴三种姿势。
 *
 * - 点击 dropzone 任意位置 → 打开系统文件选择器
 * - 把图片拖入 → drop active 高亮 + 松手即上传
 * - 在 dropzone 聚焦时 Cmd/Ctrl+V 粘贴剪贴板里的图片 → 上传
 *
 * dragenter / dragleave 在嵌套元素之间会反复触发，用 dragCounter 抵消，
 * 避免 active 状态闪烁。
 */
function UploadZone({
  accept,
  busy,
  hint,
  onPick,
}: {
  accept: string;
  busy: boolean;
  hint: ReactNode;
  onPick: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);
  const [active, setActive] = useState(false);

  function pickFromList(list: FileList | null | undefined) {
    const f = list?.[0];
    if (f && /^image\//.test(f.type)) onPick(f);
  }

  function onDragEnter(e: DragEvent) {
    e.preventDefault();
    if (busy) return;
    dragCounter.current += 1;
    setActive(true);
  }
  function onDragLeave(e: DragEvent) {
    e.preventDefault();
    dragCounter.current = Math.max(0, dragCounter.current - 1);
    if (dragCounter.current === 0) setActive(false);
  }
  function onDragOver(e: DragEvent) {
    e.preventDefault();
  }
  function onDrop(e: DragEvent) {
    e.preventDefault();
    dragCounter.current = 0;
    setActive(false);
    if (busy) return;
    pickFromList(e.dataTransfer?.files);
  }

  return (
    <div
      className={`${styles.uploadZone} ${active ? styles.uploadZoneActive : ''} ${busy ? styles.uploadZoneBusy : ''}`}
      onClick={() => {
        if (!busy) inputRef.current?.click();
      }}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onPaste={(e) => {
        if (busy) return;
        const items = e.clipboardData?.items;
        if (!items) return;
        for (const it of items) {
          if (it.kind === 'file' && /^image\//.test(it.type)) {
            const f = it.getAsFile();
            if (f) {
              onPick(f);
              return;
            }
          }
        }
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (busy) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={(e) => {
          pickFromList(e.target.files);
          e.target.value = '';
        }}
      />
      <div className={styles.uploadZoneIcon} aria-hidden>
        ⬆
      </div>
      <div className={styles.uploadZoneTitle}>{busy ? '上传中…' : '点击 / 拖入 / 粘贴上传照片'}</div>
      <div className={styles.uploadZoneHint}>{hint}</div>
    </div>
  );
}

/**
 * 通用 confirm dialog——不用 native confirm（被浏览器风控易拦），自己渲染。
 * Esc / 点击背景 / 取消按钮都走 onCancel；onConfirm 由 destructive 按钮触发。
 */
function ConfirmDialog({
  title,
  body,
  confirmLabel,
  cancelLabel = '取消',
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
      else if (e.key === 'Enter') onConfirm();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, onConfirm]);

  return (
    <div className={styles.modalBackdrop} onClick={onCancel}>
      <div className={styles.confirmDialog} onClick={(e) => e.stopPropagation()} role="alertdialog" aria-modal="true">
        <div className={styles.confirmTitle}>{title}</div>
        <div className={styles.confirmBody}>{body}</div>
        <div className={styles.confirmActions}>
          <button type="button" className={styles.button} disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`${styles.button} ${danger ? styles.buttonDanger : styles.buttonPrimary}`}
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? '处理中…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

type Props = {
  token: string;
  /** 当前 preview 是否已有 photoUrl。决定渲染 "+" 占位还是 hover overlay。 */
  hasPhoto: boolean;
};

/**
 * 模板 slots.photo 注入的可点击控件。
 * - hasPhoto=false → 撑满 photo container 的 "+ 添加照片" 占位
 * - hasPhoto=true → 绝对定位、hover 出现的 "换照片" 蒙层
 * 共用同一 modal：上传新图（前端 canvas 压缩）/ 选历史照片。
 */
export function PhotoSlotButton({ token, hasPhoto }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<PhotoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<PhotoItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/photos', { credentials: 'same-origin' });
      if (res.status === 401) {
        setError('需要拥有者登录');
        return;
      }
      if (!res.ok) throw new Error(`列照片失败 (HTTP ${res.status})`);
      const body = (await res.json()) as { items: PhotoItem[] };
      setItems(body.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && confirmDelete == null) setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, confirmDelete]);

  const pickExisting = useCallback(
    async (url: string) => {
      if (saving) return;
      setSaving(true);
      setError(null);
      try {
        const res = await fetch(`/api/previews/${token}/photo`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ photoUrl: url }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setSaving(false);
      }
    },
    [router, saving, token],
  );

  const deletePhoto = useCallback(
    async (id: number) => {
      if (deletingId != null) return;
      setDeletingId(id);
      setError(null);
      try {
        const res = await fetch(`/api/photos/${id}`, {
          method: 'DELETE',
          credentials: 'same-origin',
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        setItems((prev) => prev.filter((it) => it.id !== id));
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setDeletingId(null);
        setConfirmDelete(null);
      }
    },
    [deletingId],
  );

  const handleUpload = useCallback(
    async (file: File) => {
      if (uploading) return;
      setUploading(true);
      setError(null);
      try {
        const blob = await compressImage(file);
        const form = new FormData();
        form.append('file', blob, 'avatar.jpg');
        const upRes = await fetch('/api/photos', {
          method: 'POST',
          body: form,
          credentials: 'same-origin',
        });
        if (!upRes.ok) {
          const body = (await upRes.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `上传失败 (HTTP ${upRes.status})`);
        }
        const uploaded = (await upRes.json()) as PhotoItem;
        await pickExisting(uploaded.url);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setUploading(false);
      }
    },
    [pickExisting, uploading],
  );

  const trigger = hasPhoto ? (
    <button type="button" className={styles.photoSlotChange} onClick={() => setOpen(true)} aria-label="换头像">
      换照片
    </button>
  ) : (
    <button type="button" className={styles.photoSlotButton} onClick={() => setOpen(true)} title="点击上传或选择头像">
      <span aria-hidden>＋</span>
      <span className={styles.photoSlotLabel}>添加照片</span>
    </button>
  );

  return (
    <>
      {trigger}
      {open ? (
        <div className={styles.modalBackdrop} onClick={() => setOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <strong>选择或上传头像</strong>
              <button type="button" className={styles.modalClose} onClick={() => setOpen(false)}>
                ✕
              </button>
            </div>
            <div className={styles.modalBody}>
              <UploadZone
                accept="image/jpeg,image/png,image/webp"
                busy={uploading}
                hint={
                  <>
                    JPEG / PNG / WebP。我会在你浏览器里自动压到最长边 ≤ {MAX_W}×{MAX_H}。
                  </>
                }
                onPick={(f) => void handleUpload(f)}
              />

              {error ? <p className={styles.modalError}>{error}</p> : null}

              <div className={styles.modalSubHead}>历史照片</div>
              {loading ? (
                <p className={styles.modalHint}>加载中…</p>
              ) : items.length === 0 ? (
                <p className={styles.modalHint}>还没上传过，先在上面拖入或点击选一张图。</p>
              ) : (
                <div className={styles.photoGrid}>
                  {items.map((it) => {
                    const isDeleting = deletingId === it.id;
                    return (
                      <div key={it.id} className={styles.photoThumbWrap}>
                        <button
                          type="button"
                          className={styles.photoThumb}
                          onClick={() => void pickExisting(it.url)}
                          disabled={saving || isDeleting}
                          title={it.originalName ?? it.r2Key}
                        >
                          {/* biome-ignore lint/performance/noImgElement: 简单缩略图，next/image 在 cf workers 反而要额外配置 */}
                          <img src={it.url} alt="" />
                        </button>
                        <button
                          type="button"
                          className={styles.photoThumbDelete}
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDelete(it);
                          }}
                          disabled={isDeleting || saving}
                          aria-label="删除这张照片"
                          title="删除这张照片"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
      {confirmDelete ? (
        <ConfirmDialog
          title="删除这张照片？"
          body={<>删除后不可恢复。已经把这张照片用作 photoUrl 的预览/PDF 会显示破损图片。</>}
          confirmLabel="删除"
          danger
          busy={deletingId === confirmDelete.id}
          onConfirm={() => void deletePhoto(confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
        />
      ) : null}
    </>
  );
}
