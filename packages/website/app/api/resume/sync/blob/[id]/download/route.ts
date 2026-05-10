import { getCloudflareContext } from '@opennextjs/cloudflare';

import { userOwnsBlob } from '@/lib/resume-sync';
import { getCurrentSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * GET /api/resume/sync/blob/[id]/download —— dashboard 上点击下载按钮时拉密文 zip。
 * 鉴权走 next.js cookie session（不是 mui_ key），校验 blobId 属于该用户后从 R2 流式回吐。
 * 浏览器收到 application/zip + Content-Disposition attachment 自动触发下载。
 */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();
  if (!session?.user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  const { id: blobId } = await ctx.params;
  if (!blobId || !/^[a-zA-Z0-9-]{8,64}$/.test(blobId)) {
    return Response.json({ error: 'invalid blob id' }, { status: 400 });
  }

  if (!(await userOwnsBlob(userId, blobId))) {
    return Response.json({ error: 'not-found' }, { status: 404 });
  }

  const { env } = await getCloudflareContext({ async: true });
  const object = await env.MUICV_RESUME_BLOB.get(`users/${userId}/blobs/${blobId}.zip`);
  if (!object) {
    return Response.json({ error: 'blob-missing' }, { status: 410 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('Content-Type', 'application/zip');
  headers.set('Content-Disposition', `attachment; filename="muicv-resume-${blobId}.zip"`);
  if (object.size != null) headers.set('Content-Length', String(object.size));

  return new Response(object.body as ReadableStream, { status: 200, headers });
}
