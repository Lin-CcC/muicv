import { useState } from 'react';

import { useAppStore } from '../lib/store';
import { CorgiMascot } from './corgi-mascot';

/**
 * Phase 1：chat shell —— 渲染消息 + 输入框；后端 agent 还没接，
 * 提交时显示占位回复 "（agent runtime 还没实现，Phase 2 上线）"。
 */
export function ChatView() {
  const ready = useAppStore((s) => !!s.config.workspaceDir && !!s.config.muirouterKey);
  const setView = useAppStore((s) => s.setView);
  const messages = useAppStore((s) => s.messages);
  const pushMessage = useAppStore((s) => s.pushMessage);
  const resetMessages = useAppStore((s) => s.resetMessages);

  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
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

  async function onSend() {
    const text = input.trim();
    if (!text) return;
    setError(null);
    pushMessage({
      id: cryptoRandomId(),
      role: 'user',
      content: text,
      createdAt: Date.now(),
    });
    setInput('');
    setBusy(true);
    try {
      // Phase 2 之前打个占位回复
      await window.muicv.agent.chat([{ id: 'x', role: 'user', content: text, createdAt: Date.now() }]).catch((err) => {
        throw err instanceof Error ? err : new Error(String(err));
      });
    } catch (err) {
      pushMessage({
        id: cryptoRandomId(),
        role: 'assistant',
        content: `⚠️ ${err instanceof Error ? err.message : String(err)}\n\n（Phase 1 只有骨架，agent runtime 在 Phase 2 上线。）`,
        createdAt: Date.now(),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* 消息区 */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          {messages.length === 0 ? (
            <Empty />
          ) : (
            messages.map((m) => <MessageBubble key={m.id} role={m.role} content={m.content} />)
          )}
        </div>
      </div>

      {/* 输入栏 */}
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
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') onSend();
              }}
              placeholder="跟 Mui 说说你的求职目标，比如：「帮我准备一份针对 Google L5 的简历」"
              disabled={busy}
              rows={2}
              className="flex-1 resize-none rounded-lg bg-transparent px-3 py-2 text-[14px] text-ink placeholder:text-mute focus:outline-none disabled:opacity-60"
            />
            <button
              type="button"
              onClick={onSend}
              disabled={busy || !input.trim()}
              className="press shrink-0 rounded-lg bg-yellow px-3.5 py-2 text-[13px] font-bold text-ink disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? '思考中…' : '发送 ⌘↵'}
            </button>
          </div>
          {messages.length > 0 && (
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
        {['帮我准备简历', '抓这个 JD: <url>', '针对 Google 写一份', '导出 PDF'].map((s) => (
          <span key={s} className="rounded-full border border-rule bg-paper px-3 py-1 text-ink-soft">
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ role, content }: { role: string; content: string }) {
  const isUser = role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-[14px] leading-relaxed whitespace-pre-wrap ${
          isUser
            ? 'border-2 border-ink bg-yellow text-ink'
            : 'border-2 border-rule bg-paper text-ink-soft'
        }`}
      >
        {content}
      </div>
    </div>
  );
}

function cryptoRandomId(): string {
  return crypto.randomUUID();
}
