import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { serve } from '@hono/node-server';
import matter from 'gray-matter';
import { Hono } from 'hono';
import { marked } from 'marked';
import puppeteer, { type Browser } from 'puppeteer-core';
import TurndownService from 'turndown';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const CHROMIUM_PATH = process.env.PUPPETEER_EXECUTABLE_PATH ?? '/usr/bin/chromium';
const PORT = Number(process.env.PORT ?? 3000);

/**
 * 整个 container 生命周期内复用一个 browser 实例。
 * 启动 ~1-2s，复用后每次渲染/抓取 <1s。
 */
let browserPromise: Promise<Browser> | null = null;

function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      executablePath: CHROMIUM_PATH,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--font-render-hinting=medium',
      ],
    });
  }
  return browserPromise;
}

// -------------------- 模板（PDF 渲染用） --------------------

const templateCache = new Map<string, string>();
async function loadTemplate(name: string): Promise<string> {
  const cached = templateCache.get(name);
  if (cached) return cached;
  if (!/^[a-z0-9-]+$/i.test(name)) {
    throw new Error(`模板名不合法：${name}`);
  }
  const path = join(__dirname, 'templates', `${name}.html`);
  const content = await readFile(path, 'utf8');
  templateCache.set(name, content);
  return content;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderHtml(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => vars[key] ?? '');
}

// -------------------- Readability 脚本（JD 抓取用） --------------------

/** 启动时一次性读入 Readability 源码，供所有 /fetch 请求注入到 page。 */
const readabilityJsPromise: Promise<string> = (async () => {
  const path = require.resolve('@mozilla/readability/Readability.js');
  return await readFile(path, 'utf8');
})();

const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '*',
});

// -------------------- HTTP 路由 --------------------

const app = new Hono();

app.get('/health', (c) => c.text('ok'));

/** POST /render —— 简历 markdown → PDF */
app.post('/render', async (c) => {
  const payload = await c.req.json<{ markdown: string; template?: string }>();

  if (typeof payload.markdown !== 'string' || payload.markdown.trim().length === 0) {
    return c.json({ error: '字段 `markdown` 必须是非空字符串' }, 400);
  }
  const templateName = payload.template ?? 'default';

  const { data: meta, content: bodyMd } = matter(payload.markdown);
  const bodyHtml = await marked.parse(bodyMd, { async: true });

  let template: string;
  try {
    template = await loadTemplate(templateName);
  } catch {
    return c.json({ error: `未知模板：${templateName}` }, 400);
  }

  const title =
    typeof meta.title === 'string'
      ? meta.title
      : typeof meta.target === 'string'
        ? `Resume — ${meta.target}`
        : 'Resume';

  const html = renderHtml(template, {
    title: escapeHtml(title),
    content: bodyHtml,
  });

  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 20000 });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '14mm', bottom: '14mm', left: '14mm', right: '14mm' },
    });
    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: { 'content-type': 'application/pdf' },
    });
  } finally {
    await page.close().catch(() => {});
  }
});

/**
 * POST /jobs/fetch —— 抓取 JD URL，返回清洗后的 markdown + meta
 *
 * 实现：
 *   1. Puppeteer 打开 URL，networkidle
 *   2. 注入 @mozilla/readability，提取主内容区 HTML
 *   3. 读取 og/meta 猜公司名和岗位标题
 *   4. 在 Node 侧用 turndown 把主内容 HTML 转 markdown
 *
 * 限制（MVP）：
 *   - 不绕过登录墙（对需要登录才能看 JD 的站点会失败）
 *   - 不执行 JS 之外的反爬（如 Cloudflare Turnstile）
 *   - 请求 UA 用标准 Chromium 默认（不伪装）
 */
app.post('/jobs/fetch', async (c) => {
  const payload = await c.req.json<{ url: string }>();

  if (typeof payload.url !== 'string' || !/^https?:\/\//i.test(payload.url)) {
    return c.json({ error: '字段 `url` 必须是合法 http/https URL' }, 400);
  }

  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    // 设置较严的超时，避免慢站把整个 container 卡住
    page.setDefaultTimeout(20000);

    const response = await page.goto(payload.url, {
      waitUntil: 'networkidle2',
      timeout: 20000,
    });

    if (!response || !response.ok()) {
      return c.json(
        {
          error: '目标页面返回非 200',
          status: response?.status() ?? null,
          url: payload.url,
        },
        502,
      );
    }

    // 注入 Readability
    const readabilityJs = await readabilityJsPromise;
    await page.addScriptTag({ content: readabilityJs });

    // 在页面内跑 Readability + 抽取 meta
    const extracted = await page.evaluate(() => {
      const getMeta = (name: string): string | null => {
        const el = document.querySelector(
          `meta[property="${name}"], meta[name="${name}"]`,
        ) as HTMLMetaElement | null;
        return el?.content?.trim() || null;
      };

      // Readability 会修改 document，先 clone
      // @ts-expect-error Readability 由 addScriptTag 注入
      const reader = new Readability(document.cloneNode(true) as Document);
      const article = reader.parse() as {
        title: string | null;
        content: string | null;
        textContent: string | null;
        length: number;
        excerpt: string | null;
        byline: string | null;
        siteName: string | null;
      } | null;

      return {
        title: article?.title ?? document.title ?? null,
        contentHtml: article?.content ?? null,
        textLength: article?.length ?? 0,
        siteName: article?.siteName ?? getMeta('og:site_name'),
        ogTitle: getMeta('og:title'),
        description: getMeta('description') ?? getMeta('og:description'),
        url: window.location.href,
      };
    });

    if (!extracted.contentHtml || extracted.textLength < 120) {
      return c.json(
        {
          error: '未能从页面提取到足够内容（少于 120 字）。可能是登录墙或 SPA 渲染失败。',
          url: payload.url,
          title: extracted.title,
        },
        502,
      );
    }

    const markdown = turndownService.turndown(extracted.contentHtml).trim();

    return c.json({
      markdown,
      meta: {
        title: extracted.title,
        company: extracted.siteName,
        source_url: extracted.url,
        fetched_at: new Date().toISOString(),
        description: extracted.description,
      },
    });
  } catch (error) {
    return c.json(
      {
        error: 'fetch 失败',
        detail: error instanceof Error ? error.message : String(error),
        url: payload.url,
      },
      502,
    );
  } finally {
    await page.close().catch(() => {});
  }
});

// -------------------- graceful shutdown --------------------

async function shutdown(signal: string): Promise<void> {
  console.log(`[container] received ${signal}, shutting down`);
  if (browserPromise) {
    const browser = await browserPromise.catch(() => null);
    await browser?.close().catch(() => {});
  }
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`[container] listening on port ${info.port}`);
});
