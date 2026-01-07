'use client';

import type { ChangeEvent, KeyboardEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';

import type { ChatMessage, Conversation } from '@muicv/shared';
import { Button, Input } from '@muicv/ui';
import { useChatStore } from '@/src/store/chat-store';
import { useResumeStore } from '@/src/store/resume-store';

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

  const resume = useResumeStore((state) => state.current);
  const resumeSnapshots = useResumeStore((state) => state.snapshots);
  const resumeRetentionLimit = useResumeStore((state) => state.retentionLimit);
  const isLoadingResume = useResumeStore((state) => state.isLoading);
  const resumeErrorMessage = useResumeStore((state) => state.errorMessage);
  const currentResumeSnapshotId = useResumeStore((state) => state.currentSnapshotId);
  const rollbackSnapshot = useResumeStore((state) => state.rollbackSnapshot);
  const isRollingBackSnapshotId = useResumeStore((state) => state.isRollingBackSnapshotId);
  const loadResume = useResumeStore((state) => state.loadResume);

  const [draft, setDraft] = useState('');
  const [editingConversationId, setEditingConversationId] = useState<string | undefined>(undefined);
  const [draftTitle, setDraftTitle] = useState('');
  const [isSavingTitle, setIsSavingTitle] = useState(false);

  useEffect(() => {
    void loadConversations();
    void loadResume();
  }, [loadConversations, loadResume]);

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

  function handleDraftKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    void handleSend();
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

  function formatResumeSnapshotTime(value: string) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN');
  }

  async function handleSend() {
    const content = draft.trim();
    if (!content) return;

    setDraft('');
    await sendUserMessage(content);
    await loadResume();
  }

  async function handleRollbackSnapshot(snapshotId: string) {
    if (!window.confirm('确定回滚到这个版本吗？回滚会生成一个新版本，旧版本仍会保留在列表中。')) return;
    await rollbackSnapshot(snapshotId);
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
          <Button type="button" onClick={() => void handleSend()} disabled={isSendingMessage}>
            {isSendingMessage ? '发送中...' : '发送'}
          </Button>
        </div>
      </section>

      <aside className="col-span-3 rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">简历预览</h2>
        <div className="mt-3 space-y-3 text-sm">
          {isLoadingResume && <div className="text-sm text-muted-foreground">加载简历中...</div>}

          {resumeErrorMessage && (
            <div className="rounded-lg border border-destructive/24 bg-destructive/8 px-3 py-2 text-sm text-destructive-foreground">
              {resumeErrorMessage}
            </div>
          )}

          {!isLoadingResume && !resume && (
            <div className="rounded-md border border-border bg-background p-3 text-muted-foreground">
              还没有简历信息。你可以在对话里介绍你的经历与技能，我会自动帮你记录并生成版本。
            </div>
          )}

          {resume && (
            <div className="rounded-md border border-border bg-background p-3">
              <div className="text-xs text-muted-foreground">基础信息</div>
              <div className="mt-2 space-y-1">
                <div>{resume.basicInfo.fullName ? `姓名：${resume.basicInfo.fullName}` : '姓名：未填写'}</div>
                {resume.basicInfo.headline && <div>标题：{resume.basicInfo.headline}</div>}
                {resume.basicInfo.location && <div>地点：{resume.basicInfo.location}</div>}
                {resume.basicInfo.email && <div>Email：{resume.basicInfo.email}</div>}
              </div>

              <div className="mt-3 text-xs text-muted-foreground">技能</div>
              <div className="mt-2">
                {(resume.skills ?? []).length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {(resume.skills ?? []).map((skill) => (
                      <span key={skill} className="rounded-md border border-border bg-card px-2 py-0.5 text-xs">
                        {skill}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="text-muted-foreground">未填写</div>
                )}
              </div>

              {resume.summary && (
                <>
                  <div className="mt-3 text-xs text-muted-foreground">总结</div>
                  <div className="mt-2 whitespace-pre-wrap text-sm">{resume.summary}</div>
                </>
              )}
            </div>
          )}

          <div className="rounded-md border border-border bg-background p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs text-muted-foreground">版本（保留最近 {resumeRetentionLimit} 个）</div>
              <Button size="xs" variant="secondary" type="button" onClick={() => void loadResume()}>
                刷新
              </Button>
            </div>

            <div className="mt-2 space-y-2">
              {resumeSnapshots.length === 0 && <div className="text-muted-foreground">暂无版本</div>}

              {resumeSnapshots.map((snapshot) => {
                const isCurrent = snapshot.id === currentResumeSnapshotId;
                const isRollingBack = snapshot.id === isRollingBackSnapshotId;
                return (
                  <div
                    key={snapshot.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-border p-2"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-xs">{formatResumeSnapshotTime(snapshot.createdAt)}</div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {isCurrent ? '当前版本' : '历史版本'} · {snapshot.id.slice(0, 8)}
                      </div>
                    </div>

                    <Button
                      size="xs"
                      type="button"
                      variant="ghost"
                      disabled={isCurrent || Boolean(isRollingBackSnapshotId)}
                      onClick={() => void handleRollbackSnapshot(snapshot.id)}
                    >
                      {isRollingBack ? '回滚中...' : '回滚'}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </aside>
    </main>
  );
}
