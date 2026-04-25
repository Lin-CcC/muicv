// 给 wrangler types 不会自动推断的 secret 加类型声明。
// secret 通过 `wrangler secret put` 注入，不在 wrangler.jsonc vars 里。

declare namespace Cloudflare {
  interface Env {
    /** 与 packages/website 共用同一个值，用来 HKDF 派生 key 解密 muirouterLink.keyCipher。 */
    BETTER_AUTH_SECRET: string;
  }
}

export {};
