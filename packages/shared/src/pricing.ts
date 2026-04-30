/**
 * Token 经济常量。website / api / app 三端共用。
 *
 * 单位：muicv token = OpenAI token（1:1 对齐），LLM 计费按上游 promptTokens +
 * completionTokens 乘 LLM_RATIO（1.1）后向上取整。功能门（PDF / JD）按固定 token 扣账。
 *
 * 注册赠送 SIGNUP_BONUS 走 lazy init（第一次读 tokenBalance 时 INSERT OR IGNORE），
 * 不依赖 Better Auth 的 user.create hook（OpenNext 上 hook 踩坑多）。
 */

/** 注册赠送 token，wrangler vars 里可覆写 */
export const SIGNUP_BONUS = 10_000;

/** LLM 加价比例：上游 token × 1.1 = 用户实扣 token，覆盖第三方成本 + 利润 */
export const LLM_RATIO = 1.1;

/** PDF 单次渲染扣 token */
export const PDF_RENDER_COST = 200;

/** JD 单次抓取扣 token */
export const JD_FETCH_COST = 300;

/**
 * 月卡订阅档位：每月自动续 monthlyTokens。Stripe price id 在 wrangler vars 里给。
 * priceIdToMonthlyTokens 反查靠下面 buildPriceMap（在 worker 里用 env 拼）。
 */
export const SUBSCRIPTION_PLANS = {
  pro: { monthlyTokens: 100_000, label: 'Pro 月卡', priceCnyDisplay: '¥30 / 月' },
  max: { monthlyTokens: 500_000, label: 'Max 月卡', priceCnyDisplay: '¥98 / 月' },
} as const;

export type SubscriptionPlanKey = keyof typeof SUBSCRIPTION_PLANS;

/**
 * 一次性补充包：付完款 webhook 立刻 +tokens。
 * priceCnyDisplay 仅展示用，真实价格在 Stripe price 上。
 */
export const TOPUP_PACKS = {
  small: { tokens: 10_000, priceCnyDisplay: '¥10' },
  medium: { tokens: 35_000, priceCnyDisplay: '¥30' },
  large: { tokens: 130_000, priceCnyDisplay: '¥100' },
} as const;

export type TopupPackKey = keyof typeof TOPUP_PACKS;

export type LedgerType =
  | 'signup_bonus'
  | 'subscription'
  | 'topup'
  | 'llm'
  | 'pdf_render'
  | 'jd_fetch'
  | 'admin_grant'
  | 'admin_deduct';

/** 余额计算：LLM 上游用量 → 实扣 token（向上取整） */
export function computeLlmCharge(promptTokens: number, completionTokens: number): number {
  const total = (promptTokens || 0) + (completionTokens || 0);
  return Math.ceil(total * LLM_RATIO);
}

/**
 * OpenAI 兼容的 402 错误响应体。桌面 app 用的 OpenAI Agent SDK 看到 4xx +
 * `{ error: { message, type, code } }` 会抛 APIError，前端检测 code 弹充值对话框。
 */
export function insufficientBalanceError(balance: number): {
  error: { message: string; type: string; code: string; param: null };
} {
  return {
    error: {
      message: `余额不足（剩 ${balance} tokens）。请到 muicv.com/dashboard 充值或订阅月卡。`,
      type: 'insufficient_balance',
      code: 'insufficient_balance',
      param: null,
    },
  };
}
