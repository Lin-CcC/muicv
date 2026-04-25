import type { MiddlewareHandler } from 'hono';

type AppEnv = {
  Bindings: CloudflareBindings;
  Variables: {
    userId?: string;
    keyId?: string;
  };
};

const KEY_PATTERN = /^mui_[A-Za-z0-9]{32}$/;

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * 可选 Bearer key 验证。
 *
 * 不带 Authorization → 直接放行（走 Cloudflare 层 IP 速率限制）
 * 带了但格式错 / key 不存在 / 已撤销 → 401
 * 带了合法 key → set userId / keyId 进 context，异步更新 lastUsedAt 后放行
 *
 * 数据源：MUICV_API_DB 是和 packages/website 共用的 muicv D1，apiKey 表
 * schema 由 website migrations/0003_api_keys.sql 创建。
 */
export const optionalApiKey: MiddlewareHandler<AppEnv> = async (c, next) => {
  const auth = c.req.header('authorization');
  if (!auth) {
    await next();
    return;
  }

  const match = /^Bearer\s+(\S+)$/i.exec(auth);
  if (!match) {
    return c.json({ error: 'authorization 必须是 "Bearer <key>" 格式' }, 401);
  }
  const key = match[1] ?? '';
  if (!KEY_PATTERN.test(key)) {
    return c.json({ error: 'api key 格式不合法' }, 401);
  }

  const hash = await sha256Hex(key);
  const row = await c.env.MUICV_API_DB.prepare(
    'SELECT id, userId, revokedAt FROM apiKey WHERE keyHash = ? LIMIT 1',
  )
    .bind(hash)
    .first<{ id: string; userId: string; revokedAt: number | null }>();

  if (!row || row.revokedAt) {
    return c.json({ error: 'api key 无效或已被撤销' }, 401);
  }

  c.set('keyId', row.id);
  c.set('userId', row.userId);

  // 异步更新 lastUsedAt（不 block 请求；失败也不影响业务）
  c.executionCtx.waitUntil(
    c.env.MUICV_API_DB.prepare('UPDATE apiKey SET lastUsedAt = ? WHERE id = ?')
      .bind(Date.now(), row.id)
      .run()
      .catch(() => {}),
  );

  await next();
};
