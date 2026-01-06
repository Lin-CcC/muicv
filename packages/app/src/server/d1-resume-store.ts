import type { ConversationId, ResumeJson, UserId } from '@muicv/shared';

import type {
  ResumeSnapshot,
  ResumeSnapshotMeta,
  ResumeStore,
  SaveResumeSnapshotParams,
} from './resume-store-types.ts';
import { getResumeSnapshotRetentionLimit } from './resume-snapshot-retention.ts';
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

export function createD1ResumeStore(params: CreateD1ResumeStoreParams): ResumeStore {
  function createSnapshotId() {
    return crypto.randomUUID();
  }

  const statements = {
    insertOrIgnoreUser: params.database.prepare(
      'INSERT OR IGNORE INTO users (id, created_at, updated_at) VALUES (?, ?, ?)',
    ),
    updateUserUpdatedAt: params.database.prepare('UPDATE users SET updated_at = ? WHERE id = ?'),

    insertSnapshot: params.database.prepare(`
      INSERT INTO resume_snapshots (id, user_id, conversation_id, resume_json, created_at)
      VALUES (?, ?, ?, ?, ?)
    `),

    getLatestSnapshot: params.database.prepare(`
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
    `),

    listSnapshots: params.database.prepare(`
      SELECT
        id,
        user_id AS userId,
        conversation_id AS conversationId,
        created_at AS createdAt
      FROM resume_snapshots
      WHERE user_id = ?
      ORDER BY created_at DESC, id DESC
    `),

    getSnapshotById: params.database.prepare(`
      SELECT
        id,
        user_id AS userId,
        conversation_id AS conversationId,
        resume_json AS resumeJson,
        created_at AS createdAt
      FROM resume_snapshots
      WHERE user_id = ? AND id = ?
    `),

    deleteSnapshotById: params.database.prepare('DELETE FROM resume_snapshots WHERE user_id = ? AND id = ?'),
  } as const;

  async function getCurrentResume(userId: UserId): Promise<ResumeSnapshot | undefined> {
    const row = await statements.getLatestSnapshot.bind(userId).first<ResumeSnapshotRow>();
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
    const result = await statements.listSnapshots.bind(userId).all<ResumeSnapshotMetaRow>();
    return result.results.slice(0, limit).map((row) => ({
      conversationId: row.conversationId,
      createdAt: row.createdAt,
      id: row.id,
      userId: row.userId,
    }));
  }

  async function saveResumeSnapshot(saveParams: SaveResumeSnapshotParams): Promise<ResumeSnapshotMeta> {
    const now = createMonotonicIsoTimestamp();
    const snapshotId = createSnapshotId();

    await params.database.batch([
      statements.insertOrIgnoreUser.bind(saveParams.userId, now, now),
      statements.updateUserUpdatedAt.bind(now, saveParams.userId),
      statements.insertSnapshot.bind(
        snapshotId,
        saveParams.userId,
        (saveParams.conversationId ?? null) satisfies ConversationId | null,
        JSON.stringify(saveParams.resume),
        now,
      ),
    ]);

    const meta = await listResumeSnapshots(saveParams.userId);
    const idsToKeep = new Set(meta.map((item) => item.id));

    const allResult = await statements.listSnapshots.bind(saveParams.userId).all<ResumeSnapshotMetaRow>();
    const idsToDelete = allResult.results.map((row) => row.id).filter((id) => !idsToKeep.has(id));

    if (idsToDelete.length > 0) {
      await params.database.batch(idsToDelete.map((id) => statements.deleteSnapshotById.bind(saveParams.userId, id)));
    }

    return {
      conversationId: saveParams.conversationId ?? null,
      createdAt: now,
      id: snapshotId,
      userId: saveParams.userId,
    };
  }

  async function rollbackResumeSnapshot(userId: UserId, snapshotId: string): Promise<ResumeSnapshotMeta> {
    const row = await statements.getSnapshotById.bind(userId, snapshotId).first<ResumeSnapshotRow>();
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
