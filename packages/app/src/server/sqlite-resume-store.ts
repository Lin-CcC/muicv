import { randomUUID } from 'node:crypto';

import type { ConversationId, ResumeJson, UserId } from '@muicv/shared';
import type { DatabaseSync, StatementSync } from 'node:sqlite';

import type {
  CreateResumeParams,
  CreateResumeWithVersionParams,
  CreateResumeWithVersionResult,
  ResumeId,
  ResumeMeta,
  ResumeStore,
  ResumeVersion,
  ResumeVersionId,
  ResumeVersionMeta,
  SaveResumeVersionParams,
} from './resume-store-types.ts';
import { getResumeSnapshotRetentionLimit } from './resume-snapshot-retention.ts';
import {
  getDefaultMigrationsDirectoryPath,
  getDefaultSqliteDatabaseFilePath,
  openSqliteDatabase,
} from './db/sqlite-database.ts';
import { createMonotonicIsoTimestamp } from './monotonic-time.ts';

type ResumeRow = {
  id: string;
  userId: string;
  title: string;
  sourceConversationId: string | null;
  createdAt: string;
  updatedAt: string;
};

type ResumeVersionRow = {
  id: string;
  resumeId: string;
  userId: string;
  resumeJson: string;
  createdAt: string;
};

type ResumeVersionMetaRow = {
  id: string;
  resumeId: string;
  userId: string;
  createdAt: string;
};

type EnsureUserStatements = {
  insertOrIgnoreUser: StatementSync;
  updateUserUpdatedAt: StatementSync;
};

type ResumeStoreStatements = EnsureUserStatements & {
  insertResume: StatementSync;
  updateResumeTitle: StatementSync;
  deleteResume: StatementSync;
  listResumes: StatementSync;
  getResume: StatementSync;

  insertVersion: StatementSync;
  updateResumeUpdatedAt: StatementSync;
  getLatestVersion: StatementSync;
  listVersions: StatementSync;
  listVersionIdsBeyondLimit: StatementSync;
  getVersionById: StatementSync;
  deleteVersionById: StatementSync;
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

  const insertResume = database.prepare(`
    INSERT INTO resumes (id, user_id, title, created_at, updated_at, source_conversation_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const updateResumeTitle = database.prepare(
    'UPDATE resumes SET title = ?, updated_at = ? WHERE user_id = ? AND id = ?',
  );
  const deleteResume = database.prepare('DELETE FROM resumes WHERE user_id = ? AND id = ?');

  const listResumes = database.prepare(`
    SELECT
      id,
      user_id AS userId,
      title,
      source_conversation_id AS sourceConversationId,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM resumes
    WHERE user_id = ?
    ORDER BY updated_at DESC, id DESC
  `);

  const getResume = database.prepare(`
    SELECT
      id,
      user_id AS userId,
      title,
      source_conversation_id AS sourceConversationId,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM resumes
    WHERE user_id = ? AND id = ?
  `);

  const insertVersion = database.prepare(`
    INSERT INTO resume_versions (id, resume_id, user_id, resume_json, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  const updateResumeUpdatedAt = database.prepare('UPDATE resumes SET updated_at = ? WHERE user_id = ? AND id = ?');

  const getLatestVersion = database.prepare(`
    SELECT
      id,
      resume_id AS resumeId,
      user_id AS userId,
      resume_json AS resumeJson,
      created_at AS createdAt
    FROM resume_versions
    WHERE user_id = ? AND resume_id = ?
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  `);

  const listVersions = database.prepare(`
    SELECT
      id,
      resume_id AS resumeId,
      user_id AS userId,
      created_at AS createdAt
    FROM resume_versions
    WHERE user_id = ? AND resume_id = ?
    ORDER BY created_at DESC, id DESC
  `);

  const listVersionIdsBeyondLimit = database.prepare(`
    SELECT id
    FROM resume_versions
    WHERE user_id = ? AND resume_id = ?
    ORDER BY created_at DESC, id DESC
    LIMIT -1 OFFSET ?
  `);

  const getVersionById = database.prepare(`
    SELECT
      id,
      resume_id AS resumeId,
      user_id AS userId,
      resume_json AS resumeJson,
      created_at AS createdAt
    FROM resume_versions
    WHERE user_id = ? AND resume_id = ? AND id = ?
  `);

  const deleteVersionById = database.prepare(
    'DELETE FROM resume_versions WHERE user_id = ? AND resume_id = ? AND id = ?',
  );

  return {
    deleteResume,
    deleteVersionById,
    getLatestVersion,
    getResume,
    getVersionById,
    insertOrIgnoreUser,
    insertResume,
    insertVersion,
    listResumes,
    listVersionIdsBeyondLimit,
    listVersions,
    updateResumeTitle,
    updateResumeUpdatedAt,
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

function normalizeTitle(value: string | undefined) {
  const title = value?.trim();
  return title ? title : '新简历';
}

export type CreateSqliteResumeStoreParams = {
  database: DatabaseSync;
};

export function createSqliteResumeStore(params: CreateSqliteResumeStoreParams): ResumeStore {
  const statements = createStatements(params.database);

  function trimOldVersions(userId: UserId, resumeId: ResumeId) {
    const limit = getResumeSnapshotRetentionLimit();
    const rows = statements.listVersionIdsBeyondLimit.all(userId, resumeId, limit) as unknown as Array<{ id: string }>;
    for (const row of rows) {
      statements.deleteVersionById.run(userId, resumeId, row.id);
    }
  }

  async function listResumes(userId: UserId): Promise<ResumeMeta[]> {
    const rows = statements.listResumes.all(userId) as unknown as ResumeRow[];
    return rows.map((row) => ({
      createdAt: row.createdAt,
      id: row.id,
      sourceConversationId: row.sourceConversationId,
      title: row.title,
      updatedAt: row.updatedAt,
      userId: row.userId,
    }));
  }

  async function getResume(userId: UserId, resumeId: ResumeId): Promise<ResumeMeta | undefined> {
    const row = statements.getResume.get(userId, resumeId) as unknown as ResumeRow | undefined;
    if (!row) return undefined;
    return {
      createdAt: row.createdAt,
      id: row.id,
      sourceConversationId: row.sourceConversationId,
      title: row.title,
      updatedAt: row.updatedAt,
      userId: row.userId,
    };
  }

  async function createResume(createParams: CreateResumeParams): Promise<ResumeMeta> {
    const now = createMonotonicIsoTimestamp();
    const resumeId = randomUUID();
    const title = normalizeTitle(createParams.title);
    const sourceConversationId = (createParams.sourceConversationId ?? null) satisfies ConversationId | null;

    runInTransaction(params.database, () => {
      ensureUserExists(statements, createParams.userId, now);
      statements.insertResume.run(resumeId, createParams.userId, title, now, now, sourceConversationId);
    });

    return {
      createdAt: now,
      id: resumeId,
      sourceConversationId,
      title,
      updatedAt: now,
      userId: createParams.userId,
    };
  }

  async function createResumeWithVersion(
    createParams: CreateResumeWithVersionParams,
  ): Promise<CreateResumeWithVersionResult> {
    const now = createMonotonicIsoTimestamp();
    const resumeId = randomUUID();
    const versionId = randomUUID();
    const title = normalizeTitle(createParams.title);
    const sourceConversationId = (createParams.sourceConversationId ?? null) satisfies ConversationId | null;

    runInTransaction(params.database, () => {
      ensureUserExists(statements, createParams.userId, now);
      statements.insertResume.run(resumeId, createParams.userId, title, now, now, sourceConversationId);
      statements.insertVersion.run(versionId, resumeId, createParams.userId, JSON.stringify(createParams.resume), now);
    });

    return {
      resume: {
        createdAt: now,
        id: resumeId,
        sourceConversationId,
        title,
        updatedAt: now,
        userId: createParams.userId,
      },
      version: {
        createdAt: now,
        id: versionId,
        resumeId,
        userId: createParams.userId,
      },
    };
  }

  async function renameResume(userId: UserId, resumeId: ResumeId, title: string): Promise<ResumeMeta> {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      throw new Error('标题不能为空');
    }

    const now = createMonotonicIsoTimestamp();
    const updated = runInTransaction(params.database, () => {
      const result = statements.updateResumeTitle.run(normalizedTitle, now, userId, resumeId);
      if (Number(result.changes) !== 1) {
        throw new Error('简历不存在');
      }

      const row = statements.getResume.get(userId, resumeId) as unknown as ResumeRow | undefined;
      if (!row) {
        throw new Error('简历不存在');
      }
      return row;
    });

    return {
      createdAt: updated.createdAt,
      id: updated.id,
      sourceConversationId: updated.sourceConversationId,
      title: updated.title,
      updatedAt: updated.updatedAt,
      userId: updated.userId,
    };
  }

  async function deleteResume(userId: UserId, resumeId: ResumeId): Promise<void> {
    statements.deleteResume.run(userId, resumeId);
  }

  async function getCurrentResumeVersion(userId: UserId, resumeId: ResumeId): Promise<ResumeVersion | undefined> {
    const row = statements.getLatestVersion.get(userId, resumeId) as unknown as ResumeVersionRow | undefined;
    if (!row) return undefined;

    return {
      createdAt: row.createdAt,
      id: row.id,
      resume: parseResumeJson(row.resumeJson),
      resumeId: row.resumeId,
      userId: row.userId,
    };
  }

  async function listResumeVersions(userId: UserId, resumeId: ResumeId): Promise<ResumeVersionMeta[]> {
    const limit = getResumeSnapshotRetentionLimit();
    const rows = statements.listVersions.all(userId, resumeId) as unknown as ResumeVersionMetaRow[];

    return rows.slice(0, limit).map((row) => ({
      createdAt: row.createdAt,
      id: row.id,
      resumeId: row.resumeId,
      userId: row.userId,
    }));
  }

  async function saveResumeVersion(saveParams: SaveResumeVersionParams): Promise<ResumeVersionMeta> {
    const now = createMonotonicIsoTimestamp();
    const versionId = randomUUID();

    const resume = await getResume(saveParams.userId, saveParams.resumeId);
    if (!resume) {
      throw new Error('简历不存在');
    }

    runInTransaction(params.database, () => {
      ensureUserExists(statements, saveParams.userId, now);
      statements.insertVersion.run(
        versionId,
        saveParams.resumeId,
        saveParams.userId,
        JSON.stringify(saveParams.resume),
        now,
      );
      statements.updateResumeUpdatedAt.run(now, saveParams.userId, saveParams.resumeId);
      trimOldVersions(saveParams.userId, saveParams.resumeId);
    });

    return {
      createdAt: now,
      id: versionId,
      resumeId: saveParams.resumeId,
      userId: saveParams.userId,
    };
  }

  async function rollbackResumeVersion(
    userId: UserId,
    resumeId: ResumeId,
    versionId: ResumeVersionId,
  ): Promise<ResumeVersionMeta> {
    const row = statements.getVersionById.get(userId, resumeId, versionId) as unknown as ResumeVersionRow | undefined;
    if (!row) {
      throw new Error('找不到要回滚的版本');
    }

    return saveResumeVersion({
      resume: parseResumeJson(row.resumeJson),
      resumeId,
      userId,
    });
  }

  return {
    createResume,
    createResumeWithVersion,
    deleteResume,
    getCurrentResumeVersion,
    getResume,
    listResumes,
    listResumeVersions,
    renameResume,
    rollbackResumeVersion,
    saveResumeVersion,
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
