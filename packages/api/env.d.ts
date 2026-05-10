// 给 wrangler types 不会自动推断的 secret 加类型声明。
// secret 通过 `wrangler secret put` 注入，不在 wrangler.jsonc vars 里。
//
// 这个文件刻意不加 `export {}`/`import`，保持 script 形态，这样：
//   1. `declare namespace Cloudflare { ... }` 直接 merge 到 worker-configuration.d.ts
//      生成的全局 Cloudflare.Env，无需 declare global 包裹
//   2. 下面两个 `declare module '...'` 才能声明全新的 ambient module（module 文件里做不到）

declare namespace Cloudflare {
  interface Env {
    /** 与 packages/website 共用同一个值，HKDF 派生 key 加解密 muirouterLink 上的 OAuth token。 */
    BETTER_AUTH_SECRET: string;
    /**
     * muicv 平台自家的 OpenAI API key（sk-...）。muicv 余额 > 0 且 model 是 `gpt-*` 时走这把，
     * 配额由 muicv 后端控制（M2 起做月度上限）。
     * 部署：`wrangler secret put OPENAI_API_KEY`。
     */
    OPENAI_API_KEY: string;
    /**
     * muicv 平台自家的 Xiaomi Mimo API key。muicv 余额 > 0 且 model 是 `mimo-*` 时走这把。
     * 上游 base：https://token-plan-sgp.xiaomimimo.com，OpenAI 兼容。
     * 部署：`wrangler secret put MIMO_API_KEY`。
     */
    MIMO_API_KEY: string;
    /**
     * muirouter OAuth client secret——余额耗尽 fallback 到 muirouter 时，token 过期需要 refresh。
     * 与 packages/website 共用同一个值。`wrangler secret put MUIROUTER_OAUTH_CLIENT_SECRET`。
     */
    MUIROUTER_OAUTH_CLIENT_SECRET: string;
    MUIROUTER_OAUTH_TOKEN_URL?: string;
    MUIROUTER_OAUTH_REVOKE_URL?: string;
    MUIROUTER_OAUTH_CLIENT_ID?: string;
    /** HSM 服务凭据，与 packages/website 共用同一个值。`wrangler secret put HSM_SECRET`。 */
    HSM_SECRET: string;
    HSM_BASE_URL?: string;
    /**
     * Stripe price IDs，与 packages/website 共用同一组值（vars 里给）。
     * /me 推 plan 字段需要据此把 stripePriceId 反查成 'pro' / 'max'。
     * 没配（dev / 老部署）时 /me 返回 plan='free'，等同于跳过订阅推断。
     */
    STRIPE_PRICE_PRO_MONTHLY?: string;
    STRIPE_PRICE_PRO_YEARLY?: string;
    STRIPE_PRICE_MAX_MONTHLY?: string;
    STRIPE_PRICE_MAX_YEARLY?: string;
    /**
     * R2 bucket（bucket_name 见 wrangler.jsonc），存简历素材加密同步的 zip blob。
     * key 形如 `users/{userId}/blobs/{blobId}.zip`。公开域名 i.muicv.com。
     * 下次 `wrangler types` 会把它合并进 worker-configuration.d.ts，本声明只是
     * 在那之前让 typecheck 不报错。
     */
    MUICV_RESUME_BLOB: R2Bucket;
  }
}

/**
 * Readability / turndown 在 puppeteer page 内注入运行（addScriptTag），
 * Worker 这边通过 wrangler text rule（见 wrangler.jsonc）把它们当文本资源 import 进来。
 */
declare module '@mozilla/readability/Readability.js' {
  const content: string;
  export default content;
}
declare module 'turndown/dist/turndown.js' {
  const content: string;
  export default content;
}
