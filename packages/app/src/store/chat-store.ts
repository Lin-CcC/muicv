'use client';

import { create } from 'zustand';

import type { ChatMessage, Conversation, ConversationId } from '@muicv/shared';
import { addMessage, createConversation, listConversations, listMessages } from '@/src/api-client/chat-api';

type ChatStoreState = {
  conversations: Conversation[];
  activeConversationId: ConversationId | undefined;
  messagesByConversationId: Record<ConversationId, ChatMessage[] | undefined>;
  isLoadingConversations: boolean;
  isLoadingMessagesByConversationId: Record<ConversationId, boolean | undefined>;
  isSendingMessage: boolean;
  errorMessage: string | undefined;
};

type ChatStoreActions = {
  loadConversations(): Promise<void>;
  setActiveConversationId(conversationId: ConversationId): Promise<void>;
  createConversation(title?: string): Promise<Conversation>;
  sendUserMessage(content: string): Promise<void>;
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
      const conversation = await createConversation(title);
      set((state) => ({ conversations: [conversation, ...state.conversations] }));
      await get().setActiveConversationId(conversation.id);
      return conversation;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '创建对话失败';
      set({ errorMessage });
      throw new Error(errorMessage);
    }
  },

  async sendUserMessage(content: string) {
    if (get().isSendingMessage) return;

    const trimmed = content.trim();
    if (!trimmed) return;

    set({ isSendingMessage: true, errorMessage: undefined });

    try {
      let conversationId = get().activeConversationId;
      if (!conversationId) {
        const conversation = await get().createConversation();
        conversationId = conversation.id;
      }

      const message = await addMessage(conversationId, { role: 'user', content: trimmed });

      set((state) => {
        const existing = state.messagesByConversationId[conversationId] ?? [];
        return {
          messagesByConversationId: {
            ...state.messagesByConversationId,
            [conversationId]: [...existing, message],
          },
        };
      });

      await get().loadConversations();
    } catch (error) {
      set({ errorMessage: error instanceof Error ? error.message : '发送失败' });
    } finally {
      set({ isSendingMessage: false });
    }
  },
}));
