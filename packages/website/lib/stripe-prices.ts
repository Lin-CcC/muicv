import type { BillingInterval, CnPackKey, Currency, SubscriptionPlanKey, TopupPackKey } from '@muicv/shared';

/**
 * Stripe Price ID 注册表。
 *
 * 维护惯例：
 *   - **live mode 实际 priceId**。test mode 当前未维护（无 Product），如需启用 test，
 *     在 packages/website 顶层把整张表 swap 出来（或者引入 `STRIPE_MODE` env 维一份分支表）。
 *   - 同 plan/interval 的 USD / CNY 是 Stripe 上两个独立的 Price 对象，token 数相同。
 *   - 价格本身（金额、currency、interval）在 Stripe Dashboard 维护；这里只记 ID，不记金额。
 *     金额与 token 量在 packages/shared/src/pricing.ts 的 SUBSCRIPTION_PLANS / TOPUP_PACKS 维护。
 *
 * 为什么不放进 wrangler vars：14 个 priceId 是结构化数据（plan × interval × currency / pack × currency），
 * jsonc 的扁平 key-value 难以维护、容易漏改 worker-configuration.d.ts。TS 常量提供 typed access、
 * 一次性改完 IDE 全跟得上、增减档位时不会忘 d.ts 同步。
 *
 * webhook 反查（priceId → tokens）也共用本表，避免 lib/stripe.ts 写 8 个 if-else。
 */

export const STRIPE_SUBSCRIPTION_PRICES: Record<
  SubscriptionPlanKey,
  Record<BillingInterval, Record<Currency, string>>
> = {
  pro: {
    monthly: {
      usd: 'price_1TUjjpEpkXm2vxXT7PRayf4m',
      cny: 'price_1TYhiLEpkXm2vxXT9cIp3sgU',
    },
    yearly: {
      usd: 'price_1TUjkFEpkXm2vxXTqDLQ6kon',
      cny: 'price_1TYhiOEpkXm2vxXTy4hiIfsz',
    },
  },
  max: {
    monthly: {
      usd: 'price_1TRwcYEpkXm2vxXTolTABRBM',
      cny: 'price_1TYhiPEpkXm2vxXTvLXLAsJ4',
    },
    yearly: {
      usd: 'price_1TRwczEpkXm2vxXTxoxuOYjq',
      cny: 'price_1TYhiREpkXm2vxXTjK1c0cTC',
    },
  },
};

export const STRIPE_TOPUP_PRICES: Record<TopupPackKey, Record<Currency, string>> = {
  small: { usd: 'price_1TUjkrEpkXm2vxXTOgEMjxDE', cny: 'price_1TYhiSEpkXm2vxXT2b9Rhxzc' },
  medium: { usd: 'price_1TUjlcEpkXm2vxXTgr6Od5el', cny: 'price_1TYhiWEpkXm2vxXTNPu2K7BG' },
  large: { usd: 'price_1TUjm2EpkXm2vxXTy8UHK9qo', cny: 'price_1TYhiXEpkXm2vxXTRa0HfBus' },
};

/**
 * CN「月包/年包」一次性 SKU price IDs。
 *
 * 与 STRIPE_SUBSCRIPTION_PRICES.*.cny 是两套不同对象：
 *   - 那一套是 recurring price（已建但实际不可用，alipay 进不了 subscription mode）
 *   - 本套是 one-time price，挂在同一个 Pro / Max Product 上，走 mode=payment 三方支付
 *
 * 占位 price_REPLACE_*_CN_PACK 由 stripe CLI 跑完替换。
 */
export const STRIPE_CN_PACK_PRICES: Record<CnPackKey, string> = {
  'pro-monthly': 'price_1TYoWTEpkXm2vxXTZeEj6thA',
  'pro-yearly': 'price_1TYoWUEpkXm2vxXTDhrUkeQR',
  'max-monthly': 'price_1TYoWUEpkXm2vxXTQYKrCfNA',
  'max-yearly': 'price_1TYoWVEpkXm2vxXTr98RTTWm',
};

/**
 * 反查表：priceId → 订阅档位元信息。webhook 处理 invoice.paid /
 * customer.subscription.* 时 O(1) 反查 tokens / plan / interval。
 *
 * 由 STRIPE_SUBSCRIPTION_PRICES 构建，结构变化时自动同步，不需要单独维护。
 */
export const SUBSCRIPTION_PRICE_META = buildSubscriptionReverseMap();

export const TOPUP_PRICE_META = buildTopupReverseMap();

export const CN_PACK_PRICE_META = buildCnPackReverseMap();

export interface SubscriptionPriceMeta {
  plan: SubscriptionPlanKey;
  interval: BillingInterval;
  currency: Currency;
}

export interface TopupPriceMeta {
  pack: TopupPackKey;
  currency: Currency;
}

export interface CnPackPriceMeta {
  pack: CnPackKey;
}

function buildSubscriptionReverseMap(): Map<string, SubscriptionPriceMeta> {
  const map = new Map<string, SubscriptionPriceMeta>();
  for (const plan of Object.keys(STRIPE_SUBSCRIPTION_PRICES) as SubscriptionPlanKey[]) {
    for (const interval of Object.keys(STRIPE_SUBSCRIPTION_PRICES[plan]) as BillingInterval[]) {
      for (const currency of Object.keys(STRIPE_SUBSCRIPTION_PRICES[plan][interval]) as Currency[]) {
        map.set(STRIPE_SUBSCRIPTION_PRICES[plan][interval][currency], { plan, interval, currency });
      }
    }
  }
  return map;
}

function buildTopupReverseMap(): Map<string, TopupPriceMeta> {
  const map = new Map<string, TopupPriceMeta>();
  for (const pack of Object.keys(STRIPE_TOPUP_PRICES) as TopupPackKey[]) {
    for (const currency of Object.keys(STRIPE_TOPUP_PRICES[pack]) as Currency[]) {
      map.set(STRIPE_TOPUP_PRICES[pack][currency], { pack, currency });
    }
  }
  return map;
}

function buildCnPackReverseMap(): Map<string, CnPackPriceMeta> {
  const map = new Map<string, CnPackPriceMeta>();
  for (const pack of Object.keys(STRIPE_CN_PACK_PRICES) as CnPackKey[]) {
    map.set(STRIPE_CN_PACK_PRICES[pack], { pack });
  }
  return map;
}
