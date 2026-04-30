import { Hono } from 'hono';
import { cors } from 'hono/cors';

import { FetchJdError, fetchJd } from './lib/fetch-jd.ts';
import { renderPdf } from './lib/render-pdf.ts';
import { optionalApiKey, requireApiKey } from './middleware/api-key.ts';
import { handleLlmProxy } from './routes/llm.ts';
import { handleMe } from './routes/me.ts';
import { handleWaitlist } from './routes/waitlist.ts';

type AppBindings = {
  Bindings: CloudflareBindings;
  Variables: {
    userId?: string;
    keyId?: string;
  };
};

const app = new Hono<AppBindings>();

/**
 * CORS 白名单：
 * - muicv.com / *.muicv.com（生产）
 * - localhost:任意端口（dev）
 *
 * Skill（CLI / curl）不发 Origin header，CORS 中间件对它们透传不拦截。
 */
app.use(
  '*',
  cors({
    origin: (origin) => {
      if (!origin) return origin;
      if (origin === 'https://muicv.com') return origin;
      if (origin.endsWith('.muicv.com') && origin.startsWith('https://')) return origin;
      if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return origin;
      return null;
    },
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['content-type'],
    maxAge: 600,
  }),
);

app.get('/', (c) =>
  c.json({
    name: 'muicv-api',
    routes: [
      'GET /health',
      'POST /render',
      'POST /jobs/fetch',
      'POST /waitlist',
      'GET /me（拿当前登录用户信息）',
      'ALL /llm/v1/* (OpenAI 兼容代理 → muirouter)',
    ],
  }),
);

app.get('/health', (c) => c.text('ok'));

/**
 * GET /me —— 桌面 app / skill 用 mui_ key 拉取登录用户信息。
 */
app.get('/me', requireApiKey, handleMe);

/**
 * /llm/v1/* —— OpenAI 兼容反向代理到用户绑定的 muirouter（BYOK）。
 * 详见 src/routes/llm.ts。
 */
app.all('/llm/v1/*', requireApiKey, handleLlmProxy);

/**
 * POST /waitlist
 *
 * Body: { email: string, source?: string }
 * 响应：201 / 400 / 409 / 500
 * 详见 src/routes/waitlist.ts
 */
app.post('/waitlist', handleWaitlist);

/**
 * POST /render
 *
 * Body: { markdown: string, template?: string }
 * 响应：200 application/pdf + PDF bytes
 *
 * 实现：写一次性 token 进 MUICV_KV，puppeteer.goto packages/website 的
 * /r/render/[token]，等字体加载完，page.pdf 出 A4。详见 src/lib/render-pdf.ts。
 */
app.post('/render', optionalApiKey, async (c) => {
  const contentType = c.req.header('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return c.json({ error: 'Content-Type 必须是 application/json' }, 400);
  }

  let payload: { markdown?: unknown; template?: unknown };
  try {
    payload = await c.req.json();
  } catch {
    return c.json({ error: '请求体不是合法 JSON' }, 400);
  }

  if (typeof payload.markdown !== 'string' || payload.markdown.trim().length === 0) {
    return c.json({ error: '字段 `markdown` 必须是非空字符串' }, 400);
  }
  const template = typeof payload.template === 'string' ? payload.template : 'default';

  let pdf: Uint8Array;
  try {
    pdf = await renderPdf({ markdown: payload.markdown, template }, c.env);
  } catch (error) {
    return c.json(
      {
        error: 'PDF 渲染失败',
        detail: error instanceof Error ? error.message : String(error),
      },
      502,
    );
  }

  return new Response(pdf, {
    status: 200,
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': 'attachment; filename="resume.pdf"',
    },
  });
});

/**
 * POST /jobs/fetch
 *
 * Body: { url: string }  —— 目标 JD 的公开可访问 URL
 *
 * 响应：
 *   200 application/json —— { markdown, meta: { title, company, source_url, fetched_at, description } }
 *   400 —— 参数错误
 *   502 —— 抓取失败（登录墙 / 反爬 / 页面异常）
 *
 * 限制（MVP）：
 *   - 不绕过登录墙
 *   - 不对抗 Cloudflare Turnstile / Captcha
 *   - 不伪装 UA 规避 ToS
 *   - 单次请求 20s 超时（在 container 侧）
 */
app.post('/jobs/fetch', optionalApiKey, async (c) => {
  const contentType = c.req.header('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return c.json({ error: 'Content-Type 必须是 application/json' }, 400);
  }

  let payload: { url?: unknown };
  try {
    payload = await c.req.json();
  } catch {
    return c.json({ error: '请求体不是合法 JSON' }, 400);
  }

  if (typeof payload.url !== 'string' || !/^https?:\/\//i.test(payload.url)) {
    return c.json({ error: '字段 `url` 必须是合法 http/https URL' }, 400);
  }
  const url = payload.url;

  try {
    const result = await fetchJd({ url }, c.env);
    return c.json(result);
  } catch (error) {
    if (error instanceof FetchJdError) {
      return c.json(error.detail, error.status);
    }
    return c.json(
      {
        error: 'fetch 失败',
        detail: error instanceof Error ? error.message : String(error),
        url,
      },
      502,
    );
  }
});

export default app;
