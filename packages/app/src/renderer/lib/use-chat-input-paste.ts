import type { ClipboardEvent } from 'react';

import type { ChatAttachmentsApi } from './use-chat-attachments';

/**
 * textarea 粘贴 handler。拦下任何带文件的剪贴板内容（截图 / 拷贝文件 / 浏览器复制图片）
 * 走统一的 attachments.handleFiles 上传管线；纯文本粘贴不动，照常走 textarea 默认。
 *
 * 浏览器有时把文件放 .files，有时放 .items（`kind:'file'`），所以两边都查；
 * 按 name + size + lastModified 粗粒度去重避免同图被加两次。
 */
export function useChatInputPaste(attachments: ChatAttachmentsApi): (e: ClipboardEvent<HTMLTextAreaElement>) => void {
  return function handlePaste(e: ClipboardEvent<HTMLTextAreaElement>): void {
    const cd = e.clipboardData;
    if (!cd) return;
    const fromFiles = Array.from(cd.files ?? []);
    const fromItems: File[] = [];
    for (const it of Array.from(cd.items ?? [])) {
      if (it.kind === 'file') {
        const f = it.getAsFile();
        if (f) fromItems.push(f);
      }
    }
    const merged = [...fromFiles];
    for (const f of fromItems) {
      if (!merged.some((x) => x.name === f.name && x.size === f.size && x.lastModified === f.lastModified)) {
        merged.push(f);
      }
    }
    if (merged.length === 0) return;
    e.preventDefault();
    void attachments.handleFiles(merged);
  };
}
