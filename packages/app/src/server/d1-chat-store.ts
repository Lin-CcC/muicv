import type { ChatMessage, Conversation, ConversationId, UserId } from '@muicv/shared';

import type { AddMessageParams, ChatStore, CreateConversationParams } from './chat-store-types.ts';

type ConversationRow = {
  id: string;
  userId: string;
  title: string;
  contextResumeId: string | null;
  createdAt: string;
  updatedAt: string;
};

type MessageRow = {
  id: string;
  conversationId: string;
  role: ChatMessage['role'];
  content: string;
  createdAt: string;
};

export type CreateD1ChatStoreParams = {
  database: D1Database;
};

export function createD1ChatStore(params: CreateD1ChatStoreParams): ChatStore {
  function createConversationId(): string {
    return crypto.randomUUID();
  }

  function createMessageId(): string {
    return crypto.randomUUID();
  }

  const statements = {
    insertOrIgnoreUser: params.database.prepare(
      'INSERT OR IGNORE INTO users (id, created_at, updated_at) VALUES (?, ?, ?)',
    ),
    updateUserUpdatedAt: params.database.prepare('UPDATE users SET updated_at = ? WHERE id = ?'),

    listConversations: params.database.prepare(`
      SELECT
        id,
        user_id AS userId,
        title,
        context_resume_id AS contextResumeId,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM conversations
      WHERE user_id = ?
      ORDER BY updated_at DESC
    `),

    getConversation: params.database.prepare(`
      SELECT
        id,
        user_id AS userId,
        title,
        context_resume_id AS contextResumeId,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM conversations
      WHERE id = ?
    `),

    insertConversation: params.database.prepare(`
      INSERT INTO conversations (id, user_id, title, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `),

    updateConversationTitleAndUpdatedAt: params.database.prepare(
      'UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?',
    ),

    updateConversationResumeContext: params.database.prepare(
      'UPDATE conversations SET context_resume_id = ?, updated_at = ? WHERE id = ?',
    ),

    deleteConversation: params.database.prepare('DELETE FROM conversations WHERE id = ?'),

    clearConversationReferencesFromResumeSnapshots: params.database.prepare(
      'UPDATE resume_snapshots SET conversation_id = NULL WHERE conversation_id = ?',
    ),

    clearConversationReferencesFromUsageLogs: params.database.prepare(
      'UPDATE usage_logs SET conversation_id = NULL WHERE conversation_id = ?',
    ),

    clearConversationReferencesFromMemoryEntries: params.database.prepare(
      'UPDATE memory_entries SET conversation_id = NULL, message_id = NULL WHERE conversation_id = ?',
    ),

    deleteMessagesByConversationId: params.database.prepare('DELETE FROM messages WHERE conversation_id = ?'),

    listMessages: params.database.prepare(`
      SELECT
        id,
        conversation_id AS conversationId,
        role,
        content,
        created_at AS createdAt
      FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at ASC
    `),

    insertMessage: params.database.prepare(`
      INSERT INTO messages (id, conversation_id, role, content, created_at)
      VALUES (?, ?, ?, ?, ?)
    `),

    updateConversationUpdatedAt: params.database.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?'),
  } as const;

  async function listConversations(userId: UserId): Promise<Conversation[]> {
    const result = await statements.listConversations.bind(userId).all<ConversationRow>();
    return result.results.map((row) => ({
      id: row.id,
      userId: row.userId,
      title: row.title,
      contextResumeId: row.contextResumeId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  async function getConversation(conversationId: ConversationId): Promise<Conversation | undefined> {
    const row = await statements.getConversation.bind(conversationId).first<ConversationRow>();
    if (!row) return undefined;
    return {
      id: row.id,
      userId: row.userId,
      title: row.title,
      contextResumeId: row.contextResumeId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async function createConversation(createConversationParams: CreateConversationParams): Promise<Conversation> {
    const now = new Date().toISOString();
    const conversationId = createConversationId();
    const title = createConversationParams.title?.trim() ? createConversationParams.title.trim() : '新对话';

    await params.database.batch([
      statements.insertOrIgnoreUser.bind(createConversationParams.userId, now, now),
      statements.updateUserUpdatedAt.bind(now, createConversationParams.userId),
      statements.insertConversation.bind(conversationId, createConversationParams.userId, title, now, now),
    ]);

    return {
      id: conversationId,
      userId: createConversationParams.userId,
      title,
      contextResumeId: null,
      createdAt: now,
      updatedAt: now,
    };
  }

  async function renameConversation(conversationId: ConversationId, title: string): Promise<Conversation> {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      throw new Error('标题不能为空');
    }

    const now = new Date().toISOString();

    const updateResult = await statements.updateConversationTitleAndUpdatedAt
      .bind(normalizedTitle, now, conversationId)
      .run();

    if (updateResult.meta.changes !== 1) {
      throw new Error(`对话不存在：${conversationId}`);
    }

    const updatedConversation = await getConversation(conversationId);
    if (!updatedConversation) {
      throw new Error(`对话不存在：${conversationId}`);
    }

    return updatedConversation;
  }

  async function deleteConversation(conversationId: ConversationId) {
    await params.database.batch([
      statements.clearConversationReferencesFromResumeSnapshots.bind(conversationId),
      statements.clearConversationReferencesFromUsageLogs.bind(conversationId),
      statements.clearConversationReferencesFromMemoryEntries.bind(conversationId),
      statements.deleteMessagesByConversationId.bind(conversationId),
      statements.deleteConversation.bind(conversationId),
    ]);
  }

  async function setConversationResumeContext(
    conversationId: ConversationId,
    resumeId: string | null,
  ): Promise<Conversation> {
    const now = new Date().toISOString();
    const updateResult = await statements.updateConversationResumeContext.bind(resumeId, now, conversationId).run();
    if (updateResult.meta.changes !== 1) {
      throw new Error(`对话不存在：${conversationId}`);
    }

    const updatedConversation = await getConversation(conversationId);
    if (!updatedConversation) {
      throw new Error(`对话不存在：${conversationId}`);
    }

    return updatedConversation;
  }

  async function listMessages(conversationId: ConversationId): Promise<ChatMessage[]> {
    const result = await statements.listMessages.bind(conversationId).all<MessageRow>();
    return result.results.map((row) => ({
      id: row.id,
      conversationId: row.conversationId,
      role: row.role,
      content: row.content,
      createdAt: row.createdAt,
    }));
  }

  async function addMessage(addMessageParams: AddMessageParams): Promise<ChatMessage> {
    const now = new Date().toISOString();
    const message: ChatMessage = {
      id: createMessageId(),
      conversationId: addMessageParams.conversationId,
      role: addMessageParams.role,
      content: addMessageParams.content,
      createdAt: now,
    };

    const [updateResult] = await params.database.batch([
      statements.updateConversationUpdatedAt.bind(now, addMessageParams.conversationId),
      statements.insertMessage.bind(
        message.id,
        message.conversationId,
        message.role,
        message.content,
        message.createdAt,
      ),
    ]);

    if (!updateResult || updateResult.meta.changes !== 1) {
      throw new Error(`对话不存在：${addMessageParams.conversationId}`);
    }

    return message;
  }

  return {
    addMessage,
    createConversation,
    deleteConversation,
    getConversation,
    listConversations,
    listMessages,
    renameConversation,
    setConversationResumeContext,
  };
}
