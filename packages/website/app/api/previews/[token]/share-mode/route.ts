import { isPreviewShareMode, setUserPreviewShareMode } from '@/lib/preview';
import { getCurrentSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

const TOKEN_RE = /^[0-9a-f-]{36}$/i;

/** POST /api/previews/:token/share-mode  body { shareMode: 'link'|'public' } */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const session = await getCurrentSession();
  if (!session?.user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { token } = await ctx.params;
  if (!TOKEN_RE.test(token)) {
    return Response.json({ error: 'invalid-token' }, { status: 400 });
  }
  let payload: { shareMode?: unknown } = {};
  try {
    payload = (await req.json()) as { shareMode?: unknown };
  } catch {
    return Response.json({ error: 'invalid-json' }, { status: 400 });
  }
  if (!isPreviewShareMode(payload.shareMode)) {
    return Response.json({ error: 'invalid-share-mode' }, { status: 400 });
  }
  const ok = await setUserPreviewShareMode(session.user.id, token, payload.shareMode);
  if (!ok) return Response.json({ error: 'not-found-or-not-owner' }, { status: 404 });
  return Response.json({ ok: true, shareMode: payload.shareMode });
}
