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

export type ChatStore = {
  listConversations(userId: UserId): Promise<Conversation[]>;
  getConversation(conversationId: ConversationId): Promise<Conversation | undefined>;
  createConversation(params: CreateConversationParams): Promise<Conversation>;
  renameConversation(conversationId: ConversationId, title: string): Promise<Conversation>;
  setConversationResumeContext(conversationId: ConversationId, resumeId: string | null): Promise<Conversation>;
  deleteConversation(conversationId: ConversationId): Promise<void>;

  listMessages(conversationId: ConversationId): Promise<ChatMessage[]>;
  addMessage(params: AddMessageParams): Promise<ChatMessage>;
};
