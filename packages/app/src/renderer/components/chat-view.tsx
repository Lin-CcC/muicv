import { useState } from 'react';

import { type AgentChunk, type ArtifactRef, CONVERSATION_TYPE_META, type ToolCallRecord } from '../../shared/types.ts';
import { useAppStore } from '../lib/store';
import { ArtifactCard } from './artifact-card';
import { CorgiMascot } from './corgi-mascot';
import { MarkdownView } from './markdown-view';

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

  function classifyError(raw: string): 'ai-not-configured' | 'no-profile' | 'plain' {
    if (!raw) return 'plain';
    if (raw === 'NOT_LOGGED_IN') return 'plain';
    if (raw === 'NO_PROFILE') return 'no-profile';
    if (/no-muirouter-link|402|muirouter|byok/i.test(raw)) return 'ai-not-configured';
    return 'plain';
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
    return (
      <div className="flex h-full items-center justify-center px-6">
        <div className="max-w-md text-center">
          <CorgiMascot className="mx-auto h-16 w-16" />
          <h2 className="mt-4 text-2xl font-extrabold text-ink">还没选对话</h2>
          <p className="mt-2 text-[13px] leading-[1.7] text-ink-soft">
            左栏点 <strong>+ 新建</strong> 选一种对话类型开始，或者点列表里某个对话切过去。
          </p>
        </div>
      </div>
    );
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
              input: safeParse(chunk.argsJson),
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

  return (
    <div className="flex h-full flex-col">
      <ConversationHeader title={activeConversation.title} typeLabel={`${meta.emoji} ${meta.label}`} />

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          {messages.length === 0 ? (
            <Empty type={activeConversation.type} />
          ) : (
            messages.map((m) => (
              <MessageBubble
                key={m.id}
                role={m.role}
                content={m.content}
                toolCalls={m.toolCalls}
                artifacts={m.artifacts}
                onOpenArtifact={(a) => openRightPanel(a.path)}
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
                className="press-ink shrink-0 rounded-lg border-2 border-ink bg-cream px-3.5 py-2 text-[13px] font-bold text-ink"
              >
                停 ◼︎
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

function ConversationHeader({ title, typeLabel }: { title: string; typeLabel: string }) {
  return (
    <header className="flex shrink-0 items-center gap-3 border-b border-rule bg-cream/70 px-6 py-3 backdrop-blur-sm">
      <h1 className="min-w-0 flex-1 truncate text-[14px] font-extrabold text-ink">{title}</h1>
      <span className="rounded-full border border-rule bg-paper px-2 py-0.5 font-mono text-[10.5px] font-semibold text-ink-soft">
        {typeLabel}
      </span>
    </header>
  );
}

function CenteredCard({
  title,
  body,
  ctaLabel,
  onCta,
}: {
  title: string;
  body: string;
  ctaLabel: string;
  onCta: () => void;
}) {
  return (
    <div className="flex h-full items-center justify-center px-6">
      <div className="max-w-md rounded-2xl border-2 border-ink bg-cream p-7 text-center shadow-[0_4px_0_0_var(--color-ink)]">
        <CorgiMascot className="mx-auto h-16 w-16" />
        <h2 className="mt-3 text-2xl font-extrabold text-ink">{title}</h2>
        <p className="mt-2 text-[13px] text-ink-soft">{body}</p>
        <button
          type="button"
          onClick={onCta}
          className="press mt-5 inline-flex rounded-lg bg-yellow px-5 py-2 text-[14px] font-bold text-ink"
        >
          {ctaLabel}
        </button>
      </div>
    </div>
  );
}

function Empty({ type }: { type: keyof typeof CONVERSATION_TYPE_META }) {
  const meta = CONVERSATION_TYPE_META[type];
  return (
    <div className="mt-10 flex flex-col items-center text-center">
      <span className="text-[40px]">{meta.emoji}</span>
      <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-ink">{meta.label}</h2>
      <p className="mt-2 max-w-md text-[13px] leading-[1.7] text-ink-soft">{meta.tagline}</p>
      <p className="mt-4 max-w-md text-[12px] text-mute">下面输入框直接说就行 —— 例：</p>
      <p className="mt-1 max-w-md text-[12px] text-ink-soft">
        "{meta.placeholder.replace(/^比如：/, '').replace(/^\「|\」$/g, '')}"
      </p>
    </div>
  );
}

function AiSetupCard({ onGoSettings, onDismiss }: { onGoSettings: () => void; onDismiss: () => void }) {
  return (
    <div className="rounded-2xl border-2 border-ink bg-fluff p-5 shadow-[0_4px_0_0_var(--color-ink)]">
      <div className="flex items-start gap-3">
        <CorgiMascot className="h-10 w-10 shrink-0" />
        <div className="flex-1">
          <h3 className="text-[16px] font-extrabold text-ink">AI 服务还没连上</h3>
          <p className="mt-1.5 text-[13px] leading-[1.6] text-ink-soft">
            Mui 需要联网调用 AI 才能帮你写简历。免费版当前需要连一下你自己的 AI 余额（叫
            muirouter，类似话费充值），或升级 Pro 会员后由我们提供。
          </p>
          <div className="mt-3.5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onGoSettings}
              className="press inline-flex items-center justify-center rounded-lg bg-yellow px-4 py-2 text-[13px] font-bold text-ink"
            >
              去设置完成 →
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-lg px-3 py-2 text-[12px] text-mute hover:text-ink"
            >
              先关掉
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  role,
  content,
  toolCalls,
  artifacts,
  onOpenArtifact,
}: {
  role: string;
  content: string;
  toolCalls?: ToolCallRecord[] | undefined;
  artifacts?: ArtifactRef[] | undefined;
  onOpenArtifact: (a: ArtifactRef) => void;
}) {
  const isUser = role === 'user';
  // 工件按 source 分两类：read = 过程参考资料（折叠到操作组里）/ write = 最终产物（显眼卡片）
  const readRefs = artifacts?.filter((a) => a.source === 'read') ?? [];
  const writeRefs = artifacts?.filter((a) => a.source === 'write') ?? [];
  const hasOps = (toolCalls?.length ?? 0) > 0 || readRefs.length > 0;
  const empty = !content && !hasOps && writeRefs.length === 0;

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] space-y-2 rounded-2xl px-4 py-3 text-[14px] leading-relaxed ${
          isUser ? 'border-2 border-ink bg-yellow text-ink' : 'border-2 border-rule bg-paper text-ink-soft'
        }`}
      >
        {/* 操作组：所有 tool call + 读取的参考资料折成一张可展开卡片 */}
        {!isUser && hasOps && <OpsGroup toolCalls={toolCalls ?? []} reads={readRefs} />}

        {/* assistant 内容用 markdown 渲染；user 内容保持原样（保留换行） */}
        {content &&
          (isUser ? (
            <div className="whitespace-pre-wrap">{content}</div>
          ) : (
            <MarkdownView source={content} className="text-ink-soft" />
          ))}

        {empty && (
          <span className="inline-flex items-center gap-2 text-mute">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-yellow" />
            思考中…
          </span>
        )}

        {/* 写盘类工件：最终产物，显眼卡片，点击在右栏预览 */}
        {writeRefs.length > 0 && (
          <div className="space-y-1.5 pt-1">
            {writeRefs.map((a, i) => (
              <ArtifactCard key={`${a.path}-${i}`} artifact={a} onOpen={() => onOpenArtifact(a)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 把 agent 的工具调用 + 读取过的参考资料聚合成一张折叠卡片，默认收起。
 * Header 只显示"调用了 N 个工具 / 读了 M 个文件"，点开看每条详情。
 * 减少噪音，让用户聚焦在最终输出 + 产物上。
 */
function OpsGroup({ toolCalls, reads }: { toolCalls: ToolCallRecord[]; reads: ArtifactRef[] }) {
  const [open, setOpen] = useState(false);
  // 进行中的最后一个工具：作为收起态的简要状态显示
  const inflight = toolCalls.find((c) => c.output === undefined);
  const summary = inflight ? `正在 ${inflight.name}…` : `调用了 ${toolCalls.length} 个工具`;

  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      className="rounded-md border border-rule bg-fluff/50"
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-2.5 py-1.5 text-[12px] text-mute">
        <span className={inflight ? 'animate-pulse text-yellow-deep' : 'text-yellow-deep'}>⚙</span>
        <span className="flex-1 truncate font-mono">{summary}</span>
        <span className="text-[10px]">{open ? '收起' : '展开'}</span>
      </summary>
      <div className="space-y-1 border-t border-rule px-2 py-2">
        {toolCalls.map((c) => (
          <ToolCallChip key={c.id} call={c} />
        ))}
        {reads.length > 0 && (
          <div className="mt-2 border-t border-rule pt-2">
            <p className="mb-1 px-1 text-[10.5px] text-mute">参考的素材：</p>
            <ul className="space-y-0.5">
              {reads.map((r, i) => (
                <li key={`${r.path}-${i}`} className="px-1 font-mono text-[11px] text-ink-soft">
                  📄 {r.title}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </details>
  );
}

function ToolCallChip({ call }: { call: ToolCallRecord }) {
  const [open, setOpen] = useState(false);
  const done = call.output !== undefined;
  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      className="rounded-md border border-rule bg-fluff/70"
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-2.5 py-1.5 font-mono text-[12px]">
        <span className={done ? 'text-yellow-deep' : 'text-mute'}>{done ? '✓' : '⏳'}</span>
        <span className="font-bold text-ink">{call.name}</span>
        <span className="truncate text-mute">{previewArgs(call.input)}</span>
      </summary>
      <div className="border-t border-rule px-2.5 py-2 font-mono text-[11.5px] leading-snug text-ink-soft">
        <div>
          <span className="text-mute">input:</span>
          <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap text-ink">
            {JSON.stringify(call.input, null, 2)}
          </pre>
        </div>
        {done && (
          <div className="mt-2">
            <span className="text-mute">output:</span>
            <pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap text-ink">{String(call.output)}</pre>
          </div>
        )}
      </div>
    </details>
  );
}

function previewArgs(input: unknown): string {
  if (input === null || input === undefined) return '';
  try {
    const s = typeof input === 'string' ? input : JSON.stringify(input);
    return s.length > 60 ? `${s.slice(0, 60)}…` : s;
  } catch {
    return '';
  }
}

function safeParse(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return json;
  }
}

function cryptoRandomId(): string {
  return crypto.randomUUID();
}
