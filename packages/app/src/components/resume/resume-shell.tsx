'use client';

import { useEffect, useMemo, useState } from 'react';

import type { ConversationId } from '@muicv/shared';
import { Button } from '@muicv/ui';
import { setConversationResumeContext } from '@/src/api-client/chat-api';
import { useChatStore } from '@/src/store/chat-store';
import { useResumeStore } from '@/src/store/resume-store';

function formatTimestamp(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN');
}

export function ResumeShell() {
  const conversations = useChatStore((state) => state.conversations);
  const activeConversationId = useChatStore((state) => state.activeConversationId);
  const loadConversations = useChatStore((state) => state.loadConversations);

  const resumes = useResumeStore((state) => state.resumes);
  const activeResumeId = useResumeStore((state) => state.activeResumeId);
  const activeResume = useResumeStore((state) => state.activeResume);
  const current = useResumeStore((state) => state.current);
  const versions = useResumeStore((state) => state.versions);
  const retentionLimit = useResumeStore((state) => state.retentionLimit);
  const isLoadingResumes = useResumeStore((state) => state.isLoadingResumes);
  const isLoadingActiveResume = useResumeStore((state) => state.isLoadingActiveResume);
  const isCreating = useResumeStore((state) => state.isCreating);
  const isGenerating = useResumeStore((state) => state.isGenerating);
  const isSaving = useResumeStore((state) => state.isSaving);
  const isRollingBackVersionId = useResumeStore((state) => state.isRollingBackVersionId);
  const draftText = useResumeStore((state) => state.draftText);
  const generatedPreview = useResumeStore((state) => state.generatedPreview);
  const lastGenerateSummary = useResumeStore((state) => state.lastGenerateSummary);
  const errorMessage = useResumeStore((state) => state.errorMessage);
  const clearError = useResumeStore((state) => state.clearError);
  const loadResumes = useResumeStore((state) => state.loadResumes);
  const setActiveResumeId = useResumeStore((state) => state.setActiveResumeId);
  const createNewResume = useResumeStore((state) => state.createNewResume);
  const renameActiveResume = useResumeStore((state) => state.renameActiveResume);
  const deleteActiveResume = useResumeStore((state) => state.deleteActiveResume);
  const resetDraftFromCurrent = useResumeStore((state) => state.resetDraftFromCurrent);
  const setDraftText = useResumeStore((state) => state.setDraftText);
  const generateAndSave = useResumeStore((state) => state.generateAndSave);
  const applyPreviewToDraft = useResumeStore((state) => state.applyPreviewToDraft);
  const saveDraftVersion = useResumeStore((state) => state.saveDraftVersion);
  const rollbackVersion = useResumeStore((state) => state.rollbackVersion);

  const [selectedConversationId, setSelectedConversationId] = useState<ConversationId | ''>('');

  useEffect(() => {
    void loadConversations();
    void loadResumes();
  }, [loadConversations, loadResumes]);

  useEffect(() => {
    if (draftText.trim()) return;
    if (!current) return;
    resetDraftFromCurrent();
  }, [current, draftText, resetDraftFromCurrent]);

  useEffect(() => {
    if (selectedConversationId) return;
    if (activeConversationId) {
      setSelectedConversationId(activeConversationId);
      return;
    }
  }, [activeConversationId, selectedConversationId]);

  const conversationTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const conversation of conversations) {
      map.set(conversation.id, conversation.title.trim() ? conversation.title : '新对话');
    }
    return map;
  }, [conversations]);

  const resumeTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const resume of resumes) {
      map.set(resume.id, resume.title.trim() ? resume.title : '未命名简历');
    }
    return map;
  }, [resumes]);

  const selectedConversation = useMemo(() => {
    if (!selectedConversationId) return undefined;
    return conversations.find((conversation) => conversation.id === selectedConversationId);
  }, [conversations, selectedConversationId]);

  const selectedConversationContextResumeId = selectedConversation?.contextResumeId ?? null;
  const generateButtonLabel = selectedConversationId
    ? selectedConversationContextResumeId
      ? '更新简历'
      : '生成简历'
    : '生成简历';

  function handleDraftChange(value: string) {
    if (errorMessage) clearError();
    setDraftText(value);
  }

  async function handleGenerate() {
    const confirmText = selectedConversationId
      ? selectedConversationContextResumeId
        ? '将使用 AI 更新该对话已关联的简历，并保存为一个新的版本，确定继续吗？'
        : '将使用 AI 生成一份新简历，并自动关联到该对话，确定继续吗？'
      : '将使用 AI 根据「记忆」生成一份新简历，确定继续吗？';

    const ok = window.confirm(confirmText);
    if (!ok) return;
    await generateAndSave(selectedConversationId ? selectedConversationId : undefined);
    await loadConversations();
  }

  function handleApplyPreview() {
    if (!generatedPreview) return;
    applyPreviewToDraft();
  }

  function handleResetDraft() {
    const ok = window.confirm('将用「当前已保存版本」覆盖编辑器内容，确定继续吗？');
    if (!ok) return;
    resetDraftFromCurrent();
  }

  async function handleSave() {
    const ok = window.confirm('保存会创建一个新的简历版本（用于回滚/undo），确定继续吗？');
    if (!ok) return;
    await saveDraftVersion();
    await loadConversations();
  }

  async function handleCreateResume() {
    const title = window.prompt('新简历标题（可留空）', '') ?? '';
    await createNewResume(title.trim() ? title.trim() : undefined);
  }

  async function handleRenameResume() {
    if (!activeResume) return;
    const nextTitle = window.prompt('新的简历标题', activeResume.title) ?? '';
    if (!nextTitle.trim()) return;
    await renameActiveResume(nextTitle);
    await loadConversations();
  }

  async function handleDeleteResume() {
    if (!activeResume) return;
    if (!window.confirm(`确定删除简历「${activeResume.title}」吗？此操作不可恢复。`)) return;
    await deleteActiveResume();
    await loadConversations();
  }

  async function handleAttachResumeToConversation() {
    if (!activeResumeId) {
      window.alert('请先选择一份简历');
      return;
    }
    if (!selectedConversationId) {
      window.alert('请先选择一个对话');
      return;
    }

    const ok = window.confirm('将把当前简历设为该对话的上下文（一次只能关联 1 份），确定继续吗？');
    if (!ok) return;

    await setConversationResumeContext(selectedConversationId, activeResumeId);
    await loadConversations();
  }

  async function handleClearConversationResumeContext() {
    if (!selectedConversationId) return;
    const ok = window.confirm('确定移除该对话的简历上下文吗？');
    if (!ok) return;
    await setConversationResumeContext(selectedConversationId, null);
    await loadConversations();
  }

  return (
    <main className="mx-auto grid min-h-[calc(100vh-56px)] max-w-6xl grid-cols-12 gap-4 p-6">
      <aside className="col-span-4 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-sm font-semibold">简历</h1>
          <div className="flex items-center gap-2">
            <Button size="xs" variant="secondary" onClick={() => void loadResumes()} disabled={isLoadingResumes}>
              {isLoadingResumes ? '刷新中...' : '刷新'}
            </Button>
            <Button size="xs" onClick={() => void handleCreateResume()} disabled={isCreating}>
              {isCreating ? '创建中...' : '新建'}
            </Button>
          </div>
        </div>

        <div className="mt-2 text-xs text-muted-foreground">共 {resumes.length} 份简历</div>

        {errorMessage && (
          <div className="mt-3 rounded-lg border border-destructive/24 bg-destructive/8 px-3 py-2 text-sm text-destructive-foreground">
            {errorMessage}
          </div>
        )}

        <div className="mt-4 space-y-2 text-sm">
          {resumes.length === 0 && (
            <div className="text-muted-foreground">还没有简历，可以先点「新建」或直接生成。</div>
          )}

          {resumes.map((resume) => {
            const isActive = resume.id === activeResumeId;
            const sourceConversationTitle = resume.sourceConversationId
              ? (conversationTitleById.get(resume.sourceConversationId) ?? resume.sourceConversationId)
              : '';

            return (
              <div key={resume.id} className="rounded-lg border border-border bg-background p-3">
                <Button
                  size="sm"
                  variant={isActive ? 'secondary' : 'ghost'}
                  className="h-9 w-full justify-start px-2"
                  onClick={() => void setActiveResumeId(resume.id)}
                  disabled={isLoadingActiveResume || isSaving || isGenerating}
                >
                  <span className="truncate">{resume.title.trim() ? resume.title : '未命名简历'}</span>
                </Button>

                <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <div className="min-w-0 truncate">
                    {sourceConversationTitle ? `来源：${sourceConversationTitle}` : '来源：记忆'}
                  </div>
                  <div className="shrink-0">{formatTimestamp(resume.updatedAt)}</div>
                </div>
              </div>
            );
          })}
        </div>

        {activeResume && (
          <div className="mt-4 flex items-center justify-end gap-2">
            <Button size="xs" variant="secondary" onClick={() => void handleRenameResume()}>
              改名
            </Button>
            <Button size="xs" variant="ghost" onClick={() => void handleDeleteResume()}>
              删除
            </Button>
          </div>
        )}

        <div className="mt-6 border-t border-border pt-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">版本</h2>
            <div className="text-xs text-muted-foreground">
              保留最近 {retentionLimit} 份（可通过 MUICV_RESUME_SNAPSHOT_LIMIT 配置）
            </div>
          </div>

          <div className="mt-3 space-y-2 text-sm">
            {!activeResume && <div className="text-muted-foreground">请选择一份简历</div>}
            {activeResume && versions.length === 0 && <div className="text-muted-foreground">还没有保存过版本</div>}

            {activeResume &&
              versions.map((version) => {
                const isRollingBack = isRollingBackVersionId === version.id;
                return (
                  <div key={version.id} className="rounded-lg border border-border bg-background p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-xs text-muted-foreground">
                          {formatTimestamp(version.createdAt)}
                        </div>
                        <div className="mt-1 truncate text-sm">{version.id}</div>
                      </div>
                      <Button
                        size="xs"
                        variant="secondary"
                        disabled={isRollingBack || isSaving || isGenerating}
                        onClick={() => void rollbackVersion(version.id)}
                      >
                        {isRollingBack ? '回滚中...' : '回滚'}
                      </Button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </aside>

      <section className="col-span-8 flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold">编辑器</div>
            <div className="text-xs text-muted-foreground">（手动保存才会生成版本）</div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>对话</span>
              <select
                className="h-8 rounded-md border border-border bg-background px-2 text-sm"
                value={selectedConversationId}
                onChange={(event) => setSelectedConversationId(event.target.value as ConversationId | '')}
                disabled={isLoadingResumes || isSaving || isGenerating}
              >
                <option value="">仅记忆（不带对话上下文）</option>
                {conversations.map((conversation) => (
                  <option key={conversation.id} value={conversation.id}>
                    {conversation.title.trim() ? conversation.title : '新对话'}
                  </option>
                ))}
              </select>
            </label>

            <Button size="xs" variant="secondary" onClick={() => void handleGenerate()} disabled={isGenerating}>
              {isGenerating ? '处理中...' : generateButtonLabel}
            </Button>
            <Button size="xs" variant="secondary" onClick={handleApplyPreview} disabled={!generatedPreview}>
              应用预览
            </Button>
            <Button size="xs" variant="secondary" onClick={handleResetDraft} disabled={!current}>
              重置
            </Button>
            <Button size="xs" onClick={() => void handleSave()} disabled={isSaving}>
              {isSaving ? '保存中...' : '保存版本'}
            </Button>

            <Button
              size="xs"
              variant="secondary"
              onClick={() => void handleAttachResumeToConversation()}
              disabled={!activeResumeId || !selectedConversationId}
            >
              设为对话上下文
            </Button>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => void handleClearConversationResumeContext()}
              disabled={!selectedConversationId || !selectedConversation?.contextResumeId}
            >
              移除上下文
            </Button>
          </div>
        </div>

        {selectedConversationId && (
          <div className="text-xs text-muted-foreground">
            当前对话上下文：
            {selectedConversationContextResumeId
              ? (resumeTitleById.get(selectedConversationContextResumeId) ?? selectedConversationContextResumeId)
              : '无'}
          </div>
        )}

        {lastGenerateSummary && (
          <div className="text-xs text-muted-foreground">
            最近一次生成：使用记忆 {lastGenerateSummary.usedMemoryEntries} 条，对话消息{' '}
            {lastGenerateSummary.usedMessages} 条
          </div>
        )}

        <div className="grid flex-1 grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <div className="text-xs font-medium text-muted-foreground">预览（只读）</div>
            <div className="flex-1 overflow-auto rounded-lg border border-border bg-background p-3">
              {!generatedPreview && <div className="text-sm text-muted-foreground">还没有生成预览</div>}
              {generatedPreview && (
                <pre className="whitespace-pre-wrap text-xs">{JSON.stringify(generatedPreview, null, 2)}</pre>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-xs font-medium text-muted-foreground">ResumeJson（可编辑）</div>
            <textarea
              className="min-h-[360px] flex-1 resize-none rounded-lg border border-border bg-background p-3 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
              value={draftText}
              onChange={(event) => handleDraftChange(event.target.value)}
              placeholder="这里是 ResumeJson，保存后会生成一个新的版本。"
            />
          </div>
        </div>
      </section>
    </main>
  );
}
