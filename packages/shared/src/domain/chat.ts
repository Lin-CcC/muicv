export type UserId = string;
export type ConversationId = string;
export type MessageId = string;

export type ChatMessageRole = 'system' | 'user' | 'assistant';

export type ChatMessage = {
  id: MessageId;
  conversationId: ConversationId;
  role: ChatMessageRole;
  content: string;
  createdAt: string;
};

export type Conversation = {
  id: ConversationId;
  userId: UserId;
  title: string;
  createdAt: string;
  updatedAt: string;
};
