import {
  DownloadSimpleIcon,
  MicrophoneIcon,
  PaperclipIcon,
  SpinnerGapIcon,
  StopIcon,
  TrashIcon,
} from '@phosphor-icons/react';
import { type ClipboardEvent, useEffect, useLayoutEffect, useRef, useState } from 'react';

import type { AttachmentRef, AudioFailedRecording, AudioRecordOutcome } from '../../shared/types.ts';
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
  /** issue #6：失败面板的"安装本地模型"按钮跳设置页用。 */
  onOpenSettings?: () => void;
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
  onOpenSettings,
}: Props) {
  const [input, setInput] = useState('');
  const [recording, setRecording] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<AttachmentRef | null>(null);
  // issue #6：转写失败时保留 wav，给用户重试 / 下载 / 引导装本地模型；切对话清空。
  const [failedAudio, setFailedAudio] = useState<(AudioFailedRecording & { localReady?: boolean }) | null>(null);
  const [retryPending, setRetryPending] = useState(false);
  // 本地兜底成功后的轻量提示（"网络异常，已用本地模型转写"）；3.5s 自清。
  const [info, setInfo] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const inputContainerRef = useRef<HTMLDivElement | null>(null);
  // 麦克风按下时的 textarea selection 快照；转写回来时按这个落点插入。
  const cursorAtClickRef = useRef<{ start: number; end: number; focused: boolean } | null>(null);
  // setInput 提交后再 focus + setSelectionRange 落光标（复用 use-slash-command 的模式）。
  const pendingCursorRef = useRef<number | null>(null);
  const slash = useSlashCommand({ value: input, onChange: setInput, textareaRef });

  // biome-ignore lint/correctness/useExhaustiveDependencies: 仅 contextKey 触发清空
  useEffect(() => {
    setInput('');
    setPreviewAttachment(null);
    setFailedAudio(null);
    setInfo(null);
  }, [contextKey]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: ref 不入 deps（引用稳定，.current 不触发 re-render）
  useEffect(() => {
    const pos = pendingCursorRef.current;
    if (pos == null) return;
    pendingCursorRef.current = null;
    const ta = textareaRef.current;
    if (!ta) return;
    ta.focus();
    ta.setSelectionRange(pos, pos);
  }, [input]);

  // info 自清
  useEffect(() => {
    if (!info) return;
    const id = setTimeout(() => setInfo(null), 3500);
    return () => clearTimeout(id);
  }, [info]);

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

  /** 在 textarea 当前光标位置插入 transcript（无焦点 → 追加；有选区 → 替换；纯光标 → 插入）。 */
  function insertTranscriptAtCursor(
    transcript: string,
    anchor: { start: number; end: number; focused: boolean },
  ): void {
    setInput((prev) => {
      if (!anchor.focused) {
        // 用户没把光标落在 textarea 里，按原"追加"语义；空 input 直接放。
        return prev ? `${prev} ${transcript}` : transcript;
      }
      const start = Math.min(anchor.start, prev.length);
      const end = Math.min(anchor.end, prev.length);
      const left = prev.slice(0, start);
      const right = prev.slice(end);
      const needLeftSpace = left.length > 0 && !/\s$/.test(left);
      const needRightSpace = right.length > 0 && !/^\s/.test(right);
      const inserted = `${needLeftSpace ? ' ' : ''}${transcript}${needRightSpace ? ' ' : ''}`;
      pendingCursorRef.current = start + inserted.length;
      return left + inserted + right;
    });
  }

  function handleSuccess(outcome: Extract<AudioRecordOutcome, { ok: true }>): void {
    const anchor = cursorAtClickRef.current ?? { start: input.length, end: input.length, focused: false };
    insertTranscriptAtCursor(outcome.result.transcript, anchor);
    setFailedAudio(null);
    if (outcome.result.provider === 'local-fallback') {
      setInfo('网络转写失败，已用本地模型转写');
    }
  }

  function handleFailure(outcome: Extract<AudioRecordOutcome, { ok: false }>): void {
    if (outcome.reason === 'cancel') return; // 用户主动取消，安静处理
    onMicError(outcome.message);
    if (outcome.reason === 'error' && outcome.lastAudio) {
      setFailedAudio(buildFailedAudio(outcome.lastAudio, outcome.localReady));
    }
  }

  async function handleMicClick(): Promise<void> {
    if (recording) return;
    const ta = textareaRef.current;
    cursorAtClickRef.current =
      ta && document.activeElement === ta
        ? { start: ta.selectionStart ?? input.length, end: ta.selectionEnd ?? input.length, focused: true }
        : { start: input.length, end: input.length, focused: false };
    setRecording(true);
    try {
      const outcome = await window.muicv.audio.recordAndTranscribe({ durationLimitSec: 180 });
      if (outcome.ok) handleSuccess(outcome);
      else handleFailure(outcome);
    } finally {
      setRecording(false);
    }
  }

  async function handleRetryTranscribe(): Promise<void> {
    if (!failedAudio || retryPending) return;
    setRetryPending(true);
    try {
      const outcome = await window.muicv.audio.retranscribe({
        wav: failedAudio.wav,
        mimeType: failedAudio.mimeType,
        durationMs: failedAudio.durationMs,
        pauses: failedAudio.pauses,
      });
      if (outcome.ok) {
        // 重试成功用此刻 textarea 光标位置插入（原 cursorAtClickRef 已过期）
        const ta = textareaRef.current;
        const anchor =
          ta && document.activeElement === ta
            ? { start: ta.selectionStart ?? input.length, end: ta.selectionEnd ?? input.length, focused: true }
            : { start: input.length, end: input.length, focused: false };
        insertTranscriptAtCursor(outcome.result.transcript, anchor);
        if (outcome.result.provider === 'local-fallback') {
          setInfo('网络转写失败，已用本地模型转写');
        }
        setFailedAudio(null);
      } else if (outcome.reason === 'error') {
        onMicError(outcome.message);
        // 后端会再次返回 lastAudio；保险起见若有则更新，无则保留原 wav
        if (outcome.lastAudio) setFailedAudio(buildFailedAudio(outcome.lastAudio, outcome.localReady));
      }
    } finally {
      setRetryPending(false);
    }
  }

  function handleDownloadFailedAudio(): void {
    if (!failedAudio) return;
    // Uint8Array → Blob → 临时 URL → <a download>。结束后 revoke 释放内存。
    // copy 一份字节进新 ArrayBuffer，避免 IPC 过来的 Uint8Array<ArrayBufferLike> 在 Blob 构造时被 TS 拒。
    const bytes = new Uint8Array(failedAudio.wav.byteLength);
    bytes.set(failedAudio.wav);
    const blob = new Blob([bytes], { type: failedAudio.mimeType || 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `muicv-recording-${Date.now()}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /** 构造 failedAudio state，避免 exactOptionalPropertyTypes 下把 undefined 显式赋给可选属性。 */
  function buildFailedAudio(
    audio: AudioFailedRecording,
    localReady: boolean | undefined,
  ): AudioFailedRecording & { localReady?: boolean } {
    return localReady === undefined ? { ...audio } : { ...audio, localReady };
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
        {info && (
          <p role="status" aria-live="polite" className="text-[12px] text-ink-soft">
            {info}
          </p>
        )}
        {failedAudio && (
          <div
            role="alert"
            aria-live="polite"
            className="flex flex-col gap-2 rounded-xl border-2 border-rule-strong bg-cream px-3 py-2 text-[12px] text-ink"
          >
            <p>转写失败，已保留这段录音（{Math.round(failedAudio.durationMs / 1000)} 秒）。</p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleRetryTranscribe()}
                disabled={retryPending}
                className="press-ink inline-flex items-center gap-1.5 rounded-lg border-2 border-rule-strong bg-cream px-2.5 py-1 text-[12px] font-medium text-ink transition hover:border-ink disabled:cursor-not-allowed disabled:opacity-60"
              >
                {retryPending ? (
                  <>
                    <SpinnerGapIcon size={12} weight="bold" className="animate-spin" />
                    重试中…
                  </>
                ) : (
                  '重试转写'
                )}
              </button>
              <button
                type="button"
                onClick={handleDownloadFailedAudio}
                className="press-ink inline-flex items-center gap-1.5 rounded-lg border-2 border-rule-strong bg-cream px-2.5 py-1 text-[12px] font-medium text-ink transition hover:border-ink"
              >
                <DownloadSimpleIcon size={12} weight="bold" />
                下载录音
              </button>
              {!failedAudio.localReady && onOpenSettings && (
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="press-ink inline-flex items-center gap-1.5 rounded-lg border-2 border-rule-strong bg-cream px-2.5 py-1 text-[12px] font-medium text-ink transition hover:border-ink"
                >
                  安装本地模型
                </button>
              )}
              <button
                type="button"
                onClick={() => setFailedAudio(null)}
                className="press-ink ml-auto inline-flex items-center gap-1.5 rounded-lg border-2 border-rule-strong bg-cream px-2.5 py-1 text-[12px] font-medium text-ink-soft transition hover:border-ink hover:text-ink"
                aria-label="放弃这段录音"
              >
                <TrashIcon size={12} weight="bold" />
                放弃
              </button>
            </div>
          </div>
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
