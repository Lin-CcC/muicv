import type { Context } from 'hono';

import { toErrorMessage } from '../lib/error-message.ts';
import { readJsonBody } from '../lib/json-body.ts';

type AppEnv = { Bindings: CloudflareBindings };

/**
 * 极宽松的邮箱格式校验：非空 + 含 `@` + 含 `.` + 小于 320 字节。
 * 真正验证留给后续的邮件发送链路（发送失败即为无效）。
 */
function looksLikeEmail(s: unknown): s is string {
  return typeof s === 'string' && s.length > 0 && s.length < 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

/** SHA-256 hex 哈希。用于 ip_hash，避免存原 IP。 */
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * POST /waitlist
 *
 * Body: { email: string, source?: string }
 * 响应：
 *   201 { ok: true }
 *   400 { error: '...' }
 *   409 { error: 'already-registered' }  —— 已存在 email
 *   500 { error: 'db-error' }
 *
 * 速率限制由 Cloudflare WAF 层做（每 IP 每分钟 N 次）。
 */
export async function handleWaitlist(c: Context<AppEnv>): Promise<Response> {
  const parsed = await readJsonBody<{ email?: unknown; source?: unknown }>(c);
  if (!parsed.ok) return parsed.response;
  const payload = parsed.body;

  if (!looksLikeEmail(payload.email)) {
    return c.json({ error: '字段 `email` 必须是合法邮箱' }, 400);
  }
  const email = payload.email.trim().toLowerCase();

  const source =
    typeof payload.source === 'string' && payload.source.length > 0 && payload.source.length <= 64
      ? payload.source
      : null;

  const referrer = c.req.header('referer')?.slice(0, 512) ?? null;
  const userAgent = c.req.header('user-agent')?.slice(0, 512) ?? null;
  const ip = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? null;
  const ipHash = ip ? await sha256Hex(`muicv-waitlist-v1::${ip}`) : null;

  try {
    await c.env.MUICV_API_DB.prepare(
      `INSERT INTO waitlist (email, source, referrer, user_agent, ip_hash) VALUES (?, ?, ?, ?, ?)`,
    )
      .bind(email, source, referrer, userAgent, ipHash)
      .run();
  } catch (error) {
    const msg = toErrorMessage(error);
    if (/UNIQUE/i.test(msg) || /constraint/i.test(msg)) {
      return c.json({ error: 'already-registered' }, 409);
    }
    return c.json({ error: 'db-error', detail: msg.slice(0, 200) }, 500);
  }

  return c.json({ ok: true }, 201);
}
