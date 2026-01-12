'use client';

import { create } from 'zustand';

import type { ChatMessage, Conversation, ConversationId } from '@muicv/shared';
import {
  createConversation as createConversationApi,
  deleteConversation as deleteConversationApi,
  listConversations,
  listMessages,
  renameConversation as renameConversationApi,
  streamRetryAssistant,
  streamUserMessage,
} from '@/src/api-client/chat-api';

function isAbortError(error: unknown) {
  if (!error) return false;
  if (typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'AbortError') return true;
  if (error instanceof Error && error.name === 'AbortError') return true;
  return error instanceof Error && error.message === 'AbortError';
}

type ChatStoreState = {
  conversations: Conversation[];
  activeConversationId: ConversationId | undefined;
  messagesByConversationId: Record<ConversationId, ChatMessage[] | undefined>;
  isLoadingConversations: boolean;
  isLoadingMessagesByConversationId: Record<ConversationId, boolean | undefined>;
  isSendingMessage: boolean;
  activeStreamAbortController: AbortController | undefined;
  errorMessage: string | undefined;
};

type ChatStoreActions = {
  loadConversations(): Promise<void>;
  setActiveConversationId(conversationId: ConversationId): Promise<void>;
  reloadMessages(conversationId: ConversationId): Promise<void>;
  createConversation(title?: string): Promise<Conversation>;
  renameConversation(conversationId: ConversationId, title: string): Promise<Conversation>;
  deleteConversation(conversationId: ConversationId): Promise<void>;
  sendUserMessage(content: string): Promise<void>;
  stopGenerating(): Promise<void>;
  retryAssistant(): Promise<void>;
  clearError(): void;
};

export type ChatStore = ChatStoreState & ChatStoreActions;

export const useChatStore = create<ChatStore>((set, get) => ({
  conversations: [],
  activeConversationId: undefined,
  messagesByConversationId: {},
  isLoadingConversations: false,
  isLoadingMessagesByConversationId: {},
  isSendingMessage: false,
  activeStreamAbortController: undefined,
  errorMessage: undefined,

  clearError() {
    set({ errorMessage: undefined });
  },

  async loadConversations() {
    if (get().isLoadingConversations) return;

    set({ isLoadingConversations: true, errorMessage: undefined });
    try {
      const conversations = await listConversations();
      set({ conversations });

      const currentActiveId = get().activeConversationId;
      if (!currentActiveId && conversations.length > 0) {
        await get().setActiveConversationId(conversations[0]!.id);
      }
    } catch (error) {
      set({ errorMessage: error instanceof Error ? error.message : '加载对话失败' });
    } finally {
      set({ isLoadingConversations: false });
    }
  },

  async setActiveConversationId(conversationId: ConversationId) {
    set({ activeConversationId: conversationId, errorMessage: undefined });

    const isLoading = get().isLoadingMessagesByConversationId[conversationId];
    const hasMessages = get().messagesByConversationId[conversationId] !== undefined;
    if (isLoading || hasMessages) return;

    await get().reloadMessages(conversationId);
  },

  async reloadMessages(conversationId: ConversationId) {
    set((state) => ({
      isLoadingMessagesByConversationId: { ...state.isLoadingMessagesByConversationId, [conversationId]: true },
    }));

    try {
      const messages = await listMessages(conversationId);
      set((state) => ({
        messagesByConversationId: { ...state.messagesByConversationId, [conversationId]: messages },
      }));
    } catch (error) {
      set({ errorMessage: error instanceof Error ? error.message : '加载消息失败' });
    } finally {
      set((state) => ({
        isLoadingMessagesByConversationId: {
          ...state.isLoadingMessagesByConversationId,
          [conversationId]: false,
        },
      }));
    }
  },

  async createConversation(title?: string) {
    set({ errorMessage: undefined });
    try {
      const conversation = await createConversationApi(title);
      set((state) => ({ conversations: [conversation, ...state.conversations] }));
      await get().setActiveConversationId(conversation.id);
      return conversation;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '创建对话失败';
      set({ errorMessage });
      throw new Error(errorMessage);
    }
  },

  async renameConversation(conversationId: ConversationId, title: string) {
    set({ errorMessage: undefined });
    try {
      const updatedConversation = await renameConversationApi(conversationId, title);
      set((state) => ({
        conversations: [
          updatedConversation,
          ...state.conversations.filter((conversation) => conversation.id !== conversationId),
        ],
      }));
      return updatedConversation;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '重命名失败';
      set({ errorMessage });
      throw new Error(errorMessage);
    }
  },

  async deleteConversation(conversationId: ConversationId) {
    set({ errorMessage: undefined });
    try {
      await deleteConversationApi(conversationId);

      set((state) => {
        const remainingConversations = state.conversations.filter((conversation) => conversation.id !== conversationId);
        const activeConversationId =
          state.activeConversationId === conversationId ? remainingConversations[0]?.id : state.activeConversationId;

        const { [conversationId]: _deletedMessages, ...messagesByConversationId } = state.messagesByConversationId;
        const { [conversationId]: _deletedLoading, ...isLoadingMessagesByConversationId } =
          state.isLoadingMessagesByConversationId;

        return {
          activeConversationId,
          conversations: remainingConversations,
          isLoadingMessagesByConversationId,
          messagesByConversationId,
        };
      });

      const activeConversationId = get().activeConversationId;
      if (activeConversationId && get().messagesByConversationId[activeConversationId] === undefined) {
        await get().setActiveConversationId(activeConversationId);
      }
    } catch (error) {
      set({ errorMessage: error instanceof Error ? error.message : '删除失败' });
    }
  },

  async sendUserMessage(content: string) {
    if (get().isSendingMessage) return;

    const trimmed = content.trim();
    if (!trimmed) return;

    set({ activeStreamAbortController: undefined, isSendingMessage: true, errorMessage: undefined });

    try {
      let conversationId = get().activeConversationId;
      if (!conversationId) {
        const conversation = await get().createConversation();
        conversationId = conversation.id;
      }

      const now = new Date();
      const localUserMessageId = `local-user-${now.getTime()}`;
      const localAssistantMessageId = `local-assistant-${now.getTime()}`;

      set((state) => {
        const existing = state.messagesByConversationId[conversationId] ?? [];
        const userMessage: ChatMessage = {
          content: trimmed,
          conversationId,
          createdAt: now.toISOString(),
          id: localUserMessageId,
          role: 'user',
        };
        const assistantMessage: ChatMessage = {
          content: '',
          conversationId,
          createdAt: now.toISOString(),
          id: localAssistantMessageId,
          role: 'assistant',
        };

        return {
          messagesByConversationId: {
            ...state.messagesByConversationId,
            [conversationId]: [...existing, userMessage, assistantMessage],
          },
        };
      });

      const abortController = new AbortController();
      set({ activeStreamAbortController: abortController });

      for await (const event of streamUserMessage(conversationId, {
        content: trimmed,
        signal: abortController.signal,
      })) {
        if (event.type === 'user') {
          set((state) => {
            const existing = state.messagesByConversationId[conversationId] ?? [];
            return {
              messagesByConversationId: {
                ...state.messagesByConversationId,
                [conversationId]: existing.map((message) =>
                  message.id === localUserMessageId ? event.message : message,
                ),
              },
            };
          });
          continue;
        }

        if (event.type === 'delta') {
          set((state) => {
            const existing = state.messagesByConversationId[conversationId] ?? [];
            return {
              messagesByConversationId: {
                ...state.messagesByConversationId,
                [conversationId]: existing.map((message) =>
                  message.id === localAssistantMessageId
                    ? { ...message, content: `${message.content}${event.textDelta}` }
                    : message,
                ),
              },
            };
          });
          continue;
        }

        if (event.type === 'done') {
          set((state) => {
            const existing = state.messagesByConversationId[conversationId] ?? [];
            const nextMessages = existing
              .map((message) => (message.id === localAssistantMessageId ? event.assistantMessage : message))
              .filter((message): message is ChatMessage => Boolean(message));

            return {
              activeStreamAbortController: undefined,
              isSendingMessage: false,
              messagesByConversationId: {
                ...state.messagesByConversationId,
                [conversationId]: nextMessages,
              },
            };
          });
          await get().loadConversations();
          return;
        }

        if (event.type === 'error') {
          set({ activeStreamAbortController: undefined, errorMessage: event.message, isSendingMessage: false });
          return;
        }
      }

      set({ activeStreamAbortController: undefined, isSendingMessage: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : '发送失败';
      if (!isAbortError(error)) set({ errorMessage: message });
      set({ activeStreamAbortController: undefined, isSendingMessage: false });
    } finally {
      set({ activeStreamAbortController: undefined, isSendingMessage: false });
    }
  },

  async stopGenerating() {
    const controller = get().activeStreamAbortController;
    const conversationId = get().activeConversationId;

    controller?.abort();
    set({ activeStreamAbortController: undefined, isSendingMessage: false });

    if (conversationId) {
      await get().reloadMessages(conversationId);
      await get().loadConversations();
    }
  },

  async retryAssistant() {
    if (get().isSendingMessage) return;

    const conversationId = get().activeConversationId;
    if (!conversationId) {
      set({ errorMessage: '请先选择一个对话' });
      return;
    }

    set({ activeStreamAbortController: undefined, isSendingMessage: true, errorMessage: undefined });

    const now = new Date();
    const localAssistantMessageId = `local-assistant-retry-${now.getTime()}`;

    set((state) => {
      const existing = state.messagesByConversationId[conversationId] ?? [];
      const assistantMessage: ChatMessage = {
        content: '',
        conversationId,
        createdAt: now.toISOString(),
        id: localAssistantMessageId,
        role: 'assistant',
      };

      return {
        messagesByConversationId: {
          ...state.messagesByConversationId,
          [conversationId]: [...existing, assistantMessage],
        },
      };
    });

    const abortController = new AbortController();
    set({ activeStreamAbortController: abortController });

    try {
      for await (const event of streamRetryAssistant(conversationId, { signal: abortController.signal })) {
        if (event.type === 'delta') {
          set((state) => {
            const existing = state.messagesByConversationId[conversationId] ?? [];
            return {
              messagesByConversationId: {
                ...state.messagesByConversationId,
                [conversationId]: existing.map((message) =>
                  message.id === localAssistantMessageId
                    ? { ...message, content: `${message.content}${event.textDelta}` }
                    : message,
                ),
              },
            };
          });
          continue;
        }

        if (event.type === 'done') {
          set((state) => {
            const existing = state.messagesByConversationId[conversationId] ?? [];
            const nextMessages = existing
              .map((message) => (message.id === localAssistantMessageId ? event.assistantMessage : message))
              .filter((message): message is ChatMessage => Boolean(message));

            return {
              activeStreamAbortController: undefined,
              isSendingMessage: false,
              messagesByConversationId: {
                ...state.messagesByConversationId,
                [conversationId]: nextMessages,
              },
            };
          });
          await get().loadConversations();
          return;
        }

        if (event.type === 'error') {
          set({ activeStreamAbortController: undefined, errorMessage: event.message, isSendingMessage: false });
          return;
        }
      }

      set({ activeStreamAbortController: undefined, isSendingMessage: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : '重试失败';
      if (!isAbortError(error)) set({ errorMessage: message });
      set({ activeStreamAbortController: undefined, isSendingMessage: false });
    }
  },
}));
