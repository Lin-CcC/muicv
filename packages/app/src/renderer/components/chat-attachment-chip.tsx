import { XIcon } from '@phosphor-icons/react';
import type { DragEvent } from 'react';

import type { AttachmentRef } from '../../shared/types.ts';

export function AttachmentChip({ attachment: a, onRemove }: { attachment: AttachmentRef; onRemove: () => void }) {
  const kindLabel = a.kind === 'pdf' ? 'PDF' : a.kind === 'docx' ? 'DOCX' : a.kind === 'markdown' ? 'MD' : 'TXT';
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-rule bg-paper px-2.5 py-1 text-[12px] text-ink">
      <span className="font-mono text-[10px] font-semibold text-ink-soft">{kindLabel}</span>
      <span className="max-w-[180px] truncate" title={a.path}>
        {a.name}
      </span>
      <button
        type="button"
        onClick={onRemove}
        className="rounded-full p-0.5 text-ink-soft transition hover:bg-rule hover:text-ink"
        aria-label={`移除 ${a.name}`}
      >
        <XIcon size={11} weight="bold" />
      </button>
    </span>
  );
}

export function hasFiles(e: DragEvent): boolean {
  const types = e.dataTransfer?.types;
  if (!types) return false;
  return Array.from(types).includes('Files');
}
