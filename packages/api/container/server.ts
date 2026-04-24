import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { serve } from '@hono/node-server';
import matter from 'gray-matter';
import { Hono } from 'hono';
import { marked } from 'marked';
import puppeteer, { type Browser } from 'puppeteer-core';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 从环境变量读 Chromium 路径，Dockerfile 里会设（默认 /usr/bin/chromium）
const CHROMIUM_PATH = process.env.PUPPETEER_EXECUTABLE_PATH ?? '/usr/bin/chromium';
const PORT = Number(process.env.PORT ?? 3000);

/**
 * 单个 Container 内共用一个 browser 实例，每个请求新建一个 page。
 * 启动 browser 大约 1-2s，复用之后每次渲染 <1s。
 *
 * browserPromise 是 lazy 的：冷启动时 server 先起来响应 /health，
 * 第一次 /render 请求才去拉起 browser。
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

// 缓存模板（第一次读之后常驻内存；container 生命周期内模板不会变）
const templateCache = new Map<string, string>();
async function loadTemplate(name: string): Promise<string> {
  const cached = templateCache.get(name);
  if (cached) return cached;

  // 防目录穿越
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

const app = new Hono();

app.get('/health', (c) => c.text('ok'));

app.post('/render', async (c) => {
  const payload = await c.req.json<{ markdown: string; template?: string }>();

  if (typeof payload.markdown !== 'string' || payload.markdown.trim().length === 0) {
    return c.json({ error: '字段 `markdown` 必须是非空字符串' }, 400);
  }
  const templateName = payload.template ?? 'default';

  // 1. 解析 frontmatter，分离 meta 和正文
  const { data: meta, content: bodyMd } = matter(payload.markdown);

  // 2. Markdown → HTML（只处理正文，frontmatter 不进输出）
  const bodyHtml = await marked.parse(bodyMd, { async: true });

  // 3. 渲染模板
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

  // 4. Puppeteer 渲染
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

// graceful shutdown
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
