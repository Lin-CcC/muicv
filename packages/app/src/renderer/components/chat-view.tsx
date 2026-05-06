import { MicrophoneIcon, PaperclipIcon, SpinnerGapIcon, StopIcon, XIcon } from '@phosphor-icons/react';
import { type ChangeEvent, type DragEvent, useEffect, useRef, useState } from 'react';

import {
  type AgentChunk,
  type ArtifactRef,
  type AttachmentRef,
  CONVERSATION_TYPE_META,
  type ToolCallRecord,
} from '../../shared/types.ts';
import { CONVERSATION_TYPE_ICON } from '../lib/conversation-type-icon';
import { useAppStore } from '../lib/store';
import { AiSetupCard, CenteredCard, EmptyConversation, NoConversationCard } from './chat-empty-states';
import { MessageBubble } from './chat-message-bubble';
import {
  classifyError,
  cryptoRandomId,
  formatAttachmentsFooter,
  resolveWorkspacePath,
  safeParseJson,
  stripLeadingEmoji,
} from './chat-utils';

const ATTACHMENT_ACCEPT =
  '.pdf,.docx,.md,.markdown,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/markdown,text/plain';
const MAX_ATTACHMENTS_PER_SEND = 5;
const ATTACHMENT_ERROR_TTL_MS = 4000;

/**
 * 中栏：当前 activeConversation 的对话流 + 输入框。
 *
 * 流程：
 *   1. 发送 → push user msg + 一条空 assistant msg 到 activeConversation.messages
 *   2. invoke('agent:chat', { profileId, convId, type, messages }) 拿 channelId
 *   3. addEventListener `muicv:agent:chunk:<channelId>` 累加增量；artifact chunk
 *      attach 到当前 assistant msg
 *   4. 'finish' / 'error' 解绑 + 解锁输入；main 已经把整份 conv flush 到磁盘
 */
export function ChatView() {
  const session = useAppStore((s) => s.session);
  const activeProfile = useAppStore((s) => s.activeProfile);
  const activeConversation = useAppStore((s) => s.activeConversation);
  const setView = useAppStore((s) => s.setView);
  const pushMessage = useAppStore((s) => s.pushMessage);
  const appendAssistantText = useAppStore((s) => s.appendAssistantText);
  const attachToolCall = useAppStore((s) => s.attachToolCall);
  const updateToolOutput = useAppStore((s) => s.updateToolOutput);
  const attachArtifact = useAppStore((s) => s.attachArtifact);
  const activeChannel = useAppStore((s) => s.activeChannel);
  const setActiveChannel = useAppStore((s) => s.setActiveChannel);
  const openRightPanel = useAppStore((s) => s.openRightPanel);

  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [needsAiSetup, setNeedsAiSetup] = useState(false);
  const [recording, setRecording] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<AttachmentRef[]>([]);
  const [attachmentErrors, setAttachmentErrors] = useState<Array<{ id: string; message: string }>>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragDepthRef = useRef(0);

  // 切 profile / 换对话 → 清空已选附件，避免跨上下文污染
  // biome-ignore lint/correctness/useExhaustiveDependencies: 只在切 profile / 对话时清
  useEffect(() => {
    setPendingAttachments([]);
    setAttachmentErrors([]);
    dragDepthRef.current = 0;
    setIsDragging(false);
  }, [activeProfile?.id, activeConversation?.id]);

  function pushAttachmentError(message: string): void {
    const id = cryptoRandomId();
    setAttachmentErrors((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setAttachmentErrors((prev) => prev.filter((e) => e.id !== id));
    }, ATTACHMENT_ERROR_TTL_MS);
  }

  async function handleFiles(files: FileList | File[]): Promise<void> {
    if (!activeProfile) {
      pushAttachmentError('先选中一份职业档案再上传');
      return;
    }
    const list = Array.from(files);
    if (list.length === 0) return;

    const remaining = MAX_ATTACHMENTS_PER_SEND - pendingAttachments.length;
    if (remaining <= 0) {
      pushAttachmentError(`一次最多 ${MAX_ATTACHMENTS_PER_SEND} 个附件，先发一轮再传`);
      return;
    }
    const accepted = list.slice(0, remaining);
    if (list.length > remaining) {
      pushAttachmentError(`一次最多 ${MAX_ATTACHMENTS_PER_SEND} 个附件，多余的 ${list.length - remaining} 个跳过`);
    }

    setUploadingCount((n) => n + accepted.length);
    try {
      await Promise.allSettled(
        accepted.map(async (file) => {
          try {
            const bytes = await file.arrayBuffer();
            const result = await window.muicv.attachments.save(activeProfile.id, {
              name: file.name,
              mimeType: file.type,
              bytes,
            });
            if (result.ok) {
              setPendingAttachments((prev) => [...prev, result.ref]);
            } else {
              pushAttachmentError(`${file.name}：${result.message}`);
            }
          } catch (err) {
            pushAttachmentError(`${file.name}：${err instanceof Error ? err.message : String(err)}`);
          } finally {
            setUploadingCount((n) => Math.max(0, n - 1));
          }
        }),
      );
    } catch {
      // allSettled 不会抛，这里兜底防止状态计数泄漏
      setUploadingCount(0);
    }
  }

  function removeAttachment(path: string): void {
    setPendingAttachments((prev) => prev.filter((a) => a.path !== path));
  }

  function onPickFiles(): void {
    fileInputRef.current?.click();
  }

  function onFileInputChange(e: ChangeEvent<HTMLInputElement>): void {
    if (e.target.files) void handleFiles(e.target.files);
    e.target.value = ''; // 同一文件再选要触发 change
  }

  function onDragEnter(e: DragEvent<HTMLDivElement>): void {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepthRef.current += 1;
    setIsDragging(true);
  }
  function onDragOver(e: DragEvent<HTMLDivElement>): void {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }
  function onDragLeave(e: DragEvent<HTMLDivElement>): void {
    if (!hasFiles(e)) return;
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDragging(false);
  }
  function onDrop(e: DragEvent<HTMLDivElement>): void {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepthRef.current = 0;
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void handleFiles(e.dataTransfer.files);
    }
  }

  async function onMicClick(): Promise<void> {
    if (recording) return;
    setRecording(true);
    setError(null);
    try {
      const outcome = await window.muicv.audio.recordAndTranscribe({ durationLimitSec: 180 });
      if (!outcome.ok) {
        if (outcome.reason !== 'cancel') setError(outcome.message);
        return;
      }
      // 默认填入 textarea 让用户编辑后再按发送；空 input 直接放，已有内容追加
      setInput((prev) => (prev.trim() ? `${prev.trim()} ${outcome.result.transcript}` : outcome.result.transcript));
    } finally {
      setRecording(false);
    }
  }

  function handleErrorChunk(message: string, assistantId: string) {
    const kind = classifyError(message);
    if (kind === 'ai-not-configured') {
      setNeedsAiSetup(true);
      appendAssistantText(assistantId, '⚠️ AI 服务还没连上 — 看一下下面的引导');
      setError(null);
    } else if (kind === 'no-profile') {
      setError('当前没有简历资料夹，先去设置新建一份。');
      appendAssistantText(assistantId, '⚠️ 没有简历资料夹');
    } else {
      setError(message);
      appendAssistantText(assistantId, `\n\n⚠️ ${message}`);
    }
  }

  if (!session || !activeProfile) {
    return (
      <CenteredCard
        title="先建一份职业档案"
        body="在左栏点 + 新建职业档案 就能开始啦。"
        ctaLabel="去设置 →"
        onCta={() => setView('settings')}
      />
    );
  }

  if (!activeConversation) {
    return <NoConversationCard />;
  }

  const meta = CONVERSATION_TYPE_META[activeConversation.type];
  const messages = activeConversation.messages;
  const busy = activeChannel !== null;

  async function onSend() {
    const text = input.trim();
    const attachments = pendingAttachments;
    // 允许"光发附件不打字"——附件 footer 已经能让 agent 知道做啥
    if (!text && attachments.length === 0) return;
    if (busy) return;
    if (!activeProfile || !activeConversation) return;
    setError(null);
    setNeedsAiSetup(false);

    const footer = formatAttachmentsFooter(attachments);
    const userContent = text ? `${text}${footer}` : footer.replace(/^\n\n/, '');
    const userMsg = {
      id: cryptoRandomId(),
      role: 'user' as const,
      content: userContent,
      createdAt: Date.now(),
      ...(attachments.length > 0 ? { attachments } : {}),
    };
    const assistantId = cryptoRandomId();
    const assistantMsg = {
      id: assistantId,
      role: 'assistant' as const,
      content: '',
      toolCalls: [] as ToolCallRecord[],
      artifacts: [] as ArtifactRef[],
      createdAt: Date.now(),
    };
    pushMessage(userMsg);
    pushMessage(assistantMsg);
    setInput('');
    setPendingAttachments([]);

    try {
      const { channelId } = await window.muicv.agent.chat({
        profileId: activeProfile.id,
        convId: activeConversation.id,
        type: activeConversation.type,
        messages: [...messages, userMsg],
      });
      setActiveChannel(channelId);

      const handler = (e: Event) => {
        const chunk = (e as CustomEvent<AgentChunk>).detail;
        switch (chunk.type) {
          case 'text-delta':
            appendAssistantText(assistantId, chunk.delta);
            break;
          case 'message-completed':
            break;
          case 'tool-called':
            attachToolCall(assistantId, {
              id: chunk.toolCallId,
              name: chunk.toolName,
              input: safeParseJson(chunk.argsJson),
            });
            break;
          case 'tool-output':
            updateToolOutput(assistantId, chunk.toolCallId, chunk.output);
            break;
          case 'artifact': {
            const artifact: ArtifactRef = {
              kind: chunk.kind,
              path: chunk.path,
              title: chunk.title,
              source: chunk.source,
            };
            attachArtifact(assistantId, artifact);
            // 写盘类工件（用户的产物）自动开右栏预览，让用户立即看到结果
            // 读取类（参考资料）只是过程信息，不打扰用户当前视图
            if (chunk.source === 'write') {
              openRightPanel(chunk.path);
            }
            break;
          }
          case 'error':
            handleErrorChunk(chunk.message, assistantId);
            break;
          case 'finish':
            window.removeEventListener(`muicv:agent:chunk:${channelId}`, handler);
            setActiveChannel(null);
            break;
        }
      };
      window.addEventListener(`muicv:agent:chunk:${channelId}`, handler);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      handleErrorChunk(msg, assistantId);
      setActiveChannel(null);
    }
  }

  function onAbort() {
    if (activeChannel) void window.muicv.agent.abort(activeChannel);
  }

  const TypeIcon = CONVERSATION_TYPE_ICON[activeConversation.type];

  const canSend = (input.trim().length > 0 || pendingAttachments.length > 0) && uploadingCount === 0;

  return (
    <div
      className="relative flex h-full flex-col"
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <ConversationHeader
        title={stripLeadingEmoji(activeConversation.title)}
        TypeIcon={TypeIcon}
        typeLabel={meta.label}
      />

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          {messages.length === 0 ? (
            <EmptyConversation type={activeConversation.type} />
          ) : (
            messages.map((m) => (
              <MessageBubble
                key={m.id}
                role={m.role}
                content={m.content}
                toolCalls={m.toolCalls}
                artifacts={m.artifacts}
                onOpenArtifact={(a) => openRightPanel(a.path)}
                onPathClick={(p) => openRightPanel(resolveWorkspacePath(activeProfile?.dir ?? null, p))}
              />
            ))
          )}
          {needsAiSetup && (
            <AiSetupCard onGoSettings={() => setView('settings')} onDismiss={() => setNeedsAiSetup(false)} />
          )}
        </div>
      </div>

      <div className="border-t border-rule bg-cream/85 px-6 py-4 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl flex-col gap-2">
          {error && (
            <p role="alert" className="text-[12px] text-tongue">
              {error}
            </p>
          )}
          {attachmentErrors.length > 0 && (
            <div className="flex flex-col gap-1">
              {attachmentErrors.map((e) => (
                <p key={e.id} role="alert" className="text-[12px] text-tongue">
                  {e.message}
                </p>
              ))}
            </div>
          )}
          {(pendingAttachments.length > 0 || uploadingCount > 0) && (
            <div className="flex flex-wrap gap-1.5">
              {pendingAttachments.map((a) => (
                <AttachmentChip key={a.path} attachment={a} onRemove={() => removeAttachment(a.path)} />
              ))}
              {uploadingCount > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-rule bg-paper px-2.5 py-1 text-[12px] text-ink-soft">
                  <SpinnerGapIcon size={12} weight="bold" className="animate-spin" />
                  上传中…（{uploadingCount}）
                </span>
              )}
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ATTACHMENT_ACCEPT}
            className="hidden"
            onChange={onFileInputChange}
          />
          <div className="flex items-end gap-2 rounded-2xl border-2 border-rule-strong bg-cream p-2 transition focus-within:border-ink">
            <button
              type="button"
              onClick={() => void onMicClick()}
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
              onClick={onPickFiles}
              disabled={busy || pendingAttachments.length >= MAX_ATTACHMENTS_PER_SEND}
              title={`上传附件（PDF / DOCX / Markdown / 文本，单文件 ≤ 20MB，单次最多 ${MAX_ATTACHMENTS_PER_SEND} 个）`}
              className="press-ink inline-flex shrink-0 items-center justify-center rounded-lg border-2 border-rule-strong bg-cream p-2 text-ink transition hover:border-ink disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="上传附件"
            >
              <PaperclipIcon size={18} weight="regular" />
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void onSend();
              }}
              placeholder={meta.placeholder}
              disabled={busy}
              rows={2}
              className="flex-1 resize-none rounded-lg bg-transparent px-3 py-2 text-[14px] text-ink placeholder:text-mute focus:outline-none disabled:opacity-60"
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
                onClick={() => void onSend()}
                disabled={!canSend}
                className="press shrink-0 rounded-lg bg-yellow px-3.5 py-2 text-[13px] font-bold text-ink disabled:cursor-not-allowed disabled:opacity-60"
              >
                发送 ⌘↵
              </button>
            )}
          </div>
        </div>
      </div>

      {isDragging && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-cream/85 backdrop-blur-sm">
          <div className="rounded-2xl border-4 border-dashed border-yellow-deep bg-cream/90 px-8 py-6 text-center">
            <p className="text-[15px] font-bold text-ink">把文件松开就行 📎</p>
            <p className="mt-1 text-[12px] text-ink-soft">
              支持 PDF / DOCX / Markdown / 文本，单次最多 {MAX_ATTACHMENTS_PER_SEND} 个
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function AttachmentChip({ attachment: a, onRemove }: { attachment: AttachmentRef; onRemove: () => void }) {
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

function hasFiles(e: DragEvent): boolean {
  const types = e.dataTransfer?.types;
  if (!types) return false;
  return Array.from(types).includes('Files');
}

function ConversationHeader({
  title,
  TypeIcon,
  typeLabel,
}: {
  title: string;
  TypeIcon: import('@phosphor-icons/react').Icon;
  typeLabel: string;
}) {
  return (
    <header className="flex shrink-0 items-center gap-3 border-b border-rule bg-cream/70 px-6 py-3 backdrop-blur-sm">
      <h1 className="min-w-0 flex-1 truncate text-[14px] font-extrabold text-ink">{title}</h1>
      <span className="inline-flex items-center gap-1 rounded-full border border-rule bg-paper px-2 py-0.5 font-mono text-[10.5px] font-semibold text-ink-soft">
        <TypeIcon size={11} className="shrink-0 text-yellow-deep" />
        <span>{typeLabel}</span>
      </span>
    </header>
  );
}
