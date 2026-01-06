import { randomUUID } from 'node:crypto';

import type { ConversationId, ResumeJson, UserId } from '@muicv/shared';
import type { DatabaseSync, StatementSync } from 'node:sqlite';

import type {
  ResumeSnapshot,
  ResumeSnapshotMeta,
  ResumeStore,
  SaveResumeSnapshotParams,
} from './resume-store-types.ts';
import { getResumeSnapshotRetentionLimit } from './resume-snapshot-retention.ts';
import {
  getDefaultMigrationsDirectoryPath,
  getDefaultSqliteDatabaseFilePath,
  openSqliteDatabase,
} from './db/sqlite-database.ts';
import { createMonotonicIsoTimestamp } from './monotonic-time.ts';

type ResumeSnapshotRow = {
  id: string;
  userId: string;
  conversationId: string | null;
  resumeJson: string;
  createdAt: string;
};

type ResumeSnapshotMetaRow = {
  id: string;
  userId: string;
  conversationId: string | null;
  createdAt: string;
};

type EnsureUserStatements = {
  insertOrIgnoreUser: StatementSync;
  updateUserUpdatedAt: StatementSync;
};

type ResumeStoreStatements = EnsureUserStatements & {
  insertSnapshot: StatementSync;
  getLatestSnapshot: StatementSync;
  listSnapshots: StatementSync;
  listSnapshotIdsBeyondLimit: StatementSync;
  getSnapshotById: StatementSync;
  deleteSnapshotById: StatementSync;
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

function createStatements(database: DatabaseSync): ResumeStoreStatements {
  const insertOrIgnoreUser = database.prepare(
    'INSERT OR IGNORE INTO users (id, created_at, updated_at) VALUES (?, ?, ?)',
  );
  const updateUserUpdatedAt = database.prepare('UPDATE users SET updated_at = ? WHERE id = ?');

  const insertSnapshot = database.prepare(`
    INSERT INTO resume_snapshots (id, user_id, conversation_id, resume_json, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  const getLatestSnapshot = database.prepare(`
    SELECT
      id,
      user_id AS userId,
      conversation_id AS conversationId,
      resume_json AS resumeJson,
      created_at AS createdAt
    FROM resume_snapshots
    WHERE user_id = ?
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  `);

  const listSnapshots = database.prepare(`
    SELECT
      id,
      user_id AS userId,
      conversation_id AS conversationId,
      created_at AS createdAt
    FROM resume_snapshots
    WHERE user_id = ?
    ORDER BY created_at DESC, id DESC
  `);

  const listSnapshotIdsBeyondLimit = database.prepare(`
    SELECT id
    FROM resume_snapshots
    WHERE user_id = ?
    ORDER BY created_at DESC, id DESC
    LIMIT -1 OFFSET ?
  `);

  const getSnapshotById = database.prepare(`
    SELECT
      id,
      user_id AS userId,
      conversation_id AS conversationId,
      resume_json AS resumeJson,
      created_at AS createdAt
    FROM resume_snapshots
    WHERE user_id = ? AND id = ?
  `);

  const deleteSnapshotById = database.prepare('DELETE FROM resume_snapshots WHERE user_id = ? AND id = ?');

  return {
    deleteSnapshotById,
    getLatestSnapshot,
    getSnapshotById,
    insertOrIgnoreUser,
    insertSnapshot,
    listSnapshotIdsBeyondLimit,
    listSnapshots,
    updateUserUpdatedAt,
  };
}

function ensureUserExists(statements: EnsureUserStatements, userId: UserId, now: string) {
  statements.insertOrIgnoreUser.run(userId, now, now);
  statements.updateUserUpdatedAt.run(now, userId);
}

function isResumeJson(value: unknown): value is ResumeJson {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return record.version === 1 && typeof record.lastUpdatedAt === 'string' && typeof record.basicInfo === 'object';
}

function parseResumeJson(raw: string): ResumeJson {
  const parsed = JSON.parse(raw) as unknown;
  if (!isResumeJson(parsed)) {
    throw new Error('resume_json 格式不合法');
  }
  return parsed;
}

function trimOldSnapshots(statements: ResumeStoreStatements, userId: UserId, limit: number) {
  const rows = statements.listSnapshotIdsBeyondLimit.all(userId, limit) as unknown as Array<{ id: string }>;
  for (const row of rows) {
    statements.deleteSnapshotById.run(userId, row.id);
  }
}

export type CreateSqliteResumeStoreParams = {
  database: DatabaseSync;
};

export function createSqliteResumeStore(params: CreateSqliteResumeStoreParams): ResumeStore {
  const statements = createStatements(params.database);

  async function getCurrentResume(userId: UserId): Promise<ResumeSnapshot | undefined> {
    const row = statements.getLatestSnapshot.get(userId) as unknown as ResumeSnapshotRow | undefined;
    if (!row) return undefined;

    return {
      conversationId: row.conversationId,
      createdAt: row.createdAt,
      id: row.id,
      resume: parseResumeJson(row.resumeJson),
      userId: row.userId,
    };
  }

  async function listResumeSnapshots(userId: UserId): Promise<ResumeSnapshotMeta[]> {
    const limit = getResumeSnapshotRetentionLimit();
    const rows = statements.listSnapshots.all(userId) as unknown as ResumeSnapshotMetaRow[];
    return rows.slice(0, limit).map((row) => ({
      conversationId: row.conversationId,
      createdAt: row.createdAt,
      id: row.id,
      userId: row.userId,
    }));
  }

  async function saveResumeSnapshot(saveParams: SaveResumeSnapshotParams): Promise<ResumeSnapshotMeta> {
    const now = createMonotonicIsoTimestamp();
    const snapshotId = randomUUID();
    const retentionLimit = getResumeSnapshotRetentionLimit();

    runInTransaction(params.database, () => {
      ensureUserExists(statements, saveParams.userId, now);
      statements.insertSnapshot.run(
        snapshotId,
        saveParams.userId,
        (saveParams.conversationId ?? null) satisfies ConversationId | null,
        JSON.stringify(saveParams.resume),
        now,
      );
      trimOldSnapshots(statements, saveParams.userId, retentionLimit);
    });

    return {
      conversationId: saveParams.conversationId ?? null,
      createdAt: now,
      id: snapshotId,
      userId: saveParams.userId,
    };
  }

  async function rollbackResumeSnapshot(userId: UserId, snapshotId: string): Promise<ResumeSnapshotMeta> {
    const row = statements.getSnapshotById.get(userId, snapshotId) as unknown as ResumeSnapshotRow | undefined;
    if (!row) {
      throw new Error('找不到要回滚的版本');
    }

    const conversationId = row.conversationId ?? undefined;
    return saveResumeSnapshot({
      resume: parseResumeJson(row.resumeJson),
      userId,
      ...(conversationId ? { conversationId } : {}),
    });
  }

  return {
    getCurrentResume,
    listResumeSnapshots,
    rollbackResumeSnapshot,
    saveResumeSnapshot,
  };
}

export type CreateDefaultSqliteResumeStoreParams = {
  sqlitePath?: string;
};

export function createDefaultSqliteResumeStore(params?: CreateDefaultSqliteResumeStoreParams): ResumeStore {
  const database = openSqliteDatabase({
    databaseFilePath: params?.sqlitePath ?? process.env.MUICV_SQLITE_PATH ?? getDefaultSqliteDatabaseFilePath(),
    migrationsDirectoryPath: getDefaultMigrationsDirectoryPath(),
  });

  return createSqliteResumeStore({ database });
}
