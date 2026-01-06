'use client';

import type { ChangeEvent, KeyboardEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';

import type { ChatMessage, Conversation } from '@muicv/shared';
import { Button, Input } from '@muicv/ui';
import { useChatStore } from '@/src/store/chat-store';

function formatConversationTitle(conversation: Conversation) {
  const title = conversation.title.trim();
  return title ? title : '新对话';
}

function formatMessageRole(role: ChatMessage['role']) {
  return role === 'user' ? '你' : role === 'assistant' ? 'AI' : role;
}

export function ChatShell() {
  const conversations = useChatStore((state) => state.conversations);
  const activeConversationId = useChatStore((state) => state.activeConversationId);
  const messagesByConversationId = useChatStore((state) => state.messagesByConversationId);
  const isLoadingConversations = useChatStore((state) => state.isLoadingConversations);
  const isLoadingMessagesByConversationId = useChatStore((state) => state.isLoadingMessagesByConversationId);
  const isSendingMessage = useChatStore((state) => state.isSendingMessage);
  const errorMessage = useChatStore((state) => state.errorMessage);
  const clearError = useChatStore((state) => state.clearError);
  const loadConversations = useChatStore((state) => state.loadConversations);
  const setActiveConversationId = useChatStore((state) => state.setActiveConversationId);
  const createNewConversation = useChatStore((state) => state.createConversation);
  const renameConversation = useChatStore((state) => state.renameConversation);
  const deleteConversation = useChatStore((state) => state.deleteConversation);
  const sendUserMessage = useChatStore((state) => state.sendUserMessage);

  const [draft, setDraft] = useState('');
  const [editingConversationId, setEditingConversationId] = useState<string | undefined>(undefined);
  const [draftTitle, setDraftTitle] = useState('');
  const [isSavingTitle, setIsSavingTitle] = useState(false);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  const activeMessages = useMemo(() => {
    if (!activeConversationId) return undefined;
    return messagesByConversationId[activeConversationId];
  }, [activeConversationId, messagesByConversationId]);

  const isLoadingActiveMessages = useMemo(() => {
    if (!activeConversationId) return false;
    return Boolean(isLoadingMessagesByConversationId[activeConversationId]);
  }, [activeConversationId, isLoadingMessagesByConversationId]);

  function handleCreateConversation() {
    setEditingConversationId(undefined);
    setDraftTitle('');
    void createNewConversation();
  }

  function handleSelectConversation(conversationId: string) {
    setEditingConversationId(undefined);
    setDraftTitle('');
    void setActiveConversationId(conversationId);
  }

  function handleDraftChange(event: ChangeEvent<HTMLInputElement>) {
    if (errorMessage) clearError();
    setDraft(event.target.value);
  }

  function handleSend() {
    const content = draft.trim();
    if (!content) return;

    setDraft('');
    void sendUserMessage(content);
  }

  function handleDraftKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    handleSend();
  }

  function handleStartEditingConversation(conversation: Conversation) {
    setEditingConversationId(conversation.id);
    setDraftTitle(conversation.title);
  }

  function handleCancelEditingConversation() {
    setEditingConversationId(undefined);
    setDraftTitle('');
    setIsSavingTitle(false);
  }

  async function handleSaveEditingConversation() {
    if (!editingConversationId) return;

    const title = draftTitle.trim();
    setIsSavingTitle(true);
    try {
      await renameConversation(editingConversationId, title);
      if (title) {
        handleCancelEditingConversation();
      }
    } catch {
      // 错误消息由 store 统一处理并在左侧区域展示。
    } finally {
      setIsSavingTitle(false);
    }
  }

  async function handleDeleteConversation(conversationId: string) {
    if (!window.confirm('确定删除这个对话吗？')) return;

    if (conversationId === editingConversationId) {
      handleCancelEditingConversation();
    }

    await deleteConversation(conversationId);
  }

  function handleDraftTitleChange(event: ChangeEvent<HTMLInputElement>) {
    if (errorMessage) clearError();
    setDraftTitle(event.target.value);
  }

  function handleDraftTitleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      handleCancelEditingConversation();
      return;
    }

    if (event.key !== 'Enter') return;
    event.preventDefault();
    void handleSaveEditingConversation();
  }

  return (
    <main className="mx-auto grid min-h-screen max-w-6xl grid-cols-12 gap-4 p-6">
      <aside className="col-span-3 flex flex-col gap-3 rounded-xl border border-border bg-card p-3">
        <div className="flex items-center justify-between gap-2 px-1">
          <h2 className="text-sm font-semibold">对话</h2>
          <Button size="sm" type="button" variant="secondary" onClick={handleCreateConversation}>
            新建
          </Button>
        </div>

        <div className="flex-1 space-y-1 overflow-auto">
          {isLoadingConversations && <div className="px-2 py-3 text-sm text-muted-foreground">加载中...</div>}

          {!isLoadingConversations && conversations.length === 0 && (
            <div className="px-2 py-3 text-sm text-muted-foreground">还没有对话，先点右上角「新建」开始。</div>
          )}

          {conversations.map((conversation) => {
            const isActive = conversation.id === activeConversationId;
            const isEditing = conversation.id === editingConversationId;
            return (
              <div key={conversation.id} className="flex items-center gap-1">
                {isEditing ? (
                  <Input
                    value={draftTitle}
                    className="h-9 flex-1"
                    onChange={handleDraftTitleChange}
                    onKeyDown={handleDraftTitleKeyDown}
                  />
                ) : (
                  <Button
                    type="button"
                    variant={isActive ? 'secondary' : 'ghost'}
                    className="h-9 flex-1 justify-start px-2"
                    onClick={() => handleSelectConversation(conversation.id)}
                  >
                    {formatConversationTitle(conversation)}
                  </Button>
                )}

                {isEditing ? (
                  <>
                    <Button
                      size="xs"
                      variant="secondary"
                      onClick={handleSaveEditingConversation}
                      disabled={isSavingTitle}
                    >
                      保存
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={handleCancelEditingConversation}
                      disabled={isSavingTitle}
                    >
                      取消
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="xs" variant="ghost" onClick={() => handleStartEditingConversation(conversation)}>
                      改名
                    </Button>
                    <Button size="xs" variant="ghost" onClick={() => void handleDeleteConversation(conversation.id)}>
                      删除
                    </Button>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {errorMessage && (
          <div className="rounded-lg border border-destructive/24 bg-destructive/8 px-3 py-2 text-sm text-destructive-foreground">
            {errorMessage}
          </div>
        )}
      </aside>

      <section className="col-span-6 flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-sm font-semibold">对话区</h1>
          <div className="text-xs text-muted-foreground">{activeConversationId ? '已选择对话' : '未选择对话'}</div>
        </div>

        <div className="flex-1 space-y-3 overflow-auto rounded-lg border border-border bg-background p-3">
          {!activeConversationId && (
            <div className="text-sm text-muted-foreground">你可以直接输入内容发送，我会自动为你创建一个对话。</div>
          )}

          {activeConversationId && isLoadingActiveMessages && (
            <div className="text-sm text-muted-foreground">加载消息中...</div>
          )}

          {activeConversationId && !isLoadingActiveMessages && (activeMessages?.length ?? 0) === 0 && (
            <div className="text-sm text-muted-foreground">
              还没有消息，先讲讲你最近一段经历、目标岗位、以及你最自豪的项目。
            </div>
          )}

          {(activeMessages ?? []).map((message) => {
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

        <div className="flex items-center gap-2">
          <Input
            value={draft}
            placeholder="输入你的经历 / 目标岗位 / 想改进的点..."
            onChange={handleDraftChange}
            onKeyDown={handleDraftKeyDown}
          />
          <Button type="button" onClick={handleSend} disabled={isSendingMessage}>
            {isSendingMessage ? '发送中...' : '发送'}
          </Button>
        </div>
      </section>

      <aside className="col-span-3 rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">简历预览</h2>
        <div className="mt-3 space-y-2 text-sm text-muted-foreground">
          <div className="rounded-md border border-border bg-background p-3">这里会实时渲染 ResumeJson</div>
          <div className="rounded-md border border-border bg-background p-3">并支持导出 Markdown/HTML</div>
        </div>
      </aside>
    </main>
  );
}
