import { getCloudflareContext } from '@opennextjs/cloudflare';

import { insertUserPhotoUpload, listUserPhotoUploads } from '@/lib/preview';
import { getCurrentSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

/**
 * 公开 R2 域名。和 packages/api 共用同一 bucket，所以 URL 命名空间一致。
 * 没配置 env 时退回 i.muicv.com（生产配置）。
 */
function publicPhotoUrl(env: Record<string, unknown>, key: string): string {
  const base = (env.PHOTOS_PUBLIC_BASE_URL as string | undefined) || 'https://i.muicv.com';
  return `${base.replace(/\/$/, '')}/${key}`;
}

/** GET /api/photos —— 列当前登录用户最近上传，给预览页 modal 用。 */
export async function GET() {
  const session = await getCurrentSession();
  if (!session?.user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  const items = await listUserPhotoUploads(session.user.id, 50);
  return Response.json({ items });
}

/**
 * POST /api/photos —— 上传新照片到 R2（multipart/form-data 字段 `file`）。
 * cookie-auth，jpeg/png/webp，≤ 2MB。成功后写一行 photoUpload 审计。
 */
export async function POST(req: Request) {
  const session = await getCurrentSession();
  if (!session?.user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const ct = req.headers.get('content-type') ?? '';
  if (!ct.toLowerCase().includes('multipart/form-data')) {
    return Response.json({ error: 'Content-Type 必须是 multipart/form-data' }, { status: 400 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: '请求体解析失败' }, { status: 400 });
  }
  const file = form.get('file');
  if (!(file instanceof File)) {
    return Response.json({ error: '字段 file 缺失或不是文件' }, { status: 400 });
  }
  const mime = file.type.toLowerCase();
  if (!ALLOWED_MIME.has(mime)) {
    return Response.json({ error: `仅支持 jpeg/png/webp（收到 ${mime || '未知'}）` }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return Response.json(
      { error: `单文件不超过 ${Math.round(MAX_SIZE_BYTES / 1024)} KB（收到 ${file.size}B）` },
      { status: 400 },
    );
  }
  if (file.size === 0) {
    return Response.json({ error: '文件是空的' }, { status: 400 });
  }

  const { env } = await getCloudflareContext({ async: true });
  const bucket = (env as unknown as Record<string, unknown>).MUICV_PHOTOS as R2Bucket | undefined;
  if (!bucket) {
    return Response.json({ error: 'MUICV_PHOTOS binding 缺失' }, { status: 500 });
  }

  const userId = session.user.id;
  const ext = EXT_BY_MIME[mime] ?? 'bin';
  const key = `${userId}/${crypto.randomUUID()}.${ext}`;
  const originalName = file.name.slice(0, 200);

  const buf = await file.arrayBuffer();
  await bucket.put(key, buf, {
    httpMetadata: {
      contentType: mime,
      cacheControl: 'public, max-age=31536000, immutable',
    },
    customMetadata: { userId, originalName },
  });

  const url = publicPhotoUrl(env as unknown as Record<string, unknown>, key);
  const createdAt = Date.now();
  try {
    const item = await insertUserPhotoUpload({
      userId,
      r2Key: key,
      url,
      contentType: mime,
      sizeBytes: file.size,
      originalName,
      createdAt,
    });
    return Response.json(item, { status: 201 });
  } catch (err) {
    console.error('insertUserPhotoUpload failed', err);
    return Response.json(
      { url, key, contentType: mime, size: file.size, createdAt, warning: 'audit insert failed' },
      { status: 201 },
    );
  }
}
