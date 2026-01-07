import { randomUUID } from 'node:crypto';

import type { ChatMessage, Conversation, ConversationId, UserId } from '@muicv/shared';
import type { DatabaseSync, StatementSync } from 'node:sqlite';

import type { AddMessageParams, ChatStore, CreateConversationParams } from './chat-store-types.ts';
import {
  getDefaultMigrationsDirectoryPath,
  getDefaultSqliteDatabaseFilePath,
  openSqliteDatabase,
} from './db/sqlite-database.ts';

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

type EnsureUserStatements = {
  insertOrIgnoreUser: StatementSync;
  updateUserUpdatedAt: StatementSync;
};

type ChatStoreStatements = EnsureUserStatements & {
  listConversations: StatementSync;
  getConversation: StatementSync;
  insertConversation: StatementSync;
  updateConversationTitleAndUpdatedAt: StatementSync;
  updateConversationResumeContext: StatementSync;
  deleteConversation: StatementSync;
  clearConversationReferencesFromResumeSnapshots: StatementSync;
  clearConversationReferencesFromUsageLogs: StatementSync;
  clearConversationReferencesFromMemoryEntries: StatementSync;
  deleteMessagesByConversationId: StatementSync;
  listMessages: StatementSync;
  insertMessage: StatementSync;
  updateConversationUpdatedAt: StatementSync;
};

function runInTransaction<Result>(database: DatabaseSync, fn: () => Result) {
  database.exec('BEGIN');
  try {
    const result = fn();
    database.exec('COMMIT');
    return result;
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

function createChatStoreStatements(database: DatabaseSync): ChatStoreStatements {
  const insertOrIgnoreUser = database.prepare(
    'INSERT OR IGNORE INTO users (id, created_at, updated_at) VALUES (?, ?, ?)',
  );
  const updateUserUpdatedAt = database.prepare('UPDATE users SET updated_at = ? WHERE id = ?');

  const listConversations = database.prepare(`
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
  `);

  const getConversation = database.prepare(`
    SELECT
      id,
      user_id AS userId,
      title,
      context_resume_id AS contextResumeId,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM conversations
    WHERE id = ?
  `);

  const insertConversation = database.prepare(`
    INSERT INTO conversations (id, user_id, title, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  const updateConversationTitleAndUpdatedAt = database.prepare(
    'UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?',
  );

  const updateConversationResumeContext = database.prepare(
    'UPDATE conversations SET context_resume_id = ?, updated_at = ? WHERE id = ?',
  );

  const deleteConversation = database.prepare('DELETE FROM conversations WHERE id = ?');

  const clearConversationReferencesFromResumeSnapshots = database.prepare(
    'UPDATE resume_snapshots SET conversation_id = NULL WHERE conversation_id = ?',
  );

  const clearConversationReferencesFromUsageLogs = database.prepare(
    'UPDATE usage_logs SET conversation_id = NULL WHERE conversation_id = ?',
  );

  const clearConversationReferencesFromMemoryEntries = database.prepare(
    'UPDATE memory_entries SET conversation_id = NULL, message_id = NULL WHERE conversation_id = ?',
  );

  const deleteMessagesByConversationId = database.prepare('DELETE FROM messages WHERE conversation_id = ?');

  const listMessages = database.prepare(`
    SELECT
      id,
      conversation_id AS conversationId,
      role,
      content,
      created_at AS createdAt
    FROM messages
    WHERE conversation_id = ?
    ORDER BY created_at ASC
  `);

  const insertMessage = database.prepare(`
    INSERT INTO messages (id, conversation_id, role, content, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  const updateConversationUpdatedAt = database.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?');

  return {
    clearConversationReferencesFromResumeSnapshots,
    clearConversationReferencesFromUsageLogs,
    clearConversationReferencesFromMemoryEntries,
    deleteConversation,
    deleteMessagesByConversationId,
    getConversation,
    insertConversation,
    insertMessage,
    insertOrIgnoreUser,
    listConversations,
    listMessages,
    updateConversationTitleAndUpdatedAt,
    updateConversationResumeContext,
    updateConversationUpdatedAt,
    updateUserUpdatedAt,
  };
}

function ensureUserExists(statements: EnsureUserStatements, userId: UserId, now: string) {
  statements.insertOrIgnoreUser.run(userId, now, now);
  statements.updateUserUpdatedAt.run(now, userId);
}

export type CreateSqliteChatStoreParams = {
  database: DatabaseSync;
};

export function createSqliteChatStore(storeParams: CreateSqliteChatStoreParams): ChatStore {
  const statements = createChatStoreStatements(storeParams.database);

  async function listConversations(userId: UserId): Promise<Conversation[]> {
    const rows = statements.listConversations.all(userId) as unknown as ConversationRow[];
    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      title: row.title,
      contextResumeId: row.contextResumeId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  async function getConversation(conversationId: ConversationId): Promise<Conversation | undefined> {
    const row = statements.getConversation.get(conversationId) as unknown as ConversationRow | undefined;
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
    const conversationId = randomUUID();
    const title = createConversationParams.title?.trim() ? createConversationParams.title.trim() : '新对话';

    runInTransaction(storeParams.database, () => {
      ensureUserExists(statements, createConversationParams.userId, now);
      statements.insertConversation.run(conversationId, createConversationParams.userId, title, now, now);
    });

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

    const updatedConversation = runInTransaction(storeParams.database, () => {
      const updated = statements.updateConversationTitleAndUpdatedAt.run(normalizedTitle, now, conversationId);
      if (Number(updated.changes) !== 1) {
        throw new Error(`对话不存在：${conversationId}`);
      }

      const row = statements.getConversation.get(conversationId) as unknown as ConversationRow | undefined;
      if (!row) {
        throw new Error(`对话不存在：${conversationId}`);
      }

      return row;
    });

    return {
      id: updatedConversation.id,
      userId: updatedConversation.userId,
      title: updatedConversation.title,
      contextResumeId: updatedConversation.contextResumeId,
      createdAt: updatedConversation.createdAt,
      updatedAt: updatedConversation.updatedAt,
    };
  }

  async function setConversationResumeContext(
    conversationId: ConversationId,
    resumeId: string | null,
  ): Promise<Conversation> {
    const now = new Date().toISOString();

    const updatedConversation = runInTransaction(storeParams.database, () => {
      const updated = statements.updateConversationResumeContext.run(resumeId, now, conversationId);
      if (Number(updated.changes) !== 1) {
        throw new Error(`对话不存在：${conversationId}`);
      }

      const row = statements.getConversation.get(conversationId) as unknown as ConversationRow | undefined;
      if (!row) {
        throw new Error(`对话不存在：${conversationId}`);
      }

      return row;
    });

    return {
      id: updatedConversation.id,
      userId: updatedConversation.userId,
      title: updatedConversation.title,
      contextResumeId: updatedConversation.contextResumeId,
      createdAt: updatedConversation.createdAt,
      updatedAt: updatedConversation.updatedAt,
    };
  }

  async function deleteConversation(conversationId: ConversationId) {
    runInTransaction(storeParams.database, () => {
      statements.clearConversationReferencesFromResumeSnapshots.run(conversationId);
      statements.clearConversationReferencesFromUsageLogs.run(conversationId);
      statements.clearConversationReferencesFromMemoryEntries.run(conversationId);
      statements.deleteMessagesByConversationId.run(conversationId);
      statements.deleteConversation.run(conversationId);
    });
  }

  async function listMessages(conversationId: ConversationId): Promise<ChatMessage[]> {
    const rows = statements.listMessages.all(conversationId) as unknown as MessageRow[];
    return rows.map((row) => ({
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
      id: randomUUID(),
      conversationId: addMessageParams.conversationId,
      role: addMessageParams.role,
      content: addMessageParams.content,
      createdAt: now,
    };

    runInTransaction(storeParams.database, () => {
      const updated = statements.updateConversationUpdatedAt.run(now, addMessageParams.conversationId);
      if (Number(updated.changes) !== 1) {
        throw new Error(`对话不存在：${addMessageParams.conversationId}`);
      }

      statements.insertMessage.run(
        message.id,
        message.conversationId,
        message.role,
        message.content,
        message.createdAt,
      );
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
    renameConversation,
    setConversationResumeContext,
  };
}

export type CreateDefaultSqliteChatStoreParams = {
  sqlitePath?: string;
};

export function createDefaultSqliteChatStore(params?: CreateDefaultSqliteChatStoreParams): ChatStore {
  const database = openSqliteDatabase({
    databaseFilePath: params?.sqlitePath ?? process.env.MUICV_SQLITE_PATH ?? getDefaultSqliteDatabaseFilePath(),
    migrationsDirectoryPath: getDefaultMigrationsDirectoryPath(),
  });

  return createSqliteChatStore({ database });
}
