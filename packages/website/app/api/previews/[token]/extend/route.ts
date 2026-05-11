import { extendUserPreview, isPreviewTtlDays } from '@/lib/preview';
import { getCurrentSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

const TOKEN_RE = /^[0-9a-f-]{36}$/i;

/** POST /api/previews/:token/extend  body { ttlDays: 1|7|30 } */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const session = await getCurrentSession();
  if (!session?.user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { token } = await ctx.params;
  if (!TOKEN_RE.test(token)) {
    return Response.json({ error: 'invalid-token' }, { status: 400 });
  }
  let payload: { ttlDays?: unknown } = {};
  try {
    payload = (await req.json()) as { ttlDays?: unknown };
  } catch {
    return Response.json({ error: 'invalid-json' }, { status: 400 });
  }
  const ttlDays = isPreviewTtlDays(payload.ttlDays) ? payload.ttlDays : 7;
  const newExpiresAt = await extendUserPreview(session.user.id, token, ttlDays);
  if (newExpiresAt == null) {
    return Response.json({ error: 'not-found-or-not-owner' }, { status: 404 });
  }
  return Response.json({ ok: true, expiresAt: newExpiresAt });
}
