import { type SubscriptionPlanKey, SUBSCRIPTION_PLANS } from '@muicv/shared';
import { getCloudflareContext } from '@opennextjs/cloudflare';

import { getCurrentSession } from '@/lib/session';
import { getOrCreateStripeCustomer, getStripe, planKeyToPriceId } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

/**
 * POST /api/checkout —— 月卡订阅 Checkout。
 *
 * Body: { plan: 'pro' | 'max' }
 * 返回：{ url } —— 前端 location.href = url 跳到 Stripe hosted Checkout
 *
 * mode='subscription'，metadata.kind='subscription' 用于 webhook 区分一次性补充包。
 * Checkout 成功后 Stripe 跳回 BETTER_AUTH_URL/dashboard?checkout=success；订阅
 * 真正生效要等 webhook（customer.subscription.created + invoice.paid），前端
 * 拉一次 /api/me 看 subscription 字段，没回来时显示"等支付确认中"。
 */
export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session?.user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: { plan?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid-json' }, { status: 400 });
  }

  const plan = body.plan;
  if (plan !== 'pro' && plan !== 'max') {
    return Response.json({ error: 'plan 必须是 pro | max' }, { status: 400 });
  }

  const customerId = await getOrCreateStripeCustomer({
    userId: session.user.id,
    email: session.user.email,
    name: session.user.name,
  });
  const priceId = await planKeyToPriceId(plan as SubscriptionPlanKey);
  const stripe = await getStripe();
  const { env } = await getCloudflareContext({ async: true });
  const baseUrl = env.BETTER_AUTH_URL || 'https://muicv.com';

  const checkout = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl}/dashboard?checkout=success`,
    cancel_url: `${baseUrl}/dashboard?checkout=cancel`,
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
    metadata: {
      kind: 'subscription',
      userId: session.user.id,
      plan,
      monthlyTokens: String(SUBSCRIPTION_PLANS[plan as SubscriptionPlanKey].monthlyTokens),
    },
  });

  if (!checkout.url) {
    return Response.json({ error: 'stripe-checkout-no-url' }, { status: 502 });
  }
  return Response.json({ url: checkout.url });
}
