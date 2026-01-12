'use client';

import { useEffect, useMemo } from 'react';

import { ChatPanel } from './chat-panel';
import { ConversationSidebar } from './conversation-sidebar';
import { MemorySidebar } from './memory-sidebar';
import { useChatStore } from '@/src/store/chat-store';
import { useMemoryStore } from '@/src/store/memory-store';

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
  const stopGenerating = useChatStore((state) => state.stopGenerating);
  const retryAssistant = useChatStore((state) => state.retryAssistant);

  const memoryEntries = useMemoryStore((state) => state.entries);
  const isLoadingMemory = useMemoryStore((state) => state.isLoading);
  const isOrganizingMemory = useMemoryStore((state) => state.isOrganizing);
  const memoryErrorMessage = useMemoryStore((state) => state.errorMessage);
  const lastOrganizeSummary = useMemoryStore((state) => state.lastOrganizeSummary);
  const loadMemoryEntries = useMemoryStore((state) => state.loadEntries);
  const organizeEntries = useMemoryStore((state) => state.organizeEntries);

  useEffect(() => {
    void loadConversations();
    void loadMemoryEntries();
  }, [loadConversations, loadMemoryEntries]);

  useEffect(() => {
    void loadMemoryEntries(activeConversationId);
  }, [activeConversationId, loadMemoryEntries]);

  const activeConversation = useMemo(() => {
    if (!activeConversationId) return undefined;
    return conversations.find((conversation) => conversation.id === activeConversationId);
  }, [activeConversationId, conversations]);

  const activeMessages = useMemo(() => {
    if (!activeConversationId) return undefined;
    return messagesByConversationId[activeConversationId];
  }, [activeConversationId, messagesByConversationId]);

  const isLoadingActiveMessages = useMemo(() => {
    if (!activeConversationId) return false;
    return Boolean(isLoadingMessagesByConversationId[activeConversationId]);
  }, [activeConversationId, isLoadingMessagesByConversationId]);

  function handleCreateConversation() {
    void createNewConversation();
  }

  function handleSelectConversation(conversationId: string) {
    void setActiveConversationId(conversationId);
  }

  async function handleSendMessage(content: string) {
    await sendUserMessage(content);
    await loadMemoryEntries(useChatStore.getState().activeConversationId);
  }

  async function handleStop() {
    await stopGenerating();
    await loadMemoryEntries(useChatStore.getState().activeConversationId);
  }

  async function handleRetry() {
    await retryAssistant();
    await loadMemoryEntries(useChatStore.getState().activeConversationId);
  }

  return (
    <main className="mx-auto grid min-h-[calc(100vh-56px)] max-w-6xl grid-cols-12 gap-4 p-6">
      <ConversationSidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        isLoadingConversations={isLoadingConversations}
        errorMessage={errorMessage}
        onClearError={clearError}
        onCreateConversation={handleCreateConversation}
        onSelectConversation={handleSelectConversation}
        onRenameConversation={renameConversation}
        onDeleteConversation={deleteConversation}
      />

      <ChatPanel
        conversationId={activeConversationId}
        contextResumeId={activeConversation?.contextResumeId ?? null}
        messages={activeMessages}
        isLoadingMessages={isLoadingActiveMessages}
        isSendingMessage={isSendingMessage}
        errorMessage={errorMessage}
        onClearError={clearError}
        onSendMessage={handleSendMessage}
        onStop={handleStop}
        onRetry={handleRetry}
        onUpdatedConversations={loadConversations}
      />

      <MemorySidebar
        entries={memoryEntries}
        activeConversationId={activeConversationId}
        isLoading={isLoadingMemory}
        isOrganizing={isOrganizingMemory}
        errorMessage={memoryErrorMessage}
        lastOrganizeSummary={lastOrganizeSummary}
        onReload={loadMemoryEntries}
        onOrganize={organizeEntries}
      />
    </main>
  );
}
