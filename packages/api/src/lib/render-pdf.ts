import puppeteer, { type BrowserWorker } from '@cloudflare/puppeteer';

export type RenderPdfInput = {
  markdown: string;
  template: string;
};

export type RenderPdfEnv = {
  BROWSER: BrowserWorker;
  MUICV_KV: KVNamespace;
  RENDER_BASE_URL: string;
};

const KV_KEY_PREFIX = 'resume:';
/** 一次性 token 在 KV 的存活时长。puppeteer.goto 之后立即 delete，TTL 是兜底。 */
const TOKEN_TTL_SECONDS = 300;
const NAVIGATION_TIMEOUT_MS = 20_000;

/**
 * 简历 markdown → PDF。
 *
 * 流程：
 *   1. 写 KV：`resume:${uuid}` → { markdown, template }，5min TTL
 *   2. puppeteer.goto packages/website 的 /r/render/[token]，由那边 SSR 出 HTML
 *   3. await document.fonts.ready，等 Google Fonts 的 Noto Sans SC 加载完
 *   4. page.pdf 生成 A4 PDF
 *   5. 清理 KV，关闭 browser
 *
 * 任何中间步骤异常都会抛错，由 caller 转成 502。
 */
export async function renderPdf(input: RenderPdfInput, env: RenderPdfEnv): Promise<Uint8Array> {
  const token = crypto.randomUUID();
  const kvKey = `${KV_KEY_PREFIX}${token}`;
  const url = `${env.RENDER_BASE_URL}/r/render/${token}`;

  await env.MUICV_KV.put(kvKey, JSON.stringify({ markdown: input.markdown, template: input.template }), {
    expirationTtl: TOKEN_TTL_SECONDS,
  });

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
  try {
    browser = await puppeteer.launch(env.BROWSER);
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle0', timeout: NAVIGATION_TIMEOUT_MS });
    await page.evaluateHandle('document.fonts.ready');
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '14mm', bottom: '14mm', left: '14mm', right: '14mm' },
    });
    return pdf;
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
    await env.MUICV_KV.delete(kvKey).catch(() => {});
  }
}
