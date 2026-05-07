import { MicrophoneIcon, PaperclipIcon, SpinnerGapIcon, StopIcon } from '@phosphor-icons/react';
import { type ClipboardEvent, useEffect, useLayoutEffect, useRef, useState } from 'react';

import type { AttachmentRef } from '../../shared/types.ts';
import type { ChatAttachmentsApi } from '../lib/use-chat-attachments';
import { ATTACHMENT_ACCEPT, MAX_ATTACHMENTS_PER_SEND } from '../lib/use-chat-attachments';
import { useSlashCommand } from '../lib/use-slash-command.ts';
import { AttachmentPreviewDialog } from './attachment-preview-dialog';
import { AttachmentChip } from './chat-attachment-chip';
import { SlashCommandMenu } from './slash-command-menu.tsx';

type Props = {
  /** profile.id + ':' + conversation.id；切换上下文时变更，触发草稿清空。 */
  contextKey: string;
  placeholder: string;
  busy: boolean;
  errorMessage: string | null;
  attachments: ChatAttachmentsApi;
  onMicError: (message: string) => void;
  onSend: (text: string) => void;
  onAbort: () => void;
};

/**
 * 中栏底部输入面板：mic / paperclip / textarea / send-or-stop + slash 菜单 +
 * 错误条 + 附件 chip 列表 + 上传中提示。
 *
 * 内部维护 input 草稿 + 录音状态；切 profile / 切对话靠 contextKey 变化触发清空，
 * 父组件只负责提供两个 id 拼成的 key。语音录到的文本默认追加到 input 让用户编辑后
 * 再按发送，所以 mic 逻辑也归输入面板，唯一外溢的是错误（走 onMicError 上报）。
 */
export function ChatInputBar({
  contextKey,
  placeholder,
  busy,
  errorMessage,
  attachments,
  onMicError,
  onSend,
  onAbort,
}: Props) {
  const [input, setInput] = useState('');
  const [recording, setRecording] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<AttachmentRef | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const inputContainerRef = useRef<HTMLDivElement | null>(null);
  const slash = useSlashCommand({ value: input, onChange: setInput, textareaRef });

  // biome-ignore lint/correctness/useExhaustiveDependencies: 仅 contextKey 触发清空
  useEffect(() => {
    setInput('');
    setPreviewAttachment(null);
  }, [contextKey]);

  // 预览的附件被移除（或发送后清空）→ 自动关 dialog，避免预览空文件
  useEffect(() => {
    if (!previewAttachment) return;
    const stillThere = attachments.pendingAttachments.some((a) => a.path === previewAttachment.path);
    if (!stillThere) setPreviewAttachment(null);
  }, [attachments.pendingAttachments, previewAttachment]);

  // textarea 自适应高度：2 行起步，最多 10 行；超过 10 行内部滚动。
  // 用 useLayoutEffect 在 paint 之前同步改高度，避免抖一帧。reset 到 auto
  // 让 scrollHeight 反映真实内容（不被上一次设的 height 卡住）。
  useLayoutEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    const cs = getComputedStyle(ta);
    const fontSize = Number.parseFloat(cs.fontSize) || 14;
    const lhRaw = cs.lineHeight;
    const lh = lhRaw === 'normal' ? fontSize * 1.4 : Number.parseFloat(lhRaw) || fontSize * 1.4;
    const py = (Number.parseFloat(cs.paddingTop) || 0) + (Number.parseFloat(cs.paddingBottom) || 0);
    const minHeight = lh * 2 + py;
    const maxHeight = lh * 10 + py;
    const target = Math.max(minHeight, Math.min(ta.scrollHeight, maxHeight));
    ta.style.height = `${target}px`;
    ta.style.overflowY = ta.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [input]);

  async function handleMicClick(): Promise<void> {
    if (recording) return;
    setRecording(true);
    try {
      const outcome = await window.muicv.audio.recordAndTranscribe({ durationLimitSec: 180 });
      if (!outcome.ok) {
        if (outcome.reason !== 'cancel') onMicError(outcome.message);
        return;
      }
      // 默认填入 textarea 让用户编辑后再按发送；空 input 直接放，已有内容追加
      setInput((prev) => (prev.trim() ? `${prev.trim()} ${outcome.result.transcript}` : outcome.result.transcript));
    } finally {
      setRecording(false);
    }
  }

  function handleSendClick() {
    const text = input.trim();
    if (!text && attachments.pendingAttachments.length === 0) return;
    if (busy) return;
    onSend(text);
    setInput('');
  }

  /**
   * 粘贴：拦下任何带文件的剪贴板内容（包括截图 / 拷贝来的文件 / 浏览器里复制的图片）
   * 走统一的 handleFiles 上传管线；纯文本粘贴不动，照常走 textarea 默认行为。
   */
  function handlePaste(e: ClipboardEvent<HTMLTextAreaElement>): void {
    const cd = e.clipboardData;
    if (!cd) return;
    const fromFiles = Array.from(cd.files ?? []);
    // 浏览器有时不把文件放 .files 而放 .items（`kind:'file'`），两边都查一下
    const fromItems: File[] = [];
    for (const it of Array.from(cd.items ?? [])) {
      if (it.kind === 'file') {
        const f = it.getAsFile();
        if (f) fromItems.push(f);
      }
    }
    // 合并去重（按 name + size + lastModified 粗粒度判等）
    const merged = [...fromFiles];
    for (const f of fromItems) {
      if (!merged.some((x) => x.name === f.name && x.size === f.size && x.lastModified === f.lastModified)) {
        merged.push(f);
      }
    }
    if (merged.length === 0) return; // 纯文本粘贴
    e.preventDefault();
    void attachments.handleFiles(merged);
  }

  const canSend =
    (input.trim().length > 0 || attachments.pendingAttachments.length > 0) && attachments.uploadingCount === 0;

  return (
    <div className="border-t border-rule bg-cream/85 px-6 py-4 backdrop-blur-sm">
      <div className="mx-auto flex max-w-2xl flex-col gap-2">
        {errorMessage && (
          <p role="alert" className="text-[12px] text-tongue">
            {errorMessage}
          </p>
        )}
        {attachments.attachmentErrors.length > 0 && (
          <div className="flex flex-col gap-1">
            {attachments.attachmentErrors.map((e) => (
              <p key={e.id} role="alert" className="text-[12px] text-tongue">
                {e.message}
              </p>
            ))}
          </div>
        )}
        {(attachments.pendingAttachments.length > 0 || attachments.uploadingCount > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {attachments.pendingAttachments.map((a) => (
              <AttachmentChip
                key={a.path}
                attachment={a}
                onRemove={() => attachments.removeAttachment(a.path)}
                onPreview={() => setPreviewAttachment(a)}
              />
            ))}
            {attachments.uploadingCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-rule bg-paper px-2.5 py-1 text-[12px] text-ink-soft">
                <SpinnerGapIcon size={12} weight="bold" className="animate-spin" />
                上传中…（{attachments.uploadingCount}）
              </span>
            )}
          </div>
        )}
        <input
          ref={attachments.fileInputRef}
          type="file"
          multiple
          accept={ATTACHMENT_ACCEPT}
          className="hidden"
          onChange={attachments.onFileInputChange}
        />
        <div
          ref={inputContainerRef}
          className="flex items-end gap-2 rounded-2xl border-2 border-rule-strong bg-cream p-2 transition focus-within:border-ink"
        >
          <button
            type="button"
            onClick={() => void handleMicClick()}
            disabled={busy || recording}
            title={recording ? '录音 / 转写中…' : '语音输入（最长 3 分钟）'}
            className="press-ink inline-flex shrink-0 items-center justify-center rounded-lg border-2 border-rule-strong bg-cream p-2 text-ink transition hover:border-ink disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="语音输入"
          >
            {recording ? (
              <SpinnerGapIcon size={18} weight="bold" className="animate-spin" />
            ) : (
              <MicrophoneIcon size={18} weight="regular" />
            )}
          </button>
          <button
            type="button"
            onClick={attachments.onPickFiles}
            disabled={busy || attachments.pendingAttachments.length >= MAX_ATTACHMENTS_PER_SEND}
            title={`上传附件（PDF / DOCX / Markdown / 文本 / 图像；也可以直接拖入或粘贴。单文件 ≤ 20MB，单次最多 ${MAX_ATTACHMENTS_PER_SEND} 个）`}
            className="press-ink inline-flex shrink-0 items-center justify-center rounded-lg border-2 border-rule-strong bg-cream p-2 text-ink transition hover:border-ink disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="上传附件"
          >
            <PaperclipIcon size={18} weight="regular" />
          </button>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (slash.handleKeyDown(e)) return;
              if (e.nativeEvent.isComposing) return;
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSendClick();
            }}
            onPaste={handlePaste}
            onContextMenu={(e) => {
              // 拦下 Chromium 默认空菜单，让主进程弹 native 编辑菜单
              e.preventDefault();
              window.muicv.chatInput.showContextMenu({ editable: true });
            }}
            placeholder={placeholder}
            disabled={busy}
            rows={2}
            className="flex-1 resize-none rounded-lg bg-transparent px-3 py-2 text-[14px] leading-[1.5] text-ink placeholder:text-mute focus:outline-none disabled:opacity-60"
          />
          {busy ? (
            <button
              type="button"
              onClick={onAbort}
              className="press-ink inline-flex shrink-0 items-center gap-1.5 rounded-lg border-2 border-ink bg-cream px-3.5 py-2 text-[13px] font-bold text-ink"
            >
              <span>停</span>
              <StopIcon size={12} weight="fill" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSendClick}
              disabled={!canSend}
              className="press shrink-0 rounded-lg bg-yellow px-3.5 py-2 text-[13px] font-bold text-ink disabled:cursor-not-allowed disabled:opacity-60"
            >
              发送 ⌘↵
            </button>
          )}
        </div>
        <SlashCommandMenu
          open={slash.menuOpen}
          anchor={inputContainerRef.current}
          items={slash.items}
          activeIndex={slash.activeIndex}
          onPick={slash.pick}
          onHover={slash.setActiveIndex}
          onOpenChange={(open) => {
            if (!open) slash.closeAndKeep();
          }}
        />
      </div>
      <AttachmentPreviewDialog attachment={previewAttachment} onClose={() => setPreviewAttachment(null)} />
    </div>
  );
}
