import { useState } from 'react';

import type { AgentChunk, ToolCallRecord } from '../../shared/types.ts';
import { useAppStore } from '../lib/store';
import { CorgiMascot } from './corgi-mascot';

/**
 * Phase 2 chat：调 main 进程 agent runtime，订阅 chunk event 流式渲染。
 *
 * 流程：
 *   1. 发送 → push user msg + 一条空 assistant msg
 *   2. invoke('agent:chat', messages) 拿 channelId
 *   3. addEventListener `muicv:agent:chunk:<channelId>` 累加增量
 *   4. 'finish' / 'error' 解绑 + 解锁输入
 */
export function ChatView() {
  // view 路由已经保证：未登录 → login，未选工作目录 → onboarding。
  // 这里仅作防御性 fallback。
  const ready = useAppStore((s) => !!s.config.workspaceDir && !!s.config.muicvApiKey && !!s.session);
  const setView = useAppStore((s) => s.setView);
  const messages = useAppStore((s) => s.messages);
  const pushMessage = useAppStore((s) => s.pushMessage);
  const appendAssistantText = useAppStore((s) => s.appendAssistantText);
  const attachToolCall = useAppStore((s) => s.attachToolCall);
  const updateToolOutput = useAppStore((s) => s.updateToolOutput);
  const resetMessages = useAppStore((s) => s.resetMessages);
  const activeChannel = useAppStore((s) => s.activeChannel);
  const setActiveChannel = useAppStore((s) => s.setActiveChannel);

  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <div className="max-w-md rounded-2xl border-2 border-ink bg-cream p-7 text-center shadow-[0_4px_0_0_var(--color-ink)]">
          <CorgiMascot className="mx-auto h-16 w-16" />
          <h2 className="mt-3 text-2xl font-extrabold text-ink">先来配两个东西</h2>
          <p className="mt-2 text-[13px] text-ink-soft">
            选工作目录 + 填 muirouter API key（可选填 muicv key）。1 分钟搞定。
          </p>
          <button
            type="button"
            onClick={() => setView('settings')}
            className="press mt-5 inline-flex rounded-lg bg-yellow px-5 py-2 text-[14px] font-bold text-ink"
          >
            去设置 →
          </button>
        </div>
      </div>
    );
  }

  const busy = activeChannel !== null;

  async function onSend() {
    const text = input.trim();
    if (!text || busy) return;
    setError(null);

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
      createdAt: Date.now(),
    };
    pushMessage(userMsg);
    pushMessage(assistantMsg);
    setInput('');

    try {
      const { channelId } = await window.muicv.agent.chat([
        ...messages.filter((m) => m.role === 'user' || m.role === 'assistant'),
        userMsg,
      ]);
      setActiveChannel(channelId);

      const handler = (e: Event) => {
        const chunk = (e as CustomEvent<AgentChunk>).detail;
        switch (chunk.type) {
          case 'text-delta':
            appendAssistantText(assistantId, chunk.delta);
            break;
          case 'message-completed':
            // 兜底：如果 text-delta 没传完整内容，用 message-completed 校正
            // 但我们 append 流时已是完整流，这里 noop 避免重复
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
          case 'error':
            setError(chunk.message);
            appendAssistantText(assistantId, `\n\n⚠️ ${chunk.message}`);
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
      setError(msg);
      appendAssistantText(assistantId, `\n\n⚠️ ${msg}`);
      setActiveChannel(null);
    }
  }

  function onAbort() {
    if (activeChannel) void window.muicv.agent.abort(activeChannel);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          {messages.length === 0 ? (
            <Empty />
          ) : (
            messages.map((m) => (
              <MessageBubble key={m.id} role={m.role} content={m.content} toolCalls={m.toolCalls} />
            ))
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
              placeholder="跟 Mui 说说你的求职目标，比如：「帮我准备一份针对 Google L5 的简历」"
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
          {messages.length > 0 && !busy && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => resetMessages()}
                className="text-[12px] text-mute hover:text-ink"
              >
                清空对话
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Empty() {
  return (
    <div className="mt-12 flex flex-col items-center text-center">
      <CorgiMascot className="h-20 w-20" />
      <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-ink">汪？(在等你)</h2>
      <p className="mt-2 max-w-sm text-[13px] text-ink-soft">
        告诉 Mui 你想做什么。
        <br />
        准备简历、抓 JD、生成 PDF、写 cover letter —— 一句话开始。
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2 text-[12px]">
        {['帮我准备简历', '我来介绍下我自己', '看看我现有的素材', '生成一份针对 Google 的简历'].map((s) => (
          <span key={s} className="rounded-full border border-rule bg-paper px-3 py-1 text-ink-soft">
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({
  role,
  content,
  toolCalls,
}: {
  role: string;
  content: string;
  toolCalls?: ToolCallRecord[];
}) {
  const isUser = role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] space-y-2 rounded-2xl px-4 py-3 text-[14px] leading-relaxed ${
          isUser ? 'border-2 border-ink bg-yellow text-ink' : 'border-2 border-rule bg-paper text-ink-soft'
        }`}
      >
        {toolCalls && toolCalls.length > 0 && (
          <div className="space-y-1">
            {toolCalls.map((c) => (
              <ToolCallChip key={c.id} call={c} />
            ))}
          </div>
        )}
        {content && <div className="whitespace-pre-wrap">{content}</div>}
        {!content && (!toolCalls || toolCalls.length === 0) && (
          <span className="inline-flex items-center gap-2 text-mute">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-yellow" />
            思考中…
          </span>
        )}
      </div>
    </div>
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
      <summary className="flex cursor-pointer list-none items-center gap-2 px-2.5 py-1.5 text-[12px] font-mono">
        <span className={done ? 'text-yellow-deep' : 'text-mute'}>{done ? '✓' : '⏳'}</span>
        <span className="font-bold text-ink">{call.name}</span>
        <span className="truncate text-mute">{previewArgs(call.input)}</span>
      </summary>
      <div className="border-t border-rule px-2.5 py-2 font-mono text-[11.5px] leading-snug text-ink-soft">
        <div>
          <span className="text-mute">input:</span>
          <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap text-ink">{JSON.stringify(call.input, null, 2)}</pre>
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
