import type { Context } from 'hono';

import { computeLlmCharge, insufficientBalanceError } from '@muicv/shared';

import { decryptMuirouterKey } from '../lib/crypto.ts';
import { extractUsageFromSseStream, stripUsageChunkFromSse } from '../lib/llm-usage.ts';
import { charge, ensureBalance } from '../lib/wallet.ts';
import type { AppEnv } from '../middleware/api-key.ts';

/**
 * /llm/v1/* —— OpenAI 兼容反向代理。
 *
 * 双路径分流：
 *   1. **muicv 平台**（默认）：用户没绑 BYOK → 用 worker secret OPENAI_API_KEY
 *      调 https://api.openai.com/v1。**按 token 钱包扣费**（pre-check + tee 聚合
 *      usage + post-record charge）。比例 1.1× 上游 token，向上取整。
 *   2. **BYOK**：用户在 dashboard 绑了自己的 endpoint → 解密拿 key + base，
 *      转发过去。**不扣 muicv 余额**（用户自己付 muirouter）。
 *
 * Path 映射统一：/llm/v1/chat/completions → <upstream>/v1/chat/completions。
 */

const OPENAI_BASE = 'https://api.openai.com';
const MUIROUTER_BASE = 'https://api.muirouter.com';

const CHAT_COMPLETIONS_PATH = '/llm/v1/chat/completions';

export async function handleLlmProxy(c: Context<AppEnv>): Promise<Response> {
  const userId = c.get('userId');
  if (!userId) {
    return c.json({ error: 'unauthorized' }, 401);
  }

  // 1. BYOK 检查
  const link = await c.env.MUICV_API_DB.prepare('SELECT keyCipher, keyIv FROM muirouterLink WHERE userId = ? LIMIT 1')
    .bind(userId)
    .first<{ keyCipher: string; keyIv: string } | null>();

  let upstreamBase: string;
  let upstreamKey: string;

  if (link) {
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
    // 平台路径：扣 muicv 余额。pre-check 余额是否 > 0。
    const wallet = await ensureBalance(c.env, userId);
    if (wallet.balance <= 0) {
      return c.json(insufficientBalanceError(wallet.balance), 402);
    }

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

  // 2. 拼上游 URL
  const incoming = new URL(c.req.url);
  const upstreamPath = incoming.pathname.replace(/^\/llm\//, '/');
  const upstreamUrl = `${upstreamBase}${upstreamPath}${incoming.search}`;

  // 3. 仅平台路径 + chat/completions：解析 body 注入 stream_options.include_usage
  const isChatCompletions = upstreamPath === '/v1/chat/completions';
  const isPlatform = !link;
  let bodyText: string | null = null;
  let parsedBody: { stream?: boolean; stream_options?: { include_usage?: boolean }; model?: string } | null = null;
  let isStreaming = false;
  let clientWantedUsage = false;

  if (isPlatform && isChatCompletions && c.req.method === 'POST') {
    bodyText = await c.req.text();
    try {
      parsedBody = JSON.parse(bodyText);
      isStreaming = parsedBody?.stream === true;
      if (isStreaming && parsedBody) {
        if (parsedBody.stream_options?.include_usage === true) {
          clientWantedUsage = true;
        } else {
          parsedBody.stream_options = { ...(parsedBody.stream_options ?? {}), include_usage: true };
          bodyText = JSON.stringify(parsedBody);
        }
      }
    } catch {
      // 非 JSON body，透传让上游报错
    }
  }

  // 4. 构造上游 headers
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

  // 5. 发起 fetch
  let upstreamRes: Response;
  try {
    const init: RequestInit & { duplex?: 'half' } = {
      method: c.req.method,
      headers: upstreamHeaders,
    };
    if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
      init.body = bodyText !== null ? bodyText : c.req.raw.body;
      init.duplex = 'half';
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

  // 6. 响应处理
  const responseHeaders = new Headers();
  for (const [k, v] of upstreamRes.headers.entries()) {
    const lower = k.toLowerCase();
    if (lower === 'content-encoding' || lower === 'transfer-encoding' || lower === 'connection') continue;
    responseHeaders.set(k, v);
  }

  // BYOK 不扣账；上游 4xx/5xx 不扣账；非 chat/completions 不扣账
  if (link || upstreamRes.status >= 400 || !isChatCompletions) {
    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      headers: responseHeaders,
    });
  }

  const model = parsedBody?.model ?? 'unknown';

  if (isStreaming && upstreamRes.body) {
    const [a, b] = upstreamRes.body.tee();
    c.executionCtx.waitUntil(
      extractUsageFromSseStream(b).then(async (usage) => {
        if (!usage) return;
        const cost = computeLlmCharge(usage.prompt_tokens, usage.completion_tokens);
        await charge(c.env, userId, cost, 'llm', {
          model,
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
        }).catch(() => {});
      }),
    );

    const outBody = clientWantedUsage ? a : stripUsageChunkFromSse(a);
    return new Response(outBody, {
      status: upstreamRes.status,
      headers: responseHeaders,
    });
  }

  // 非 stream：buffer 响应、读 usage、扣账
  const text = await upstreamRes.text();
  try {
    const json = JSON.parse(text);
    if (json?.usage?.prompt_tokens != null && json?.usage?.completion_tokens != null) {
      const cost = computeLlmCharge(json.usage.prompt_tokens, json.usage.completion_tokens);
      c.executionCtx.waitUntil(
        charge(c.env, userId, cost, 'llm', {
          model: json.model ?? model,
          promptTokens: json.usage.prompt_tokens,
          completionTokens: json.usage.completion_tokens,
        })
          .then(() => {})
          .catch(() => {}),
      );
    }
  } catch {
    // 不是 JSON，跳过扣账（不太可能，但容错）
  }
  return new Response(text, {
    status: upstreamRes.status,
    headers: responseHeaders,
  });
}
