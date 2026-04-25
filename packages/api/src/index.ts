import { Hono } from 'hono';
import { cors } from 'hono/cors';

import { BrowserContainer } from './durable-objects/browser-container.ts';
import { optionalApiKey, requireApiKey } from './middleware/api-key.ts';
import { handleLlmProxy } from './routes/llm.ts';
import { handleMe } from './routes/me.ts';
import { handleWaitlist } from './routes/waitlist.ts';

export { BrowserContainer };

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
 * 小工具：把请求代理到共享的 BrowserContainer DO（singleton）。
 * 未来按租户隔离时可以改成 idFromName(userId) 之类。
 */
function proxyToContainer(env: CloudflareBindings, path: string, init: RequestInit): Promise<Response> {
  const id = env.BROWSER.idFromName('default');
  const stub = env.BROWSER.get(id);
  return stub.fetch(`http://do${path}`, init);
}

/**
 * POST /render
 *
 * Body: { markdown: string, template?: string }
 * 响应：200 application/pdf + PDF bytes
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

  const containerResponse = await proxyToContainer(c.env, '/render', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ markdown: payload.markdown, template }),
  });

  if (!containerResponse.ok) {
    const text = await containerResponse.text().catch(() => '');
    return c.json({ error: 'container 渲染失败', status: containerResponse.status, detail: text.slice(0, 500) }, 502);
  }

  return new Response(containerResponse.body, {
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

  const containerResponse = await proxyToContainer(c.env, '/jobs/fetch', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: payload.url }),
  });

  // Container 侧无论成功失败都返回 JSON，这里透传即可
  return new Response(containerResponse.body, {
    status: containerResponse.status,
    headers: {
      'content-type': 'application/json',
    },
  });
});

export default app;
