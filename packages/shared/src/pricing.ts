/**
 * Token 经济常量。website / api / app 三端共用。
 *
 * 单位：
 *   - **显示 token**（display token）：用户面前看到的数字，套餐宣传、ledger 历史、API 响应都按这个口径。
 *     可以是小数（少见，因为 markup ceil 在 μtoken 层就够整齐了）。本文件的常量
 *     （SIGNUP_BONUS / PDF_RENDER_COST / JD_FETCH_COST / SUBSCRIPTION_PLANS / TOPUP_PACKS）都用显示 token。
 *   - **μtoken**（micro-token）：内部存储和计算单位，integer。1 显示 token = 10_000 μtoken。
 *     `tokenBalance.balance` / `tokenLedger.delta` / wallet API 入参出参都是 μtoken。
 *   - 边界：调 wallet 之前 `displayToMicro`；从 wallet 出 API / SSR 渲染时 `microToDisplay`。
 *
 * 计费：LLM 按 model 分价（见 LLM_PRICING），prompt / completion 分两列；功能门（PDF / JD）按固定显示 token 扣账。
 *
 * 锚点：1 显示 token ≈ $1e-5（从 Pro 套餐反推：500k / $4.99）。Xiaomi 价以 ¥7/USD 折算到 USD 后再算 rate。
 *
 * 注册赠送 SIGNUP_BONUS 走 lazy init（第一次读 tokenBalance 时 INSERT OR IGNORE），
 * 不依赖 Better Auth 的 user.create hook（OpenNext 上 hook 踩坑多）。
 */

/** 显示 token → μtoken 的进位倍率。1 显示 token = 10_000 μtoken。 */
export const TOKEN_PRECISION = 10_000;

/** 显示 token → μtoken（用 round 容忍浮点误差，比如 0.1 + 0.2）。 */
export function displayToMicro(displayTokens: number): number {
  return Math.round(displayTokens * TOKEN_PRECISION);
}

/** μtoken → 显示 token（小数原样保留，渲染层自己 toFixed 决定精度）。 */
export function microToDisplay(microTokens: number): number {
  return microTokens / TOKEN_PRECISION;
}

/** 注册赠送 token（显示 token），wrangler vars 里可覆写 */
export const SIGNUP_BONUS = 10_000;

/** PDF 单次渲染扣 token（显示 token） */
export const PDF_RENDER_COST = 200;

/** JD 单次抓取扣 token（显示 token） */
export const JD_FETCH_COST = 300;

/**
 * LLM 计费表。每个 model 一项：
 *   - inputRate：1 上游 prompt token 折合多少显示 token
 *   - outputRate：1 上游 completion token 折合多少显示 token
 *
 * 数值以「1 显示 token = $1e-5」为锚点反算（Xiaomi 价用 ¥7/USD 折算）。
 *
 * 数据来源（review 时核对）：
 *   - gpt-5.5 / gpt-5.4：https://developers.openai.com/api/docs/pricing
 *   - mimo-v2.5-pro / mimo-v2.5：Xiaomi Mimo 平台官方报价
 *
 * 平台路径（余额 > 0）只接受表里的 model；表外 model 在 routes/llm.ts 拦截 400。
 * muirouter fallback 路径不受本表约束（model 列表由 muirouter 端管理）。
 */
export const LLM_PRICING: Record<string, { inputRate: number; outputRate: number }> = {
  // OpenAI: input $5/M, output $30/M
  'gpt-5.5': { inputRate: 0.5, outputRate: 3.0 },
  // OpenAI: input $2.5/M, output $15/M
  'gpt-5.4': { inputRate: 0.25, outputRate: 1.5 },
  // Xiaomi: input ¥1.4/M ≈ $0.20/M, output ¥21/M ≈ $3/M
  'mimo-v2.5-pro': { inputRate: 0.02, outputRate: 0.3 },
  // Xiaomi: input ¥0.56/M ≈ $0.08/M, output ¥14/M ≈ $2/M
  'mimo-v2.5': { inputRate: 0.008, outputRate: 0.2 },
};

/** markup：所有 model 统一 1.1×。等于「上游成本 + 10% 加价」。 */
export const LLM_RATIO = 1.1;

export function isSupportedLlmModel(model: string): boolean {
  return Object.hasOwn(LLM_PRICING, model);
}

/** 平台路径支持的 model id 列表，给 400 响应/前端选择 UI 用。 */
export const SUPPORTED_LLM_MODELS = Object.keys(LLM_PRICING);

/** 全平台默认模型 id。新装 / 老 store 里没设过时回退到这个；UI 也按 isDefault 标识。 */
export const DEFAULT_LLM_MODEL = 'gpt-5.4';

/**
 * UI 展示元数据：人类可读名 / 上游 vendor / 输入输出价（保留原币种以便用户判断）/ 简短亮点。
 * 桌面 app 设置页的 ModelCard 用，避免在组件里硬编码字符串。
 */
export const LLM_DISPLAY_META: Record<
  string,
  {
    label: string;
    vendor: 'openai' | 'xiaomi';
    inputPrice: string;
    outputPrice: string;
    hint: string;
    /** true 表示这是全平台默认，UI 加 "默认" chip，并在 store 里没值时落到它。 */
    isDefault?: boolean;
  }
> = {
  'gpt-5.5': {
    label: 'GPT-5.5',
    vendor: 'openai',
    inputPrice: '$5 / 1M',
    outputPrice: '$30 / 1M',
    hint: '最强，最贵',
  },
  'gpt-5.4': {
    label: 'GPT-5.4',
    vendor: 'openai',
    inputPrice: '$2.5 / 1M',
    outputPrice: '$15 / 1M',
    hint: '通用首选',
    isDefault: true,
  },
  'mimo-v2.5-pro': {
    label: 'MiMo v2.5 Pro',
    vendor: 'xiaomi',
    inputPrice: '¥1.4 / 1M',
    outputPrice: '¥21 / 1M',
    hint: '中文友好',
  },
  'mimo-v2.5': {
    label: 'MiMo v2.5',
    vendor: 'xiaomi',
    inputPrice: '¥0.56 / 1M',
    outputPrice: '¥14 / 1M',
    hint: '最便宜',
  },
};

/**
 * 订阅档位：每个 cycle（月付每月 / 年付每年）自动续 tokens。
 * 年付 = Stripe 一年 invoice 一次，invoice.paid 时一次性发 yearly.tokens（标准 SaaS 做法）。
 *
 * tokens 字段单位：**显示 token**（webhook 入账时 displayToMicro 转 μ 后调 credit）。
 *
 * 数据来源 / 维护：
 *   - tokens / priceCnyDisplay：本文件硬编码，调价时改这里 + Stripe Dashboard 同步
 *   - Stripe price ID：在 packages/website/wrangler.jsonc 的 vars 里给
 *     （STRIPE_PRICE_<PLAN>_<INTERVAL>，详见 lib/stripe.ts 的 priceIdToCycleTokens）
 *   - savingsLabel：年付的折扣展示文案，纯 UI 用
 */
export const SUBSCRIPTION_PLANS = {
  pro: {
    label: 'Pro',
    monthly: { tokens: 500_000, priceCnyDisplay: '$4.99 / 月' },
    yearly: { tokens: 6_000_000, priceCnyDisplay: '$49.99 / 年', savingsLabel: '相当于 $4.16 / 月，省 17%' },
  },
  max: {
    label: 'Max',
    monthly: { tokens: 2_500_000, priceCnyDisplay: '$15.88 / 月' },
    yearly: { tokens: 48_000_000, priceCnyDisplay: '$158.88 / 年', savingsLabel: '相当于 $13.24 / 月，省 17%' },
  },
} as const;

export type SubscriptionPlanKey = keyof typeof SUBSCRIPTION_PLANS;
export type BillingInterval = 'monthly' | 'yearly';

/**
 * 一次性补充包：付完款 webhook 立刻 +tokens（显示 token，credit 时转 μ）。
 * priceCnyDisplay 仅展示用，真实价格在 Stripe price 上。
 */
export const TOPUP_PACKS = {
  small: { tokens: 100_000, priceCnyDisplay: '$1.98' },
  medium: { tokens: 400_000, priceCnyDisplay: '$4.98' },
  large: { tokens: 2_000_000, priceCnyDisplay: '$15.98' },
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

/**
 * LLM 上游用量 → μtoken 实扣金额。
 *
 * 公式：ceil((prompt × inputRate + completion × outputRate) × LLM_RATIO × TOKEN_PRECISION)
 *
 * 取整在 μtoken 层（4 位精度），过去整数 ceil 在显示 token 层，会让 mimo-v2.5 这种
 * 廉价模型的小请求被多扣 100×+。
 *
 * @returns μtoken（integer）；model 不在 LLM_PRICING 表里返回 null
 */
export function computeLlmCharge(model: string, promptTokens: number, completionTokens: number): number | null {
  const rate = LLM_PRICING[model];
  if (!rate) return null;
  const cost = (promptTokens || 0) * rate.inputRate + (completionTokens || 0) * rate.outputRate;
  return Math.ceil(cost * LLM_RATIO * TOKEN_PRECISION);
}

/**
 * OpenAI 兼容的 402 错误响应体。桌面 app 用的 OpenAI Agent SDK 看到 4xx +
 * `{ error: { message, type, code } }` 会抛 APIError，前端检测 code 弹充值对话框。
 *
 * @param balanceMicro 余额（μtoken），内部转成显示 token 后写进文案
 */
export function insufficientBalanceError(balanceMicro: number): {
  error: { message: string; type: string; code: string; param: null };
} {
  const display = microToDisplay(balanceMicro);
  return {
    error: {
      message: `余额不足（剩 ${display.toLocaleString()} tokens）。请到 muicv.com/dashboard 充值或订阅月卡。`,
      type: 'insufficient_balance',
      code: 'insufficient_balance',
      param: null,
    },
  };
}
