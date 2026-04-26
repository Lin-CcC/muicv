import type { Context } from 'hono';

import type { AppEnv } from '../middleware/api-key.ts';

/**
 * GET /me —— 桌面 app / skill 用 mui_ key 拉取登录用户信息。
 *
 * 用于：
 *   - 桌面 app 启动时验证 key 是否有效（验证失败 → 跳到登录页）
 *   - 显示"已登录为 <email>"
 *   - 决定是否引导用户去 dashboard 绑 muirouter（hasBYOK=false）
 *
 * Phase 7 v1：plan 字段先 stub 'free'。M4 起接真实订阅档位时改读 D1。
 */
export async function handleMe(c: Context<AppEnv>): Promise<Response> {
  const userId = c.get('userId');
  if (!userId) return c.json({ error: 'unauthorized' }, 401);

  const user = await c.env.MUICV_API_DB.prepare('SELECT id, email, name, image FROM user WHERE id = ? LIMIT 1')
    .bind(userId)
    .first<{ id: string; email: string; name: string | null; image: string | null } | null>();

  if (!user) {
    // mui_ key 合法但 user 行被删了（极少见，比如用户注销后 cascade 没跑干净）
    return c.json({ error: 'user-not-found' }, 401);
  }

  const link = await c.env.MUICV_API_DB.prepare('SELECT 1 FROM muirouterLink WHERE userId = ? LIMIT 1')
    .bind(userId)
    .first<{ '1': number } | null>();

  return c.json({
    id: user.id,
    email: user.email,
    name: user.name ?? user.email.split('@')[0] ?? '朋友',
    image: user.image ?? null,
    plan: 'free' as const,
    hasBYOK: !!link,
  });
}
