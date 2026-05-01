import type { Context } from 'hono';

import { computeLlmCharge, insufficientBalanceError, MuirouterOauthError } from '@muicv/shared';

import { extractUsageFromSseStream, stripUsageChunkFromSse } from '../lib/llm-usage.ts';
import { getMuirouterUpstreamCreds } from '../lib/muirouter-token.ts';
import { charge, ensureBalance } from '../lib/wallet.ts';
import type { AppEnv } from '../middleware/api-key.ts';

/**
 * /llm/v1/* —— OpenAI 兼容反向代理。
 *
 * 双路径分流（**muicv 平台余额优先**）：
 *   1. **muicv 平台**（默认）：muicv tokenBalance > 0 → 用 worker secret OPENAI_API_KEY
 *      调 https://api.openai.com/v1，**按 token 钱包扣费**（pre-check + tee 聚合
 *      usage + post-record charge）。比例 1.1× 上游 token，向上取整。
 *   2. **muirouter fallback**：muicv 余额 = 0 且用户绑了 muirouter → 解密 access_token
 *      （必要时 refresh）转发到 https://api.muirouter.com。**不扣 muicv 余额**
 *      （用户自己的 muirouter 钱包扣）；如果客户端没指定 model，注入用户的 defaultModel。
 *   3. **都没有**：余额 = 0 且没绑 muirouter → 402 insufficient_balance。
 *
 * Path 映射统一：/llm/v1/chat/completions → <upstream>/v1/chat/completions。
 */

const OPENAI_BASE = 'https://api.openai.com';
const MUIROUTER_BASE = 'https://api.muirouter.com';

const CHAT_COMPLETIONS_PATH = '/v1/chat/completions';

export async function handleLlmProxy(c: Context<AppEnv>): Promise<Response> {
  const userId = c.get('userId');
  if (!userId) {
    return c.json({ error: 'unauthorized' }, 401);
  }

  const wallet = await ensureBalance(c.env, userId);

  let upstreamBase: string;
  let upstreamKey: string;
  let isPlatform: boolean;
  let injectedModel: string | null = null;

  if (wallet.balance > 0) {
    const platformKey = c.env.OPENAI_API_KEY;
    if (!platformKey) {
      return c.json(
        {
          error: 'platform-key-missing',
          message: '后端没配 OPENAI_API_KEY（部署人员需要 wrangler secret put OPENAI_API_KEY）',
        },
        500,
      );
    }
    upstreamBase = OPENAI_BASE;
    upstreamKey = platformKey;
    isPlatform = true;
  } else {
    let creds;
    try {
      creds = await getMuirouterUpstreamCreds(c.env, userId);
    } catch (err) {
      const reason = err instanceof MuirouterOauthError ? err.code : 'token-refresh-failed';
      return c.json({ error: reason, message: 'muirouter access_token 续期失败，请回 dashboard 重新关联' }, 502);
    }
    if (!creds) {
      return c.json(insufficientBalanceError(wallet.balance), 402);
    }
    upstreamBase = MUIROUTER_BASE;
    upstreamKey = creds.accessToken;
    injectedModel = creds.defaultModel;
    isPlatform = false;
  }

  // 拼上游 URL
  const incoming = new URL(c.req.url);
  const upstreamPath = incoming.pathname.replace(/^\/llm\//, '/');
  const upstreamUrl = `${upstreamBase}${upstreamPath}${incoming.search}`;

  // 解析 body：平台路径需要注入 stream_options.include_usage 才能聚合扣账；
  // muirouter 路径需要在客户端没传 model 时注入 defaultModel。
  const isChatCompletions = upstreamPath === CHAT_COMPLETIONS_PATH;
  let bodyText: string | null = null;
  let parsedBody: { stream?: boolean; stream_options?: { include_usage?: boolean }; model?: string } | null = null;
  let isStreaming = false;
  let clientWantedUsage = false;

  if (isChatCompletions && c.req.method === 'POST') {
    bodyText = await c.req.text();
    try {
      parsedBody = JSON.parse(bodyText);
      isStreaming = parsedBody?.stream === true;
      let mutated = false;

      if (isPlatform && isStreaming && parsedBody) {
        if (parsedBody.stream_options?.include_usage === true) {
          clientWantedUsage = true;
        } else {
          parsedBody.stream_options = { ...(parsedBody.stream_options ?? {}), include_usage: true };
          mutated = true;
        }
      }

      if (!isPlatform && injectedModel && parsedBody) {
        const m = parsedBody.model;
        if (typeof m !== 'string' || m.length === 0 || m === 'auto' || m === 'default') {
          parsedBody.model = injectedModel;
          mutated = true;
        }
      }

      if (mutated && parsedBody) {
        bodyText = JSON.stringify(parsedBody);
      }
    } catch {
      // 非 JSON body，透传让上游报错
    }
  }

  // 构造上游 headers
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

  // 发起 fetch
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
        upstream: isPlatform ? 'openai' : 'muirouter',
        message: error instanceof Error ? error.message : '上游网络错误',
      },
      502,
    );
  }

  // 响应处理
  const responseHeaders = new Headers();
  for (const [k, v] of upstreamRes.headers.entries()) {
    const lower = k.toLowerCase();
    if (lower === 'content-encoding' || lower === 'transfer-encoding' || lower === 'connection') continue;
    responseHeaders.set(k, v);
  }

  // muirouter 不扣账；上游 4xx/5xx 不扣账；非 chat/completions 不扣账
  if (!isPlatform || upstreamRes.status >= 400 || !isChatCompletions) {
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
