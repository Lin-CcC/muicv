import { revokeUserPreview } from '@/lib/preview';
import { getCurrentSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

const TOKEN_RE = /^[0-9a-f-]{36}$/i;

/** DELETE /api/previews/:token —— 撤销分享链接（仅 owner）。 */
export async function DELETE(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const session = await getCurrentSession();
  if (!session?.user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { token } = await ctx.params;
  if (!TOKEN_RE.test(token)) {
    return Response.json({ error: 'invalid-token' }, { status: 400 });
  }
  const ok = await revokeUserPreview(session.user.id, token);
  if (!ok) return Response.json({ error: 'not-found-or-not-owner' }, { status: 404 });
  return Response.json({ ok: true });
}
