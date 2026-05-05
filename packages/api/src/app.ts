import { displayToMicro, JD_FETCH_COST, PDF_RENDER_COST, insufficientBalanceError } from '@muicv/shared';
import { Hono } from 'hono';
import { cors } from 'hono/cors';

import { FetchJdError, fetchJd } from './lib/fetch-jd.ts';
import { renderPdf } from './lib/render-pdf.ts';
import { charge, ensureBalance } from './lib/wallet.ts';
import { requireApiKey } from './middleware/api-key.ts';
import { handleLlmProxy } from './routes/llm.ts';
import { handleMe } from './routes/me.ts';
import {
  handleResumeHistoryGet,
  handleResumeHistoryList,
  handleResumeSnapshotDelete,
  handleResumeSnapshotGet,
  handleResumeSync,
} from './routes/resume-sync.ts';
import { handleTranscribe } from './routes/transcribe.ts';
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
      'POST /audio/transcribe（multipart/form-data，字段 file）',
      'POST /waitlist',
      'GET /me（拿当前登录用户信息）',
      'ALL /llm/v1/* (OpenAI 兼容代理 → muirouter)',
      'POST /resume/sync（push 整个素材库快照）',
      'GET /resume/snapshot（pull 活动版）',
      'GET /resume/snapshot/history（列历史快照 metadata）',
      'GET /resume/snapshot/history/:id（pull 某历史版本）',
      'DELETE /resume/snapshot（清空云端）',
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
 * 响应：200 application/pdf + PDF bytes / 402 余额不足
 *
 * 计费：成功才扣 PDF_RENDER_COST tokens；渲染失败 502 但不扣账（避免反复重试被反复扣）。
 *
 * 实现：写一次性 token 进 MUICV_KV，puppeteer.goto packages/website 的
 * /r/render/[token]，等字体加载完，page.pdf 出 A4。详见 src/lib/render-pdf.ts。
 */
app.post('/render', requireApiKey, async (c) => {
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

  const userId = c.get('userId') as string;
  const pdfCostMicro = displayToMicro(PDF_RENDER_COST);
  const wallet = await ensureBalance(c.env, userId);
  if (wallet.balance < pdfCostMicro) {
    return c.json(insufficientBalanceError(wallet.balance), 402);
  }

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

  // 成功才扣账（异步，不阻塞 PDF 返回）
  c.executionCtx.waitUntil(charge(c.env, userId, pdfCostMicro, 'pdf_render', { template }).catch(() => {}));

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
 *   402 —— 余额不足
 *   502 —— 抓取失败（登录墙 / 反爬 / 页面异常）
 *
 * 计费：成功才扣 JD_FETCH_COST tokens；抓取失败 502 但不扣账。
 *
 * 限制（MVP）：
 *   - 不绕过登录墙
 *   - 不对抗 Cloudflare Turnstile / Captcha
 *   - 不伪装 UA 规避 ToS
 *   - 单次请求 20s 超时（在 container 侧）
 */
app.post('/jobs/fetch', requireApiKey, async (c) => {
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

  const userId = c.get('userId') as string;
  const jdCostMicro = displayToMicro(JD_FETCH_COST);
  const wallet = await ensureBalance(c.env, userId);
  if (wallet.balance < jdCostMicro) {
    return c.json(insufficientBalanceError(wallet.balance), 402);
  }

  try {
    const result = await fetchJd({ url }, c.env);
    c.executionCtx.waitUntil(charge(c.env, userId, jdCostMicro, 'jd_fetch', { url }).catch(() => {}));
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

/**
 * POST /audio/transcribe —— STT 转写（issue #1 M1）。
 *
 * Body: multipart/form-data，字段 `file`（音频，< 25MB / < 10min）
 * 响应：200 application/json { transcript, duration_ms, language, segments? } / 400 / 402 / 502
 *
 * 走 Cloudflare Workers AI `@cf/openai/whisper-large-v3-turbo`。
 * 计费：成功才扣，按返回 duration 实际时长向上取整到分钟 × STT_TRANSCRIBE_RATE_PER_MIN。
 * 详见 src/routes/transcribe.ts。
 */
app.post('/audio/transcribe', requireApiKey, handleTranscribe);

/**
 * /resume/* —— 简历素材云同步（skill 用 Bearer key 调用）。详见 src/routes/resume-sync.ts。
 * 不扣 token，单库 1MB / 500 文件上限；推送前自动归档活动版到 history（最近 5 份）。
 */
app.post('/resume/sync', requireApiKey, handleResumeSync);
app.get('/resume/snapshot', requireApiKey, handleResumeSnapshotGet);
app.get('/resume/snapshot/history', requireApiKey, handleResumeHistoryList);
app.get('/resume/snapshot/history/:id', requireApiKey, handleResumeHistoryGet);
app.delete('/resume/snapshot', requireApiKey, handleResumeSnapshotDelete);

export default app;
