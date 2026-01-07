import type { ConversationId, ResumeJson, UserId } from '@muicv/shared';

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

export type CreateD1ResumeStoreParams = {
  database: D1Database;
};

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

export function createD1ResumeStore(params: CreateD1ResumeStoreParams): ResumeStore {
  function createResumeId(): ResumeId {
    return crypto.randomUUID();
  }

  function createVersionId(): ResumeVersionId {
    return crypto.randomUUID();
  }

  const statements = {
    insertOrIgnoreUser: params.database.prepare(
      'INSERT OR IGNORE INTO users (id, created_at, updated_at) VALUES (?, ?, ?)',
    ),
    updateUserUpdatedAt: params.database.prepare('UPDATE users SET updated_at = ? WHERE id = ?'),

    insertResume: params.database.prepare(`
      INSERT INTO resumes (id, user_id, title, created_at, updated_at, source_conversation_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `),

    updateResumeTitle: params.database.prepare(
      'UPDATE resumes SET title = ?, updated_at = ? WHERE user_id = ? AND id = ?',
    ),

    deleteResume: params.database.prepare('DELETE FROM resumes WHERE user_id = ? AND id = ?'),

    listResumes: params.database.prepare(`
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
    `),

    getResume: params.database.prepare(`
      SELECT
        id,
        user_id AS userId,
        title,
        source_conversation_id AS sourceConversationId,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM resumes
      WHERE user_id = ? AND id = ?
    `),

    insertVersion: params.database.prepare(`
      INSERT INTO resume_versions (id, resume_id, user_id, resume_json, created_at)
      VALUES (?, ?, ?, ?, ?)
    `),

    getLatestVersion: params.database.prepare(`
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
    `),

    listVersions: params.database.prepare(`
      SELECT
        id,
        resume_id AS resumeId,
        user_id AS userId,
        created_at AS createdAt
      FROM resume_versions
      WHERE user_id = ? AND resume_id = ?
      ORDER BY created_at DESC, id DESC
    `),

    getVersionById: params.database.prepare(`
      SELECT
        id,
        resume_id AS resumeId,
        user_id AS userId,
        resume_json AS resumeJson,
        created_at AS createdAt
      FROM resume_versions
      WHERE user_id = ? AND resume_id = ? AND id = ?
    `),

    deleteVersionById: params.database.prepare(
      'DELETE FROM resume_versions WHERE user_id = ? AND resume_id = ? AND id = ?',
    ),

    updateResumeUpdatedAt: params.database.prepare('UPDATE resumes SET updated_at = ? WHERE user_id = ? AND id = ?'),
  } as const;

  async function listResumes(userId: UserId): Promise<ResumeMeta[]> {
    const result = await statements.listResumes.bind(userId).all<ResumeRow>();
    return result.results.map((row) => ({
      createdAt: row.createdAt,
      id: row.id,
      sourceConversationId: row.sourceConversationId,
      title: row.title,
      updatedAt: row.updatedAt,
      userId: row.userId,
    }));
  }

  async function getResume(userId: UserId, resumeId: ResumeId): Promise<ResumeMeta | undefined> {
    const row = await statements.getResume.bind(userId, resumeId).first<ResumeRow>();
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
    const resumeId = createResumeId();
    const title = normalizeTitle(createParams.title);
    const sourceConversationId = (createParams.sourceConversationId ?? null) satisfies ConversationId | null;

    await params.database.batch([
      statements.insertOrIgnoreUser.bind(createParams.userId, now, now),
      statements.updateUserUpdatedAt.bind(now, createParams.userId),
      statements.insertResume.bind(resumeId, createParams.userId, title, now, now, sourceConversationId),
    ]);

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
    const resumeId = createResumeId();
    const versionId = createVersionId();
    const title = normalizeTitle(createParams.title);
    const sourceConversationId = (createParams.sourceConversationId ?? null) satisfies ConversationId | null;

    await params.database.batch([
      statements.insertOrIgnoreUser.bind(createParams.userId, now, now),
      statements.updateUserUpdatedAt.bind(now, createParams.userId),
      statements.insertResume.bind(resumeId, createParams.userId, title, now, now, sourceConversationId),
      statements.insertVersion.bind(versionId, resumeId, createParams.userId, JSON.stringify(createParams.resume), now),
    ]);

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
    const result = await statements.updateResumeTitle.bind(normalizedTitle, now, userId, resumeId).run();
    if (result.meta.changes !== 1) {
      throw new Error('简历不存在');
    }

    const updated = await getResume(userId, resumeId);
    if (!updated) {
      throw new Error('简历不存在');
    }

    return updated;
  }

  async function deleteResume(userId: UserId, resumeId: ResumeId): Promise<void> {
    await statements.deleteResume.bind(userId, resumeId).run();
  }

  async function getCurrentResumeVersion(userId: UserId, resumeId: ResumeId): Promise<ResumeVersion | undefined> {
    const row = await statements.getLatestVersion.bind(userId, resumeId).first<ResumeVersionRow>();
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
    const result = await statements.listVersions.bind(userId, resumeId).all<ResumeVersionMetaRow>();
    return result.results.slice(0, limit).map((row) => ({
      createdAt: row.createdAt,
      id: row.id,
      resumeId: row.resumeId,
      userId: row.userId,
    }));
  }

  async function trimOldVersions(userId: UserId, resumeId: ResumeId) {
    const limit = getResumeSnapshotRetentionLimit();
    const meta = await statements.listVersions.bind(userId, resumeId).all<ResumeVersionMetaRow>();
    const idsToKeep = new Set(meta.results.slice(0, limit).map((item) => item.id));

    const idsToDelete = meta.results.map((row) => row.id).filter((id) => !idsToKeep.has(id));
    if (idsToDelete.length === 0) return;

    await params.database.batch(idsToDelete.map((id) => statements.deleteVersionById.bind(userId, resumeId, id)));
  }

  async function saveResumeVersion(saveParams: SaveResumeVersionParams): Promise<ResumeVersionMeta> {
    const now = createMonotonicIsoTimestamp();
    const versionId = createVersionId();

    const resume = await getResume(saveParams.userId, saveParams.resumeId);
    if (!resume) {
      throw new Error('简历不存在');
    }

    await params.database.batch([
      statements.insertOrIgnoreUser.bind(saveParams.userId, now, now),
      statements.updateUserUpdatedAt.bind(now, saveParams.userId),
      statements.insertVersion.bind(
        versionId,
        saveParams.resumeId,
        saveParams.userId,
        JSON.stringify(saveParams.resume),
        now,
      ),
      statements.updateResumeUpdatedAt.bind(now, saveParams.userId, saveParams.resumeId),
    ]);

    await trimOldVersions(saveParams.userId, saveParams.resumeId);

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
    const row = await statements.getVersionById.bind(userId, resumeId, versionId).first<ResumeVersionRow>();
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
