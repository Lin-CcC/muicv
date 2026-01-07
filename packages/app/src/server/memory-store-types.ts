import type { ConversationId, MemoryEntry, MemoryEntryId, MemoryEntryKind, MessageId, UserId } from '@muicv/shared';

export type ListMemoryEntriesParams = {
  limit?: number;
  conversationId?: ConversationId;
};

export type CreateMemoryEntryParams = {
  userId: UserId;
  conversationId?: ConversationId;
  messageId?: MessageId;
  kind: MemoryEntryKind;
  title: string;
  detail?: string;
  tags?: string[];
  occurredAt?: string;
};

export type MemoryStore = {
  listMemoryEntries(userId: UserId, params?: ListMemoryEntriesParams): Promise<MemoryEntry[]>;
  addMemoryEntry(params: CreateMemoryEntryParams): Promise<MemoryEntry>;
  addMemoryEntries(params: CreateMemoryEntryParams[]): Promise<MemoryEntry[]>;
  clearConversationReferences(conversationId: ConversationId): Promise<void>;
};

export type { MemoryEntry, MemoryEntryId, MemoryEntryKind };
