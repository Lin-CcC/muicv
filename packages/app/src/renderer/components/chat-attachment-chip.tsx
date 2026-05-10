import { XIcon } from '@phosphor-icons/react';
import type { DragEvent } from 'react';

import type { AttachmentRef } from '../../shared/types.ts';

const KIND_LABEL: Record<AttachmentRef['kind'], string> = {
  pdf: 'PDF',
  docx: 'DOCX',
  markdown: 'MD',
  text: 'TXT',
  image: 'IMG',
};

type Props = {
  attachment: AttachmentRef;
  /** 不传时隐藏 X 按钮（用于历史消息里只读地展示已发出的附件）。 */
  onRemove?: () => void;
  /** 点 chip 主体（label + 文件名）触发预览。X 按钮独立处理 remove。 */
  onPreview?: () => void;
};

export function AttachmentChip({ attachment: a, onRemove, onPreview }: Props) {
  const kindLabel = KIND_LABEL[a.kind] ?? '附件';
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-rule bg-paper px-2.5 py-1 text-[12px] text-ink">
      <button
        type="button"
        onClick={onPreview}
        disabled={!onPreview}
        title={onPreview ? `预览 ${a.name}` : a.name}
        className="-mx-0.5 inline-flex items-center gap-1.5 rounded px-0.5 transition hover:text-ink-soft disabled:cursor-default"
      >
        <span className="font-mono text-[10px] font-semibold text-ink-soft">{kindLabel}</span>
        <span className="max-w-[180px] truncate" title={a.path}>
          {a.name}
        </span>
      </button>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="rounded-full p-0.5 text-ink-soft transition hover:bg-rule hover:text-ink"
          aria-label={`移除 ${a.name}`}
        >
          <XIcon size={11} weight="bold" />
        </button>
      )}
    </span>
  );
}

export function hasFiles(e: DragEvent): boolean {
  const types = e.dataTransfer?.types;
  if (!types) return false;
  return Array.from(types).includes('Files');
}
