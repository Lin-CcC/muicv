import type { ConversationId, MessageId, UserId } from './chat.ts';

export type MemoryEntryId = string;

export type MemoryEntryKind = 'career_event' | 'skill' | 'project' | 'education' | 'preference' | 'contact' | 'other';

export type MemoryEntry = {
  id: MemoryEntryId;
  userId: UserId;
  conversationId: ConversationId | null;
  messageId: MessageId | null;
  kind: MemoryEntryKind;
  title: string;
  detail?: string;
  tags?: string[];
  occurredAt?: string;
  createdAt: string;
};
