// OpenNext 的 getCloudflareContext() 返回 env 的类型是 CloudflareEnv（顶级
// global），而 wrangler types 生成的是 Cloudflare.Env。让 CloudflareEnv 继承
// Cloudflare.Env，并补上 wrangler 不会从 secret 推断的字段。

declare global {
  interface CloudflareEnv extends Cloudflare.Env {
    /** Better Auth 加密 secret，用 `wrangler secret put BETTER_AUTH_SECRET` 设置。 */
    BETTER_AUTH_SECRET: string;
    /** GitHub OAuth client secret，`wrangler secret put GITHUB_CLIENT_SECRET` 设置。 */
    GITHUB_CLIENT_SECRET?: string;
    /** Stripe secret key (sk_test_… / sk_live_…)，`wrangler secret put STRIPE_SECRET_KEY` */
    STRIPE_SECRET_KEY: string;
    /** Stripe webhook secret (whsec_…)，每次切 live mode 都要重发。 */
    STRIPE_WEBHOOK_SECRET: string;
    /** 注册赠送 token 数（覆盖 packages/shared/pricing.ts 里的默认 10000）。 */
    SIGNUP_BONUS?: string;
  }
}

export {};
