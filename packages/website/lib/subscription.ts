import { eq } from 'drizzle-orm';

import { getDb, schema } from './db';

/**
 * 当前用户的「活跃」订阅快照（status in active / trialing / past_due）。
 *
 * - `active` / `trialing`：可正常使用
 * - `past_due`：续费失败但 Stripe 还在重试，保留访问；UI 上提示用户去修复支付方式
 *
 * marketing/pricing 用：决定订阅卡是显示「立即订阅」还是「管理订阅」。
 * 需要的字段刻意保持最小（status 一个就够，但保留 priceId 方便未来 UI 显示当前档位）。
 */
export async function getActiveSubscription(
  userId: string | null | undefined,
): Promise<{ status: string; stripePriceId: string | null } | null> {
  if (!userId) return null;
  const db = await getDb();
  const rows = await db
    .select({
      status: schema.subscription.status,
      stripePriceId: schema.subscription.stripePriceId,
      stripeSubscriptionId: schema.subscription.stripeSubscriptionId,
    })
    .from(schema.subscription)
    .where(eq(schema.subscription.userId, userId))
    .limit(1);
  const row = rows[0];
  if (!row?.stripeSubscriptionId) return null;
  if (row.status !== 'active' && row.status !== 'trialing' && row.status !== 'past_due') return null;
  return { status: row.status, stripePriceId: row.stripePriceId };
}
