import type { Context } from 'hono';

import { decryptMuirouterKey } from '../lib/crypto.ts';
import type { AppEnv } from '../middleware/api-key.ts';

/**
 * /llm/v1/* —— OpenAI 兼容反向代理。
 *
 * 双路径分流：
 *   1. **muicv 平台**（默认）：用户没绑 BYOK → 用 worker secret OPENAI_API_KEY
 *      调 https://api.openai.com/v1。配额由 muicv 控制（M2 起加月度上限）。
 *   2. **BYOK**：用户在 dashboard 绑了自己的 endpoint → 解密拿 key + base，
 *      转发过去。当前 muirouterLink 表 schema 假定 muirouter，所以暂时硬编码
 *      base = https://api.muirouter.com；M2 表加 baseUrl 字段后改成读用户配的。
 *
 * Path 映射统一：/llm/v1/chat/completions → <upstream>/v1/chat/completions。
 *
 * 这一层是 electron app 的核心代理：electron 用 mui_ key 当 OpenAI key、
 * baseURL 指 https://api.muicv.com/llm/v1，对它来说就是个标准 OpenAI 端点。
 */

const OPENAI_BASE = 'https://api.openai.com';
const MUIROUTER_BASE = 'https://api.muirouter.com';

export async function handleLlmProxy(c: Context<AppEnv>): Promise<Response> {
  const userId = c.get('userId');
  if (!userId) {
    return c.json({ error: 'unauthorized' }, 401);
  }

  // 1. 先看用户有没有绑 BYOK
  const link = await c.env.MUICV_API_DB.prepare('SELECT keyCipher, keyIv FROM muirouterLink WHERE userId = ? LIMIT 1')
    .bind(userId)
    .first<{ keyCipher: string; keyIv: string } | null>();

  let upstreamBase: string;
  let upstreamKey: string;

  if (link) {
    // BYOK 路径：解密用户的 key，转发到 muirouter
    const secret = c.env.BETTER_AUTH_SECRET;
    if (!secret) {
      return c.json(
        { error: 'misconfigured', message: '后端缺 BETTER_AUTH_SECRET（解密 BYOK key 用），请联系管理员' },
        500,
      );
    }
    try {
      upstreamKey = await decryptMuirouterKey(secret, link.keyCipher, link.keyIv);
    } catch {
      return c.json(
        { error: 'decrypt-failed', message: '加密 key 失效（可能因 secret 旋转），请回 dashboard 重新绑定' },
        500,
      );
    }
    upstreamBase = MUIROUTER_BASE;
  } else {
    // 平台路径：用 muicv 自家的 OpenAI key 给订阅用户（M1 不查 plan，所有人都能用；
    // M2 起按 plan / 月度配额限流）
    const platformKey = c.env.OPENAI_API_KEY;
    if (!platformKey) {
      return c.json(
        {
          error: 'platform-key-missing',
          message:
            '后端没配 OPENAI_API_KEY（部署人员需要 wrangler secret put OPENAI_API_KEY），或者你可以去 dashboard 绑定自己的 BYOK',
        },
        500,
      );
    }
    upstreamBase = OPENAI_BASE;
    upstreamKey = platformKey;
  }

  // 2. 拼上游 URL：/llm/v1/chat/completions → <base>/v1/chat/completions
  const incoming = new URL(c.req.url);
  const upstreamPath = incoming.pathname.replace(/^\/llm\//, '/');
  const upstreamUrl = `${upstreamBase}${upstreamPath}${incoming.search}`;

  // 3. 构造上游 headers：去掉 hop-by-hop + Cloudflare 注入的 + 我们要替换的 Authorization
  const upstreamHeaders = new Headers();
  for (const [k, v] of c.req.raw.headers.entries()) {
    const lower = k.toLowerCase();
    if (
      lower === 'authorization' ||
      lower === 'host' ||
      lower === 'content-length' ||
      lower === 'connection' ||
      lower === 'cf-connecting-ip' ||
      lower.startsWith('cf-') ||
      lower === 'x-forwarded-for' ||
      lower === 'x-forwarded-proto' ||
      lower === 'x-real-ip'
    ) {
      continue;
    }
    upstreamHeaders.set(k, v);
  }
  upstreamHeaders.set('Authorization', `Bearer ${upstreamKey}`);

  let upstreamRes: Response;
  try {
    const init: RequestInit & { duplex?: 'half' } = {
      method: c.req.method,
      headers: upstreamHeaders,
    };
    if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
      init.body = c.req.raw.body;
      init.duplex = 'half'; // streaming body
    }
    upstreamRes = await fetch(upstreamUrl, init);
  } catch (error) {
    return c.json(
      {
        error: 'upstream-network-error',
        upstream: link ? 'muirouter' : 'openai',
        message: error instanceof Error ? error.message : '上游网络错误',
      },
      502,
    );
  }

  // 4. 透传响应（保持流式）
  const responseHeaders = new Headers();
  for (const [k, v] of upstreamRes.headers.entries()) {
    const lower = k.toLowerCase();
    if (lower === 'content-encoding' || lower === 'transfer-encoding' || lower === 'connection') continue;
    responseHeaders.set(k, v);
  }

  return new Response(upstreamRes.body, {
    status: upstreamRes.status,
    headers: responseHeaders,
  });
}
