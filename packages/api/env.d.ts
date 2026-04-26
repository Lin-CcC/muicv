// 给 wrangler types 不会自动推断的 secret 加类型声明。
// secret 通过 `wrangler secret put` 注入，不在 wrangler.jsonc vars 里。

declare namespace Cloudflare {
  interface Env {
    /** 与 packages/website 共用同一个值，用来 HKDF 派生 key 解密 muirouterLink.keyCipher。 */
    BETTER_AUTH_SECRET: string;
    /**
     * muicv 平台自家的 OpenAI API key（sk-...）。订阅用户没绑 BYOK 时走这把，
     * 配额由 muicv 后端控制（M2 起做月度上限）。
     * 部署：`wrangler secret put OPENAI_API_KEY`。
     */
    OPENAI_API_KEY: string;
  }
}

export {};
