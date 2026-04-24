import { Hono } from 'hono';

import { PdfRenderer } from './durable-objects/pdf-renderer.ts';

export { PdfRenderer };

type AppBindings = {
  Bindings: CloudflareBindings;
};

const app = new Hono<AppBindings>();

app.get('/', (c) =>
  c.json({
    name: 'muicv-api',
    routes: ['/health', 'POST /render'],
  }),
);

app.get('/health', (c) => c.text('ok'));

/**
 * POST /render
 *
 * Body:
 *   {
 *     "markdown": "<版本 md 文件的完整内容，包含 frontmatter>",
 *     "template"?: "default"
 *   }
 *
 * 响应：
 *   200 application/pdf + PDF bytes
 *   400 JSON 错误（缺字段等）
 *   502 JSON 错误（container 异常）
 *
 * MVP 阶段：无认证，按 IP 速率限制（通过 Cloudflare rate limiting 规则，不在代码里）。
 */
app.post('/render', async (c) => {
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

  // 每个 API 实例共用一个 DO（singleton），再由 DO 持有 Container。
  // 未来按租户隔离时可以改成 idFromName(userId)。
  const id = c.env.PDF_RENDERER.idFromName('default');
  const stub = c.env.PDF_RENDERER.get(id);

  const containerResponse = await stub.fetch('http://do/render', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ markdown: payload.markdown, template }),
  });

  if (!containerResponse.ok) {
    const text = await containerResponse.text().catch(() => '');
    return c.json(
      { error: 'container 渲染失败', status: containerResponse.status, detail: text.slice(0, 500) },
      502,
    );
  }

  return new Response(containerResponse.body, {
    status: 200,
    headers: {
      'content-type': 'application/pdf',
      // 让 skill 保存时能给文件取个名；具体 filename 由 skill 决定，这里只给个默认
      'content-disposition': 'attachment; filename="resume.pdf"',
    },
  });
});

export default app;
