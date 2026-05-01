import { RESUME_SYNC_HISTORY_KEEP } from '@muicv/shared';
import { and, desc, eq } from 'drizzle-orm';

import { getDb, schema } from './db';

/**
 * 推送一份新活动版：把当前活动版（如果有）搬到 history，然后 upsert 新版。
 * 不做内容校验、不算 hash —— 上游（API route 或 skill route）负责给 final fields。
 */
export async function archiveAndUpsertSnapshot(params: {
  userId: string;
  files: string;
  hash: string;
  sizeBytes: number;
  fileCount: number;
}): Promise<{ updatedAt: Date }> {
  const { userId, files, hash, sizeBytes, fileCount } = params;
  const db = await getDb();
  const now = new Date();

  const active = await db
    .select({
      files: schema.resumeSnapshot.files,
      hash: schema.resumeSnapshot.hash,
      sizeBytes: schema.resumeSnapshot.sizeBytes,
      fileCount: schema.resumeSnapshot.fileCount,
      updatedAt: schema.resumeSnapshot.updatedAt,
    })
    .from(schema.resumeSnapshot)
    .where(eq(schema.resumeSnapshot.userId, userId))
    .limit(1);

  if (active[0]) {
    await db.insert(schema.resumeSnapshotHistory).values({
      id: crypto.randomUUID(),
      userId,
      files: active[0].files,
      hash: active[0].hash,
      sizeBytes: active[0].sizeBytes,
      fileCount: active[0].fileCount,
      archivedAt: active[0].updatedAt,
    });
  }

  await db
    .insert(schema.resumeSnapshot)
    .values({ userId, files, hash, sizeBytes, fileCount, updatedAt: now })
    .onConflictDoUpdate({
      target: schema.resumeSnapshot.userId,
      set: { files, hash, sizeBytes, fileCount, updatedAt: now },
    });

  // 修剪 history：超出 RESUME_SYNC_HISTORY_KEEP 的旧条目按 archivedAt 升序删除
  const histRows = await db
    .select({ id: schema.resumeSnapshotHistory.id, archivedAt: schema.resumeSnapshotHistory.archivedAt })
    .from(schema.resumeSnapshotHistory)
    .where(eq(schema.resumeSnapshotHistory.userId, userId))
    .orderBy(desc(schema.resumeSnapshotHistory.archivedAt));
  if (histRows.length > RESUME_SYNC_HISTORY_KEEP) {
    const toDelete = histRows.slice(RESUME_SYNC_HISTORY_KEEP).map((r) => r.id);
    for (const id of toDelete) {
      await db
        .delete(schema.resumeSnapshotHistory)
        .where(and(eq(schema.resumeSnapshotHistory.id, id), eq(schema.resumeSnapshotHistory.userId, userId)));
    }
  }

  return { updatedAt: now };
}

export async function getResumeSyncStatus(userId: string): Promise<{
  active: {
    hash: string;
    sizeBytes: number;
    fileCount: number;
    updatedAt: number;
  } | null;
  history: Array<{
    id: string;
    hash: string;
    sizeBytes: number;
    fileCount: number;
    archivedAt: number;
  }>;
}> {
  const db = await getDb();
  const [activeRow] = await db
    .select({
      hash: schema.resumeSnapshot.hash,
      sizeBytes: schema.resumeSnapshot.sizeBytes,
      fileCount: schema.resumeSnapshot.fileCount,
      updatedAt: schema.resumeSnapshot.updatedAt,
    })
    .from(schema.resumeSnapshot)
    .where(eq(schema.resumeSnapshot.userId, userId))
    .limit(1);

  const histRows = await db
    .select({
      id: schema.resumeSnapshotHistory.id,
      hash: schema.resumeSnapshotHistory.hash,
      sizeBytes: schema.resumeSnapshotHistory.sizeBytes,
      fileCount: schema.resumeSnapshotHistory.fileCount,
      archivedAt: schema.resumeSnapshotHistory.archivedAt,
    })
    .from(schema.resumeSnapshotHistory)
    .where(eq(schema.resumeSnapshotHistory.userId, userId))
    .orderBy(desc(schema.resumeSnapshotHistory.archivedAt));

  return {
    active: activeRow
      ? {
          hash: activeRow.hash,
          sizeBytes: activeRow.sizeBytes,
          fileCount: activeRow.fileCount,
          updatedAt: activeRow.updatedAt.getTime(),
        }
      : null,
    history: histRows.map((r) => ({
      id: r.id,
      hash: r.hash,
      sizeBytes: r.sizeBytes,
      fileCount: r.fileCount,
      archivedAt: r.archivedAt.getTime(),
    })),
  };
}
