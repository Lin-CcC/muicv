import type { ChatMessage, Conversation, ConversationId, UserId } from '@muicv/shared';

import { createDefaultSqliteChatStore } from './sqlite-chat-store.ts';

export type CreateConversationParams = {
  userId: UserId;
  title?: string;
};

export type AddMessageParams = {
  conversationId: ConversationId;
  role: ChatMessage['role'];
  content: string;
};

export type ChatStore = {
  listConversations(userId: UserId): Promise<Conversation[]>;
  getConversation(conversationId: ConversationId): Promise<Conversation | undefined>;
  createConversation(params: CreateConversationParams): Promise<Conversation>;
  deleteConversation(conversationId: ConversationId): Promise<void>;

  listMessages(conversationId: ConversationId): Promise<ChatMessage[]>;
  addMessage(params: AddMessageParams): Promise<ChatMessage>;
};

type GlobalWithChatStore = typeof globalThis & {
  __muicvChatStore?: ChatStore;
};

const globalWithChatStore = globalThis as GlobalWithChatStore;

export function getChatStore() {
  if (!globalWithChatStore.__muicvChatStore) {
    globalWithChatStore.__muicvChatStore = createDefaultSqliteChatStore();
  }

  return globalWithChatStore.__muicvChatStore;
}
