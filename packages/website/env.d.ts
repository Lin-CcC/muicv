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
    /** muirouter OAuth client secret，`wrangler secret put MUIROUTER_OAUTH_CLIENT_SECRET` 设置。 */
    MUIROUTER_OAUTH_CLIENT_SECRET: string;
    /** muirouter OAuth 授权页基址，缺省取 https://muirouter.com/oauth/authorize。 */
    MUIROUTER_OAUTH_AUTHORIZE_URL?: string;
    /** muirouter OAuth token 端点，缺省取 https://api.muirouter.com/oauth/token。 */
    MUIROUTER_OAUTH_TOKEN_URL?: string;
    /** muirouter OAuth revoke 端点，缺省取 https://api.muirouter.com/oauth/revoke。 */
    MUIROUTER_OAUTH_REVOKE_URL?: string;
    /** muirouter OAuth client_id，缺省 'muicv'。 */
    MUIROUTER_OAUTH_CLIENT_ID?: string;
    /** muicv 自身的 base URL，用来拼 OAuth redirect_uri。缺省取 BETTER_AUTH_URL。 */
    MUICV_BASE_URL?: string;
  }
}

export {};
