import { and, eq } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db';
import { archiveAndUpsertSnapshot } from '@/lib/resume-sync';
import { getCurrentSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * POST /api/resume/sync/history/[id]/restore
 *
 * 把一个历史快照恢复成活动版。流程跟 push 一致：先把当前活动版归档到 history，再 upsert
 * 新活动版（内容来自指定历史）。
 */
export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();
  if (!session?.user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await ctx.params;

  const db = await getDb();
  const [target] = await db
    .select({
      files: schema.resumeSnapshotHistory.files,
      hash: schema.resumeSnapshotHistory.hash,
      sizeBytes: schema.resumeSnapshotHistory.sizeBytes,
      fileCount: schema.resumeSnapshotHistory.fileCount,
    })
    .from(schema.resumeSnapshotHistory)
    .where(and(eq(schema.resumeSnapshotHistory.id, id), eq(schema.resumeSnapshotHistory.userId, session.user.id)))
    .limit(1);

  if (!target) {
    return Response.json({ error: 'not-found' }, { status: 404 });
  }

  const { updatedAt } = await archiveAndUpsertSnapshot({
    userId: session.user.id,
    files: target.files,
    hash: target.hash,
    sizeBytes: target.sizeBytes,
    fileCount: target.fileCount,
  });

  return Response.json({ ok: true, updatedAt: updatedAt.getTime() });
}
