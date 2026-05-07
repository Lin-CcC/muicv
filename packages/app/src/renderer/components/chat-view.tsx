import { useState } from 'react';

import { CONVERSATION_TYPE_META } from '../../shared/types.ts';
import { CONVERSATION_TYPE_ICON } from '../lib/conversation-type-icon';
import { useAppStore } from '../lib/store';
import { useAgentDispatch } from '../lib/use-agent-dispatch';
import { useChatAttachments } from '../lib/use-chat-attachments';
import { AiSetupCard, CenteredCard, EmptyConversation, NoConversationCard } from './chat-empty-states';
import { ChatInputBar } from './chat-input-bar';
import { MessageBubble } from './chat-message-bubble';
import { resolveWorkspacePath, stripLeadingEmoji } from './chat-utils';

/**
 * 中栏：当前 activeConversation 的对话流 + 输入框。
 *
 * 流程：
 *   1. 发送 → push user msg + 一条空 assistant msg 到 activeConversation.messages
 *   2. invoke('agent:chat', { profileId, convId, type, messages }) 拿 channelId
 *   3. addEventListener `muicv:agent:chunk:<channelId>` 累加增量；artifact chunk
 *      attach 到当前 assistant msg
 *   4. 'finish' / 'error' 解绑 + 解锁输入；main 已经把整份 conv flush 到磁盘
 *
 * 三个核心拆分点：
 *   - useChatAttachments：附件托盘状态 + drag-drop + 上传
 *   - useAgentDispatch：发消息 / 流监听 / 错误归类（含 ai-not-configured 分流）
 *   - ChatInputBar：底部输入面板（input 草稿 / mic / 附件按钮 / 发送 / slash 菜单）
 */
export function ChatView() {
  const session = useAppStore((s) => s.session);
  const activeProfile = useAppStore((s) => s.activeProfile);
  const activeConversation = useAppStore((s) => s.activeConversation);
  const setView = useAppStore((s) => s.setView);
  const openRightPanel = useAppStore((s) => s.openRightPanel);

  const [error, setError] = useState<string | null>(null);
  const [needsAiSetup, setNeedsAiSetup] = useState(false);

  const attachments = useChatAttachments(activeProfile, activeConversation?.id ?? null);
  const dispatch = useAgentDispatch({ onError: setError, onNeedsAiSetup: setNeedsAiSetup });

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
  const TypeIcon = CONVERSATION_TYPE_ICON[activeConversation.type];

  async function handleSend(text: string): Promise<void> {
    await dispatch.send(text, attachments.pendingAttachments);
    attachments.clearAfterSend();
  }

  return (
    <div
      className="relative flex h-full flex-col"
      onDragEnter={attachments.onDragEnter}
      onDragOver={attachments.onDragOver}
      onDragLeave={attachments.onDragLeave}
      onDrop={attachments.onDrop}
    >
      <ConversationHeader
        title={stripLeadingEmoji(activeConversation.title)}
        TypeIcon={TypeIcon}
        typeLabel={meta.label}
      />

      <div
        className="flex-1 overflow-y-auto px-6 py-6"
        onContextMenu={(e) => {
          // 拦下 Chromium 默认菜单，弹 native 只读菜单（复制 / 全选），方便从历史消息复制
          e.preventDefault();
          window.muicv.chatInput.showContextMenu({ editable: false });
        }}
      >
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

      <ChatInputBar
        contextKey={`${activeProfile.id}:${activeConversation.id}`}
        placeholder={meta.placeholder}
        busy={dispatch.busy}
        errorMessage={error}
        attachments={attachments}
        onMicError={setError}
        onSend={(text) => void handleSend(text)}
        onAbort={dispatch.abort}
      />

      {attachments.isDragging && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-cream/85 backdrop-blur-sm">
          <div className="rounded-2xl border-4 border-dashed border-yellow-deep bg-cream/90 px-8 py-6 text-center">
            <p className="text-[15px] font-bold text-ink">把文件松开就行 📎</p>
            <p className="mt-1 text-[12px] text-ink-soft">支持 PDF / DOCX / Markdown / 文本，单次最多 5 个</p>
          </div>
        </div>
      )}
    </div>
  );
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
