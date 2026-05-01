import { and, eq } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** DELETE /api/resume/sync/history/[id] —— 删除某个历史快照 */
export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();
  if (!session?.user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await ctx.params;
  const db = await getDb();
  await db
    .delete(schema.resumeSnapshotHistory)
    .where(and(eq(schema.resumeSnapshotHistory.id, id), eq(schema.resumeSnapshotHistory.userId, session.user.id)));
  return Response.json({ ok: true });
}
