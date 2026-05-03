import { StopIcon } from '@phosphor-icons/react';
import { useState } from 'react';

import { type AgentChunk, type ArtifactRef, CONVERSATION_TYPE_META, type ToolCallRecord } from '../../shared/types.ts';
import { CONVERSATION_TYPE_ICON } from '../lib/conversation-type-icon';
import { useAppStore } from '../lib/store';
import { AiSetupCard, CenteredCard, EmptyConversation, NoConversationCard } from './chat-empty-states';
import { MessageBubble } from './chat-message-bubble';
import { classifyError, cryptoRandomId, resolveWorkspacePath, safeParseJson } from './chat-utils';

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
    if (!text || busy) return;
    if (!activeProfile || !activeConversation) return;
    setError(null);
    setNeedsAiSetup(false);

    const userMsg = {
      id: cryptoRandomId(),
      role: 'user' as const,
      content: text,
      createdAt: Date.now(),
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

  return (
    <div className="flex h-full flex-col">
      <ConversationHeader title={activeConversation.title} TypeIcon={TypeIcon} typeLabel={meta.label} />

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
          <div className="flex items-end gap-2 rounded-2xl border-2 border-rule-strong bg-cream p-2 transition focus-within:border-ink">
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
                disabled={!input.trim()}
                className="press shrink-0 rounded-lg bg-yellow px-3.5 py-2 text-[13px] font-bold text-ink disabled:cursor-not-allowed disabled:opacity-60"
              >
                发送 ⌘↵
              </button>
            )}
          </div>
        </div>
      </div>
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
