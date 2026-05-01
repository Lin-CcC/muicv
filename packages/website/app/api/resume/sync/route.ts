import { eq } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db';
import { getResumeSyncStatus } from '@/lib/resume-sync';
import { getCurrentSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** GET /api/resume/sync —— 拿活动版 metadata + 历史快照列表（不含 files 内容） */
export async function GET() {
  const session = await getCurrentSession();
  if (!session?.user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  const status = await getResumeSyncStatus(session.user.id);
  return Response.json(status);
}

/** DELETE /api/resume/sync —— 清空云端（活动版 + 全部历史） */
export async function DELETE() {
  const session = await getCurrentSession();
  if (!session?.user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  const db = await getDb();
  await db.delete(schema.resumeSnapshot).where(eq(schema.resumeSnapshot.userId, session.user.id));
  await db.delete(schema.resumeSnapshotHistory).where(eq(schema.resumeSnapshotHistory.userId, session.user.id));
  return Response.json({ ok: true });
}
