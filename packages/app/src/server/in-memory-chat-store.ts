import { randomUUID } from 'node:crypto';

import type { ChatMessage, Conversation, ConversationId, UserId } from '@muicv/shared';

export type CreateConversationParams = {
  userId: UserId;
  title?: string;
};

export type AddMessageParams = {
  conversationId: ConversationId;
  role: ChatMessage['role'];
  content: string;
};

export type InMemoryChatStore = {
  listConversations(userId: UserId): Conversation[];
  getConversation(conversationId: ConversationId): Conversation | undefined;
  createConversation(params: CreateConversationParams): Conversation;
  deleteConversation(conversationId: ConversationId): void;

  listMessages(conversationId: ConversationId): ChatMessage[];
  addMessage(params: AddMessageParams): ChatMessage;
};

type InMemoryChatStoreState = {
  conversations: Map<ConversationId, Conversation>;
  conversationIdsByUserId: Map<UserId, ConversationId[]>;
  messagesByConversationId: Map<ConversationId, ChatMessage[]>;
};

export function createInMemoryChatStore(): InMemoryChatStore {
  const state: InMemoryChatStoreState = {
    conversations: new Map(),
    conversationIdsByUserId: new Map(),
    messagesByConversationId: new Map(),
  };

  function listConversations(userId: UserId): Conversation[] {
    const ids = state.conversationIdsByUserId.get(userId) ?? [];
    const conversations = ids
      .map((id) => state.conversations.get(id))
      .filter((conversation): conversation is Conversation => conversation !== undefined);

    conversations.sort((a, b) => {
      const aValue = new Date(a.updatedAt).getTime();
      const bValue = new Date(b.updatedAt).getTime();
      return bValue - aValue;
    });

    return conversations;
  }

  function getConversation(conversationId: ConversationId) {
    return state.conversations.get(conversationId);
  }

  function createConversation(params: CreateConversationParams): Conversation {
    const now = new Date().toISOString();
    const conversationId = randomUUID();
    const title = params.title?.trim() ? params.title.trim() : '新对话';

    const conversation: Conversation = {
      id: conversationId,
      userId: params.userId,
      title,
      createdAt: now,
      updatedAt: now,
    };

    state.conversations.set(conversationId, conversation);

    const existingIds = state.conversationIdsByUserId.get(params.userId) ?? [];
    state.conversationIdsByUserId.set(params.userId, [conversationId, ...existingIds]);

    state.messagesByConversationId.set(conversationId, []);

    return conversation;
  }

  function deleteConversation(conversationId: ConversationId) {
    const conversation = state.conversations.get(conversationId);
    if (!conversation) return;

    state.conversations.delete(conversationId);
    state.messagesByConversationId.delete(conversationId);

    const existingIds = state.conversationIdsByUserId.get(conversation.userId) ?? [];
    state.conversationIdsByUserId.set(
      conversation.userId,
      existingIds.filter((id) => id !== conversationId),
    );
  }

  function listMessages(conversationId: ConversationId): ChatMessage[] {
    return state.messagesByConversationId.get(conversationId) ?? [];
  }

  function addMessage(params: AddMessageParams): ChatMessage {
    const conversation = state.conversations.get(params.conversationId);
    if (!conversation) {
      throw new Error(`对话不存在：${params.conversationId}`);
    }

    const now = new Date().toISOString();
    const message: ChatMessage = {
      id: randomUUID(),
      conversationId: params.conversationId,
      role: params.role,
      content: params.content,
      createdAt: now,
    };

    const existingMessages = state.messagesByConversationId.get(params.conversationId) ?? [];
    state.messagesByConversationId.set(params.conversationId, [...existingMessages, message]);

    state.conversations.set(params.conversationId, {
      ...conversation,
      updatedAt: now,
    });

    return message;
  }

  return {
    addMessage,
    createConversation,
    deleteConversation,
    getConversation,
    listConversations,
    listMessages,
  };
}

type GlobalWithChatStore = typeof globalThis & {
  __muicvInMemoryChatStore?: InMemoryChatStore;
};

const globalWithChatStore = globalThis as GlobalWithChatStore;

if (!globalWithChatStore.__muicvInMemoryChatStore) {
  globalWithChatStore.__muicvInMemoryChatStore = createInMemoryChatStore();
}

export const inMemoryChatStore = globalWithChatStore.__muicvInMemoryChatStore;
