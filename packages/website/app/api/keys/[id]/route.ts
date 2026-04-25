import { and, eq, isNull } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** DELETE /api/keys/:id —— 撤销 key（软删，写 revokedAt）。 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();
  if (!session?.user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  if (typeof id !== 'string' || id.length === 0) {
    return Response.json({ error: 'invalid-id' }, { status: 400 });
  }

  const db = await getDb();
  const result = await db
    .update(schema.apiKey)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(schema.apiKey.id, id),
        eq(schema.apiKey.userId, session.user.id),
        isNull(schema.apiKey.revokedAt),
      ),
    )
    .returning({ id: schema.apiKey.id });

  if (result.length === 0) {
    return Response.json({ error: 'not-found' }, { status: 404 });
  }

  return Response.json({ ok: true });
}
