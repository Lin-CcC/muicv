import type { Context } from 'hono';

import type { AppEnv } from '../middleware/api-key.ts';

const HISTORY_DEFAULT_LIMIT = 20;
const HISTORY_MAX_LIMIT = 100;

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

function publicPhotoUrl(env: CloudflareBindings, key: string): string {
  const base = env.PHOTOS_PUBLIC_BASE_URL || 'https://i.muicv.com';
  return `${base.replace(/\/$/, '')}/${key}`;
}

/**
 * POST /upload/photo —— 上传证件照到 R2，返回公开外链。
 *
 * Body: multipart/form-data，字段 `file`（jpeg/png/webp，≤ 2MB）
 * 响应：
 *   201 + { url, key, contentType, size }
 *   400 缺 file / 类型不对 / 太大
 *   401 没 key
 *
 * R2 key 形式：`<userId>/<uuid>.<ext>`，写死 cache-control: public, max-age=31536000.
 * R2 桶名 muicv-photos，绑定 MUICV_PHOTOS（wrangler.jsonc）。
 *
 * 不收费：相比 PDF 渲染开销，单张图片上传是常量成本，并入 sub plan 用量统计即可。
 * 不做服务端 resize：客户端（Electron / web）应该先压到 600×800 以内再 POST。
 */
export async function handleUploadPhoto(c: Context<AppEnv>): Promise<Response> {
  const contentType = c.req.header('content-type') ?? '';
  if (!contentType.toLowerCase().includes('multipart/form-data')) {
    return c.json({ error: 'Content-Type 必须是 multipart/form-data' }, 400);
  }

  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    return c.json({ error: '请求体解析失败' }, 400);
  }
  const file = form.get('file');
  if (!(file instanceof File)) {
    return c.json({ error: '字段 `file` 缺失或不是文件' }, 400);
  }
  const mime = file.type.toLowerCase();
  if (!ALLOWED_MIME.has(mime)) {
    return c.json({ error: `仅支持 jpeg/png/webp（收到 ${mime || '未知'}）` }, 400);
  }
  if (file.size > MAX_SIZE_BYTES) {
    return c.json({ error: `单文件不超过 ${Math.round(MAX_SIZE_BYTES / 1024)} KB（收到 ${file.size}B）` }, 400);
  }
  if (file.size === 0) {
    return c.json({ error: '文件是空的' }, 400);
  }

  const userId = c.get('userId') as string;
  const ext = EXT_BY_MIME[mime] ?? 'bin';
  const key = `${userId}/${crypto.randomUUID()}.${ext}`;
  const originalName = file.name.slice(0, 200);

  const buf = await file.arrayBuffer();
  await c.env.MUICV_PHOTOS.put(key, buf, {
    httpMetadata: {
      contentType: mime,
      cacheControl: 'public, max-age=31536000, immutable',
    },
    customMetadata: { userId, originalName },
  });

  const url = publicPhotoUrl(c.env, key);
  const createdAt = Date.now();
  // 审计行：写入失败不阻塞用户拿 URL，但要 surface 到 logs。
  // 极端情况下 R2 写成功 / D1 写失败 → 物理对象存在但没人能"列回来"，
  // R2 单价对个人项目可忽略；下个迭代加 cron 用 list 对账时统一兜底。
  try {
    await c.env.MUICV_API_DB.prepare(
      `INSERT INTO photoUpload (userId, r2Key, url, contentType, sizeBytes, originalName, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(userId, key, url, mime, file.size, originalName, createdAt)
      .run();
  } catch (error) {
    console.error('photoUpload audit insert failed', { key, userId, error });
  }

  return c.json(
    {
      url,
      key,
      contentType: mime,
      size: file.size,
      createdAt,
    },
    201,
  );
}

/**
 * GET /upload/photo/history?limit=20
 *
 * 列当前登录用户最近的上传记录（按 createdAt DESC）。
 * dashboard / Electron app 用这条路径展示「我上传过的照片」让用户一键复用。
 *
 * 不分页（每个用户最多几十张，没必要做 cursor）；limit clamp 到 [1, 100]。
 *
 * 错误处理：D1 异常（migration 没跑 → "no such table"、binding 缺失等）以前会让
 * hono 默认抛 500 + 字符串 "Internal Server Error"，客户端看不出根因。这里包
 * try/catch，把真实错误 message 冒到 response body，便于运维排查。
 */
export async function handlePhotoHistory(c: Context<AppEnv>): Promise<Response> {
  const userId = c.get('userId') as string;
  const rawLimit = Number.parseInt(c.req.query('limit') ?? '', 10);
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, HISTORY_MAX_LIMIT) : HISTORY_DEFAULT_LIMIT;

  try {
    const result = await c.env.MUICV_API_DB.prepare(
      `SELECT id, r2Key, url, contentType, sizeBytes, originalName, createdAt
       FROM photoUpload WHERE userId = ? ORDER BY createdAt DESC LIMIT ?`,
    )
      .bind(userId, limit)
      .all<{
        id: number;
        r2Key: string;
        url: string;
        contentType: string;
        sizeBytes: number;
        originalName: string | null;
        createdAt: number;
      }>();
    return c.json({ items: result.results ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('handlePhotoHistory failed', { userId, message });
    return c.json(
      { error: `读取上传历史失败：${message}`, hint: 'D1 binding 或 photoUpload 表可能未就绪（看 migration 0015）' },
      500,
    );
  }
}
