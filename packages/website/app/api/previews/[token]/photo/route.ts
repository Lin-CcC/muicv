import { setUserPreviewPhotoUrl } from '@/lib/preview';
import { getCurrentSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

const TOKEN_RE = /^[0-9a-f-]{36}$/i;

/**
 * POST /api/previews/:token/photo —— 设置或清除 preview 简历的 photoUrl。
 *
 * body: { photoUrl: string | null }
 *   - 非空 string：必须是 https://*.muicv.com 域下的 URL（防客户端塞外链）
 *   - null：清除头像
 */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const session = await getCurrentSession();
  if (!session?.user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { token } = await ctx.params;
  if (!TOKEN_RE.test(token)) {
    return Response.json({ error: 'invalid-token' }, { status: 400 });
  }
  let payload: { photoUrl?: unknown } = {};
  try {
    payload = (await req.json()) as { photoUrl?: unknown };
  } catch {
    return Response.json({ error: 'invalid-json' }, { status: 400 });
  }
  let next: string | null;
  if (payload.photoUrl === null) {
    next = null;
  } else if (typeof payload.photoUrl === 'string') {
    try {
      const u = new URL(payload.photoUrl);
      if (!/(^|\.)muicv\.com$/.test(u.hostname)) {
        return Response.json({ error: 'photoUrl 必须是 muicv.com 域下的 URL' }, { status: 400 });
      }
      next = payload.photoUrl;
    } catch {
      return Response.json({ error: 'photoUrl 不是合法 URL' }, { status: 400 });
    }
  } else {
    return Response.json({ error: 'photoUrl 必须是 string 或 null' }, { status: 400 });
  }
  const ok = await setUserPreviewPhotoUrl(session.user.id, token, next);
  if (!ok) return Response.json({ error: 'not-found-or-not-owner' }, { status: 404 });
  return Response.json({ ok: true, photoUrl: next });
}
