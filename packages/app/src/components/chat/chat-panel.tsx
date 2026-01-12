'use client';

import type { ChangeEvent, KeyboardEvent } from 'react';
import { useMemo, useState } from 'react';

import type { ChatMessage } from '@muicv/shared';
import { Button, Input } from '@muicv/ui';
import { ResumeContextBar } from './resume-context-bar';

export type ChatPanelProps = {
  conversationId: string | undefined;
  contextResumeId: string | null;
  messages: ChatMessage[] | undefined;
  isLoadingMessages: boolean;
  isSendingMessage: boolean;
  errorMessage: string | undefined;
  onClearError(): void;
  onSendMessage(content: string): Promise<void>;
  onStop(): Promise<void>;
  onRetry(): Promise<void>;
  onUpdatedConversations(): Promise<void> | void;
};

function formatMessageRole(role: ChatMessage['role']) {
  return role === 'user' ? '你' : role === 'assistant' ? 'AI' : role;
}

export function ChatPanel(props: ChatPanelProps) {
  const [draft, setDraft] = useState('');

  const isRetryVisibleInError = useMemo(() => {
    if (!props.conversationId) return false;
    if (props.isSendingMessage) return false;
    return Boolean(props.errorMessage);
  }, [props.conversationId, props.errorMessage, props.isSendingMessage]);

  const activeMessages = props.messages ?? [];
  const canRetry = Boolean(props.conversationId) && !props.isSendingMessage && activeMessages.length > 0;

  function handleDraftChange(event: ChangeEvent<HTMLInputElement>) {
    if (props.errorMessage) props.onClearError();
    setDraft(event.target.value);
  }

  function handleDraftKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    void handleSend();
  }

  async function handleSend() {
    const content = draft.trim();
    if (!content) return;
    setDraft('');
    await props.onSendMessage(content);
  }

  return (
    <section className="col-span-6 flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-sm font-semibold">对话区</h1>
        <ResumeContextBar
          conversationId={props.conversationId}
          contextResumeId={props.contextResumeId}
          onUpdated={props.onUpdatedConversations}
        />
      </div>

      <div className="flex-1 space-y-3 overflow-auto rounded-lg border border-border bg-background p-3">
        {!props.conversationId && (
          <div className="text-sm text-muted-foreground">你可以直接输入内容发送，我会自动为你创建一个对话。</div>
        )}

        {props.conversationId && props.isLoadingMessages && (
          <div className="text-sm text-muted-foreground">加载消息中...</div>
        )}

        {props.conversationId && !props.isLoadingMessages && activeMessages.length === 0 && (
          <div className="text-sm text-muted-foreground">
            还没有消息，先讲讲你最近一段经历、目标岗位、以及你最自豪的项目。
          </div>
        )}

        {activeMessages.map((message) => {
          const isUser = message.role === 'user';
          return (
            <div
              key={message.id}
              className={
                'rounded-lg border px-3 py-2 text-sm ' +
                (isUser
                  ? 'ml-auto w-[85%] border-border bg-secondary text-secondary-foreground'
                  : 'mr-auto w-[85%] border-border bg-card text-card-foreground')
              }
            >
              <div className="mb-1 text-xs text-muted-foreground">{formatMessageRole(message.role)}</div>
              <div className="whitespace-pre-wrap">{message.content}</div>
            </div>
          );
        })}
      </div>

      {props.errorMessage && (
        <div className="rounded-lg border border-destructive/24 bg-destructive/8 px-3 py-2 text-sm text-destructive-foreground">
          <div>{props.errorMessage}</div>
          {isRetryVisibleInError && (
            <div className="mt-2 flex items-center gap-2">
              <Button size="sm" variant="secondary" type="button" onClick={() => void props.onRetry()}>
                重试
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Input
          value={draft}
          placeholder="输入你的经历 / 目标岗位 / 想改进的点..."
          onChange={handleDraftChange}
          onKeyDown={handleDraftKeyDown}
          disabled={props.isSendingMessage}
        />

        {props.isSendingMessage ? (
          <Button type="button" variant="secondary" onClick={() => void props.onStop()}>
            停止
          </Button>
        ) : (
          <>
            <Button type="button" onClick={() => void handleSend()}>
              发送
            </Button>
            <Button type="button" variant="secondary" onClick={() => void props.onRetry()} disabled={!canRetry}>
              重试
            </Button>
          </>
        )}
      </div>
    </section>
  );
}
