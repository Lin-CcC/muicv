import type { Context } from 'hono';

export type ReadJsonResult<T> = { ok: true; body: T } | { ok: false; response: Response };

/**
 * 校验 `Content-Type` 是 application/json + 把 body 解成 JSON，失败统一返回 400。
 *
 * 用法：
 *   const parsed = await readJsonBody<MyShape>(c);
 *   if (!parsed.ok) return parsed.response;
 *   const payload = parsed.body;
 *
 * 7+ 个 POST 路由在用这套校验；改文案只改这一处。
 */
// biome-ignore lint/suspicious/noExplicitAny: 适配各路由不同的 Hono Env 形态（waitlist 没 Variables）
export async function readJsonBody<T = unknown>(c: Context<any>): Promise<ReadJsonResult<T>> {
  const contentType = c.req.header('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return { ok: false, response: c.json({ error: 'Content-Type 必须是 application/json' }, 400) };
  }
  try {
    const body = (await c.req.json()) as T;
    return { ok: true, body };
  } catch {
    return { ok: false, response: c.json({ error: '请求体不是合法 JSON' }, 400) };
  }
}
