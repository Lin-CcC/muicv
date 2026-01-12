'use client';

import type { ChangeEvent, KeyboardEvent } from 'react';
import { useState } from 'react';

import type { Conversation } from '@muicv/shared';
import { Button, Input } from '@muicv/ui';

export type ConversationSidebarProps = {
  conversations: Conversation[];
  activeConversationId: string | undefined;
  isLoadingConversations: boolean;
  errorMessage: string | undefined;
  onClearError(): void;
  onCreateConversation(): void;
  onSelectConversation(conversationId: string): void;
  onRenameConversation(conversationId: string, title: string): Promise<void>;
  onDeleteConversation(conversationId: string): Promise<void>;
};

function formatConversationTitle(conversation: Conversation) {
  const title = conversation.title.trim();
  return title ? title : '新对话';
}

export function ConversationSidebar(props: ConversationSidebarProps) {
  const [editingConversationId, setEditingConversationId] = useState<string | undefined>(undefined);
  const [draftTitle, setDraftTitle] = useState('');
  const [isSavingTitle, setIsSavingTitle] = useState(false);

  function handleCreateConversation() {
    setEditingConversationId(undefined);
    setDraftTitle('');
    props.onCreateConversation();
  }

  function handleSelectConversation(conversationId: string) {
    setEditingConversationId(undefined);
    setDraftTitle('');
    props.onSelectConversation(conversationId);
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
      await props.onRenameConversation(editingConversationId, title);
      if (title) {
        handleCancelEditingConversation();
      }
    } finally {
      setIsSavingTitle(false);
    }
  }

  async function handleDeleteConversation(conversationId: string) {
    if (!window.confirm('确定删除这个对话吗？')) return;

    if (conversationId === editingConversationId) {
      handleCancelEditingConversation();
    }

    await props.onDeleteConversation(conversationId);
  }

  function handleDraftTitleChange(event: ChangeEvent<HTMLInputElement>) {
    if (props.errorMessage) props.onClearError();
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
    <aside className="col-span-3 flex flex-col gap-3 rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2 px-1">
        <h2 className="text-sm font-semibold">对话</h2>
        <Button size="sm" type="button" variant="secondary" onClick={handleCreateConversation}>
          新建
        </Button>
      </div>

      <div className="flex-1 space-y-1 overflow-auto">
        {props.isLoadingConversations && <div className="px-2 py-3 text-sm text-muted-foreground">加载中...</div>}

        {!props.isLoadingConversations && props.conversations.length === 0 && (
          <div className="px-2 py-3 text-sm text-muted-foreground">还没有对话，先点右上角「新建」开始。</div>
        )}

        {props.conversations.map((conversation) => {
          const isActive = conversation.id === props.activeConversationId;
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
                    onClick={() => void handleSaveEditingConversation()}
                    disabled={isSavingTitle}
                  >
                    保存
                  </Button>
                  <Button size="xs" variant="ghost" onClick={handleCancelEditingConversation} disabled={isSavingTitle}>
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

      {props.errorMessage && (
        <div className="rounded-lg border border-destructive/24 bg-destructive/8 px-3 py-2 text-sm text-destructive-foreground">
          {props.errorMessage}
        </div>
      )}
    </aside>
  );
}
