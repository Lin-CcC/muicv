import { type SubscriptionPlanKey, type TopupPackKey, SUBSCRIPTION_PLANS, TOPUP_PACKS } from '@muicv/shared';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { eq } from 'drizzle-orm';
import Stripe from 'stripe';

import { getDb, schema } from './db';

/**
 * Stripe SDK 在 Cloudflare Workers 的关键约束：
 *   - 必须用 `Stripe.createFetchHttpClient()`，默认 Node http 在 Workers 跑不了
 *   - webhook 校验必须用 `webhooks.constructEventAsync`（依赖 SubtleCrypto）
 *   - apiVersion 固定一个具体版本，避免 SDK 升级时行为变化
 */

let cached: Stripe | undefined;

export async function getStripe(): Promise<Stripe> {
  if (cached) return cached;
  const { env } = await getCloudflareContext({ async: true });
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY 未配置（wrangler secret put STRIPE_SECRET_KEY）');
  }
  cached = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: '2026-04-22.dahlia',
    httpClient: Stripe.createFetchHttpClient(),
  });
  return cached;
}

/**
 * 月卡 plan key → Stripe price id（从 wrangler vars 读）。
 * 切 live mode 时换 wrangler.jsonc vars 即可。
 */
export async function planKeyToPriceId(plan: SubscriptionPlanKey): Promise<string> {
  const { env } = await getCloudflareContext({ async: true });
  const map: Record<SubscriptionPlanKey, string> = {
    pro: env.STRIPE_PRICE_PRO_MONTHLY,
    max: env.STRIPE_PRICE_MAX_MONTHLY,
  };
  return map[plan];
}

export async function topupPackToPriceId(pack: TopupPackKey): Promise<string> {
  const { env } = await getCloudflareContext({ async: true });
  const map: Record<TopupPackKey, string> = {
    small: env.STRIPE_PRICE_TOPUP_SMALL,
    medium: env.STRIPE_PRICE_TOPUP_MEDIUM,
    large: env.STRIPE_PRICE_TOPUP_LARGE,
  };
  return map[pack];
}

/**
 * Stripe price id → 月卡每月发放 token 数。webhook 处理 invoice.paid 时按这个上账。
 * priceId 不在表里就返 null（可能是被人在 Stripe 后台手动绑了未知 price，需告警）。
 */
export async function priceIdToMonthlyTokens(priceId: string): Promise<number | null> {
  const { env } = await getCloudflareContext({ async: true });
  if (priceId === env.STRIPE_PRICE_PRO_MONTHLY) return SUBSCRIPTION_PLANS.pro.monthlyTokens;
  if (priceId === env.STRIPE_PRICE_MAX_MONTHLY) return SUBSCRIPTION_PLANS.max.monthlyTokens;
  return null;
}

/**
 * Stripe price id → 一次性补充包 token 数。webhook 处理 checkout.session.completed
 * (mode=payment) 时按这个上账。
 */
export async function priceIdToTopupTokens(priceId: string): Promise<number | null> {
  const { env } = await getCloudflareContext({ async: true });
  if (priceId === env.STRIPE_PRICE_TOPUP_SMALL) return TOPUP_PACKS.small.tokens;
  if (priceId === env.STRIPE_PRICE_TOPUP_MEDIUM) return TOPUP_PACKS.medium.tokens;
  if (priceId === env.STRIPE_PRICE_TOPUP_LARGE) return TOPUP_PACKS.large.tokens;
  return null;
}

/**
 * 幂等地为某个 user 拿到 stripe customer id。
 *
 * 流程：
 *   1. 查自家 subscription 表 → 有就直接返
 *   2. 没有 → stripe.customers.create({ metadata: { userId } })
 *   3. 立刻 INSERT subscription 行（status='incomplete', stripeSubscriptionId=null）
 *      —— 这一步必须早于 Checkout，否则用户连续点两次升级会创出两个 customer
 *
 * @returns stripeCustomerId
 */
export async function getOrCreateStripeCustomer(args: {
  userId: string;
  email: string;
  name?: string | null;
}): Promise<string> {
  const db = await getDb();
  const existing = await db
    .select({ stripeCustomerId: schema.subscription.stripeCustomerId })
    .from(schema.subscription)
    .where(eq(schema.subscription.userId, args.userId))
    .limit(1);
  if (existing[0]?.stripeCustomerId) return existing[0].stripeCustomerId;

  const stripe = await getStripe();
  const customer = await stripe.customers.create({
    email: args.email,
    ...(args.name ? { name: args.name } : {}),
    metadata: { userId: args.userId },
  });

  const now = new Date();
  await db.insert(schema.subscription).values({
    userId: args.userId,
    stripeCustomerId: customer.id,
    stripeSubscriptionId: null,
    stripePriceId: null,
    monthlyTokens: null,
    status: 'incomplete',
    currentPeriodStart: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    canceledAt: null,
    createdAt: now,
    updatedAt: now,
  });

  return customer.id;
}
