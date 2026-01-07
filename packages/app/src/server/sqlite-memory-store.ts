import { randomUUID } from 'node:crypto';

import type { ConversationId, MemoryEntry, MemoryEntryKind, UserId } from '@muicv/shared';
import type { DatabaseSync, StatementSync } from 'node:sqlite';

import type { CreateMemoryEntryParams, ListMemoryEntriesParams, MemoryStore } from './memory-store-types.ts';
import {
  getDefaultMigrationsDirectoryPath,
  getDefaultSqliteDatabaseFilePath,
  openSqliteDatabase,
} from './db/sqlite-database.ts';
import { createMonotonicIsoTimestamp } from './monotonic-time.ts';

type MemoryEntryRow = {
  id: string;
  userId: string;
  conversationId: string | null;
  messageId: string | null;
  kind: MemoryEntryKind;
  title: string;
  detail: string | null;
  tagsJson: string | null;
  occurredAt: string | null;
  createdAt: string;
};

type EnsureUserStatements = {
  insertOrIgnoreUser: StatementSync;
  updateUserUpdatedAt: StatementSync;
};

type MemoryStoreStatements = EnsureUserStatements & {
  listByUser: StatementSync;
  listByUserAndConversation: StatementSync;
  insertEntry: StatementSync;
  clearConversationReferences: StatementSync;
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

function normalizeOptionalText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parseTagsJson(value: string | null): string[] | undefined {
  const raw = normalizeOptionalText(value);
  if (!raw) return undefined;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return undefined;
    const tags = parsed
      .filter((item) => typeof item === 'string')
      .map((tag) => tag.trim())
      .filter(Boolean);
    return tags.length > 0 ? tags : undefined;
  } catch {
    return undefined;
  }
}

function normalizeLimit(value: number | undefined) {
  if (value === undefined) return 50;
  if (!Number.isFinite(value)) return 50;
  const normalized = Math.floor(value);
  if (normalized <= 0) return 50;
  return Math.min(200, normalized);
}

function toMemoryEntry(row: MemoryEntryRow): MemoryEntry {
  const detail = normalizeOptionalText(row.detail);
  const tags = parseTagsJson(row.tagsJson);
  const occurredAt = normalizeOptionalText(row.occurredAt);

  return {
    conversationId: row.conversationId,
    createdAt: row.createdAt,
    id: row.id,
    kind: row.kind,
    messageId: row.messageId,
    title: row.title,
    userId: row.userId,
    ...(detail ? { detail } : {}),
    ...(tags ? { tags } : {}),
    ...(occurredAt ? { occurredAt } : {}),
  };
}

function createStatements(database: DatabaseSync): MemoryStoreStatements {
  const insertOrIgnoreUser = database.prepare(
    'INSERT OR IGNORE INTO users (id, created_at, updated_at) VALUES (?, ?, ?)',
  );
  const updateUserUpdatedAt = database.prepare('UPDATE users SET updated_at = ? WHERE id = ?');

  const listByUser = database.prepare(`
    SELECT
      id,
      user_id AS userId,
      conversation_id AS conversationId,
      message_id AS messageId,
      kind,
      title,
      detail,
      tags_json AS tagsJson,
      occurred_at AS occurredAt,
      created_at AS createdAt
    FROM memory_entries
    WHERE user_id = ?
    ORDER BY created_at DESC, id DESC
    LIMIT ?
  `);

  const listByUserAndConversation = database.prepare(`
    SELECT
      id,
      user_id AS userId,
      conversation_id AS conversationId,
      message_id AS messageId,
      kind,
      title,
      detail,
      tags_json AS tagsJson,
      occurred_at AS occurredAt,
      created_at AS createdAt
    FROM memory_entries
    WHERE user_id = ? AND conversation_id = ?
    ORDER BY created_at DESC, id DESC
    LIMIT ?
  `);

  const insertEntry = database.prepare(`
    INSERT INTO memory_entries (
      id,
      user_id,
      conversation_id,
      message_id,
      kind,
      title,
      detail,
      tags_json,
      occurred_at,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const clearConversationReferences = database.prepare(
    'UPDATE memory_entries SET conversation_id = NULL, message_id = NULL WHERE conversation_id = ?',
  );

  return {
    clearConversationReferences,
    insertEntry,
    insertOrIgnoreUser,
    listByUser,
    listByUserAndConversation,
    updateUserUpdatedAt,
  };
}

function ensureUserExists(statements: EnsureUserStatements, userId: UserId, now: string) {
  statements.insertOrIgnoreUser.run(userId, now, now);
  statements.updateUserUpdatedAt.run(now, userId);
}

export type CreateSqliteMemoryStoreParams = {
  database: DatabaseSync;
};

export function createSqliteMemoryStore(params: CreateSqliteMemoryStoreParams): MemoryStore {
  const statements = createStatements(params.database);

  async function listMemoryEntries(userId: UserId, listParams?: ListMemoryEntriesParams): Promise<MemoryEntry[]> {
    const limit = normalizeLimit(listParams?.limit);
    const conversationId = listParams?.conversationId;

    const rows = conversationId
      ? (statements.listByUserAndConversation.all(userId, conversationId, limit) as unknown as MemoryEntryRow[])
      : (statements.listByUser.all(userId, limit) as unknown as MemoryEntryRow[]);

    return rows.map(toMemoryEntry);
  }

  async function addMemoryEntry(createParams: CreateMemoryEntryParams): Promise<MemoryEntry> {
    const now = createMonotonicIsoTimestamp();
    const entryId = randomUUID();

    const title = createParams.title.trim();
    if (!title) {
      throw new Error('记忆条目的 title 不能为空');
    }

    const detail = normalizeOptionalText(createParams.detail);
    const occurredAt = normalizeOptionalText(createParams.occurredAt);
    const tags =
      createParams.tags && createParams.tags.length > 0
        ? createParams.tags.map((tag) => tag.trim()).filter(Boolean)
        : undefined;

    const conversationId = createParams.conversationId ?? null;
    const messageId = createParams.messageId ?? null;
    const tagsJson = tags ? JSON.stringify(tags) : null;

    runInTransaction(params.database, () => {
      ensureUserExists(statements, createParams.userId, now);
      statements.insertEntry.run(
        entryId,
        createParams.userId,
        conversationId satisfies ConversationId | null,
        messageId,
        createParams.kind,
        title,
        detail ?? null,
        tagsJson,
        occurredAt ?? null,
        now,
      );
    });

    return {
      conversationId,
      createdAt: now,
      id: entryId,
      kind: createParams.kind,
      messageId,
      title,
      userId: createParams.userId,
      ...(detail ? { detail } : {}),
      ...(tags ? { tags } : {}),
      ...(occurredAt ? { occurredAt } : {}),
    };
  }

  async function addMemoryEntries(createParamsList: CreateMemoryEntryParams[]): Promise<MemoryEntry[]> {
    const entries: MemoryEntry[] = [];
    for (const createParams of createParamsList) {
      entries.push(await addMemoryEntry(createParams));
    }
    return entries;
  }

  async function clearConversationReferences(conversationId: ConversationId): Promise<void> {
    statements.clearConversationReferences.run(conversationId);
  }

  return {
    addMemoryEntries,
    addMemoryEntry,
    clearConversationReferences,
    listMemoryEntries,
  };
}

export type CreateDefaultSqliteMemoryStoreParams = {
  sqlitePath?: string;
};

export function createDefaultSqliteMemoryStore(params?: CreateDefaultSqliteMemoryStoreParams): MemoryStore {
  const database = openSqliteDatabase({
    databaseFilePath: params?.sqlitePath ?? process.env.MUICV_SQLITE_PATH ?? getDefaultSqliteDatabaseFilePath(),
    migrationsDirectoryPath: getDefaultMigrationsDirectoryPath(),
  });

  return createSqliteMemoryStore({ database });
}
