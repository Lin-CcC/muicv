import { getCloudflareContext } from '@opennextjs/cloudflare';

import { deleteUserPhotoUpload } from '@/lib/preview';
import { getCurrentSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** DELETE /api/photos/:id —— 删除一张历史照片（D1 行 + R2 对象），仅 owner。 */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();
  if (!session?.user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id: idStr } = await ctx.params;
  const id = Number.parseInt(idStr, 10);
  if (!Number.isFinite(id) || id <= 0) {
    return Response.json({ error: 'invalid-id' }, { status: 400 });
  }
  const r2Key = await deleteUserPhotoUpload(session.user.id, id);
  if (!r2Key) return Response.json({ error: 'not-found-or-not-owner' }, { status: 404 });

  // 删 R2 对象。即使 R2 删除失败也不回滚 D1——孤儿对象由后续 cron 对账
  // （账面更整洁优先；R2 单价对个人项目可忽略）。
  try {
    const { env } = await getCloudflareContext({ async: true });
    const bucket = (env as unknown as Record<string, unknown>).MUICV_PHOTOS as R2Bucket | undefined;
    if (bucket) await bucket.delete(r2Key);
  } catch (err) {
    console.error('R2 delete failed', { r2Key, err });
  }

  return Response.json({ ok: true });
}
