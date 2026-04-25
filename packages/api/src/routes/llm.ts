import type { Context } from 'hono';

import { decryptMuirouterKey } from '../lib/crypto.ts';
import type { AppEnv } from '../middleware/api-key.ts';

/**
 * /llm/v1/* —— OpenAI 兼容反向代理。
 *
 * 流程：
 *   1. requireApiKey middleware 已验证 mui_ key，set userId 到 context
 *   2. 这里查 muirouterLink → 解密 sk-gw-... key
 *   3. 没绑定 muirouter → 402 / no-muirouter-link，引导用户去 dashboard 绑（BYOK）
 *      （未来 Pro/Max 档位可以用平台 muirouter，本期 v1 必须 BYOK）
 *   4. 转发请求到 muirouter，path 保持（/llm/v1/chat/completions →
 *      /v1/chat/completions），把 Authorization 替换成用户的 sk-gw-key
 *   5. 流式（SSE）响应透传
 *
 * 这一层是 electron app 的核心代理：electron 用 mui_ key 当 OpenAI key、
 * baseURL 指 https://api.muicv.com/llm/v1/，对它来说就是个标准 OpenAI 端点。
 */

const MUIROUTER_BASE = 'https://api.muirouter.com';

export async function handleLlmProxy(c: Context<AppEnv>): Promise<Response> {
  const userId = c.get('userId');
  if (!userId) {
    // requireApiKey 应该已经设了，这里作为类型守卫
    return c.json({ error: 'unauthorized' }, 401);
  }

  // 拿 muirouter key
  const link = await c.env.MUICV_API_DB.prepare(
    'SELECT keyCipher, keyIv FROM muirouterLink WHERE userId = ? LIMIT 1',
  )
    .bind(userId)
    .first<{ keyCipher: string; keyIv: string } | null>();

  if (!link) {
    return c.json(
      {
        error: 'no-muirouter-link',
        message: '需要先在 https://muicv.com/dashboard 绑定 muirouter 账号才能用 LLM',
        learnMore: 'https://muicv.com/dashboard',
      },
      402,
    );
  }

  const secret = c.env.BETTER_AUTH_SECRET;
  if (!secret) {
    return c.json(
      {
        error: 'misconfigured',
        message: '后端缺 BETTER_AUTH_SECRET（解密 muirouter key 用），请联系管理员',
      },
      500,
    );
  }

  let muirouterKey: string;
  try {
    muirouterKey = await decryptMuirouterKey(secret, link.keyCipher, link.keyIv);
  } catch {
    return c.json(
      {
        error: 'decrypt-failed',
        message: '加密 key 失效（可能因 secret 旋转），请回 dashboard 重新绑定 muirouter',
      },
      500,
    );
  }

  // 拼上游 URL：/llm/v1/chat/completions → https://api.muirouter.com/v1/chat/completions
  const incoming = new URL(c.req.url);
  const upstreamPath = incoming.pathname.replace(/^\/llm\//, '/');
  const upstreamUrl = `${MUIROUTER_BASE}${upstreamPath}${incoming.search}`;

  // 构造 upstream request headers：去掉 hop-by-hop 和我们要替换的 Authorization
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
  upstreamHeaders.set('Authorization', `Bearer ${muirouterKey}`);

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
        message: error instanceof Error ? error.message : 'muirouter 网络错误',
      },
      502,
    );
  }

  // 透传响应（保持流式）
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
