'use client';

import { forwardRef, useImperativeHandle, useRef, useState } from 'react';

/**
 * 通用确认弹窗——替掉 window.confirm。命令式 API：
 *
 *   const ref = useRef<ConfirmDialogHandle>(null);
 *   const ok = await ref.current?.open({ title, message, danger: true });
 *   if (!ok) return;
 *
 *   <ConfirmDialog ref={ref} />
 *
 * 一个实例可复用——多次 open 传不同 opts。基于 HTMLDialogElement.showModal()，
 * ESC 自动关闭走 cancel 分支。
 */

export type ConfirmDialogOpenOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** true：确认按钮显示为危险红色（解绑 / 删除等不可逆操作）。 */
  danger?: boolean;
};

export type ConfirmDialogHandle = {
  open(opts: ConfirmDialogOpenOptions): Promise<boolean>;
};

export const ConfirmDialog = forwardRef<ConfirmDialogHandle>(function ConfirmDialog(_, ref) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const resolverRef = useRef<((v: boolean) => void) | null>(null);
  const [opts, setOpts] = useState<ConfirmDialogOpenOptions | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      open: (next) =>
        new Promise<boolean>((resolve) => {
          // 上次没 settle（理论上不可能）兜底以免泄漏 promise
          resolverRef.current?.(false);
          resolverRef.current = resolve;
          setOpts(next);
          dialogRef.current?.showModal();
        }),
    }),
    [],
  );

  function settle(value: boolean) {
    resolverRef.current?.(value);
    resolverRef.current = null;
    dialogRef.current?.close();
  }

  const confirmLabel = opts?.confirmLabel ?? '确认';
  const cancelLabel = opts?.cancelLabel ?? '取消';
  const confirmClass = opts?.danger
    ? 'rounded-lg border-2 border-tongue bg-tongue px-4 py-1.5 text-[13px] font-bold text-cream hover:bg-tongue/90'
    : 'press inline-flex items-center justify-center gap-1.5 rounded-lg bg-yellow px-4 py-1.5 text-[13px] font-bold text-ink';

  return (
    <dialog
      ref={dialogRef}
      onCancel={(event) => {
        event.preventDefault();
        settle(false);
      }}
      className="m-auto w-full max-w-sm rounded-2xl border-2 border-ink bg-cream p-0 text-ink shadow-[0_6px_0_0_oklch(0.24_0.04_65)] backdrop:bg-ink/40"
    >
      {opts && (
        <div className="flex flex-col gap-4 p-6">
          <h3 className="text-[16px] font-extrabold">{opts.title}</h3>
          <p className="whitespace-pre-line text-[13px] text-ink-soft">{opts.message}</p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => settle(false)}
              className="rounded-lg border-2 border-rule-strong bg-cream px-4 py-1.5 text-[13px] font-medium text-ink hover:bg-paper"
            >
              {cancelLabel}
            </button>
            <button type="button" onClick={() => settle(true)} className={confirmClass}>
              {confirmLabel}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
});
