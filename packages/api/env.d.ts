// 给 wrangler types 不会自动推断的 secret 加类型声明。
// secret 通过 `wrangler secret put` 注入，不在 wrangler.jsonc vars 里。
//
// 这个文件刻意不加 `export {}`/`import`，保持 script 形态，这样：
//   1. `declare namespace Cloudflare { ... }` 直接 merge 到 worker-configuration.d.ts
//      生成的全局 Cloudflare.Env，无需 declare global 包裹
//   2. 下面两个 `declare module '...'` 才能声明全新的 ambient module（module 文件里做不到）

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
