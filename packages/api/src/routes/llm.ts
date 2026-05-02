import type { Context } from 'hono';

import {
  computeLlmCharge,
  insufficientBalanceError,
  isSupportedLlmModel,
  MuirouterOauthError,
  SUPPORTED_LLM_MODELS,
} from '@muicv/shared';

import { extractUsageFromSseStream, stripUsageChunkFromSse } from '../lib/llm-usage.ts';
import { getMuirouterUpstreamCreds } from '../lib/muirouter-token.ts';
import { charge, ensureBalance } from '../lib/wallet.ts';
import type { AppEnv } from '../middleware/api-key.ts';

/**
 * /llm/v1/* —— OpenAI 兼容反向代理。
 *
 * 三种上游路径（按 muicv 平台余额优先 + body.model 分流）：
 *   1. **平台 OpenAI**：余额 > 0 + model 是 `gpt-*` → worker secret OPENAI_API_KEY，
 *      上游 https://api.openai.com/v1，按 model 分价扣费（见 LLM_PRICING）。
 *   2. **平台 Xiaomi**：余额 > 0 + model 是 `mimo-*` → worker secret MIMO_API_KEY，
 *      上游 https://token-plan-sgp.xiaomimimo.com/v1（OpenAI 兼容），同样按表扣费。
 *   3. **muirouter fallback**：余额 = 0 + 用户绑了 muirouter → 解密 access_token
 *      转发到 https://api.muirouter.com，**不扣 muicv 余额**（用户自己的 muirouter
 *      钱包扣）；客户端没指定 model 时注入用户的 defaultModel。
 *   4. **都没有**：余额 = 0 且没绑 muirouter → 402 insufficient_balance。
 *
 * 平台路径（1+2）只接受 LLM_PRICING 表里的 model；表外 model（如老的 gpt-4o-mini）
 * → 400 unsupported_model，让客户端显式升级 default。muirouter 路径不受本表约束。
 *
 * Path 映射：/llm/v1/chat/completions → <upstream>/v1/chat/completions。
 */

const OPENAI_BASE = 'https://api.openai.com';
const XIAOMI_BASE = 'https://token-plan-sgp.xiaomimimo.com';
const MUIROUTER_BASE = 'https://api.muirouter.com';

const CHAT_COMPLETIONS_PATH = '/v1/chat/completions';

type PlatformProvider = {
  name: 'openai' | 'xiaomi';
  base: string;
  key: string | undefined;
  missingErr: 'openai-key-missing' | 'mimo-key-missing';
};

function pickPlatformProvider(
  model: string,
  env: { OPENAI_API_KEY?: string; MIMO_API_KEY?: string },
): PlatformProvider {
  if (model.startsWith('mimo-')) {
    return { name: 'xiaomi', base: XIAOMI_BASE, key: env.MIMO_API_KEY, missingErr: 'mimo-key-missing' };
  }
  return { name: 'openai', base: OPENAI_BASE, key: env.OPENAI_API_KEY, missingErr: 'openai-key-missing' };
}

export async function handleLlmProxy(c: Context<AppEnv>): Promise<Response> {
  const userId = c.get('userId');
  if (!userId) {
    return c.json({ error: 'unauthorized' }, 401);
  }

  const wallet = await ensureBalance(c.env, userId);

  // 先 peek body 拿 model，platform 路径要据此分上游 + 校验是否支持。
  const incoming = new URL(c.req.url);
  const upstreamPath = incoming.pathname.replace(/^\/llm\//, '/');
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
      if (parsedBody?.stream_options?.include_usage === true) {
        clientWantedUsage = true;
      }
    } catch {
      // 非 JSON body，透传让上游报错
    }
  }

  let upstreamBase: string;
  let upstreamKey: string;
  let isPlatform: boolean;
  let injectedModel: string | null = null;

  if (wallet.balance > 0) {
    // 平台路径：chat/completions 必须带支持的 model；其它端点（/v1/models 等）默认走 OpenAI。
    if (isChatCompletions) {
      const model = parsedBody?.model;
      if (typeof model !== 'string' || !isSupportedLlmModel(model)) {
        return c.json(
          {
            error: 'unsupported_model',
            message: `model "${model ?? ''}" 不在平台支持列表里，请改成下列之一`,
            supported: SUPPORTED_LLM_MODELS,
          },
          400,
        );
      }
      const provider = pickPlatformProvider(model, c.env);
      if (!provider.key) {
        return c.json(
          {
            error: provider.missingErr,
            message: `后端没配 ${provider.name === 'xiaomi' ? 'MIMO_API_KEY' : 'OPENAI_API_KEY'}（部署人员需要 wrangler secret put）`,
          },
          500,
        );
      }
      upstreamBase = provider.base;
      upstreamKey = provider.key;
    } else {
      // /v1/models 这类无 body 端点：默认 OpenAI，让客户端能正常列模型
      const platformKey = c.env.OPENAI_API_KEY;
      if (!platformKey) {
        return c.json({ error: 'openai-key-missing', message: '后端没配 OPENAI_API_KEY' }, 500);
      }
      upstreamBase = OPENAI_BASE;
      upstreamKey = platformKey;
    }
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

  const upstreamUrl = `${upstreamBase}${upstreamPath}${incoming.search}`;

  // body 修改：平台路径 stream 时注入 include_usage 用于聚合扣账；
  // muirouter 路径在客户端没传 model 时注入 defaultModel。
  if (isChatCompletions && c.req.method === 'POST' && parsedBody) {
    let mutated = false;

    if (isPlatform && isStreaming) {
      if (parsedBody.stream_options?.include_usage !== true) {
        parsedBody.stream_options = { ...(parsedBody.stream_options ?? {}), include_usage: true };
        mutated = true;
      }
    }

    if (!isPlatform && injectedModel) {
      const m = parsedBody.model;
      if (typeof m !== 'string' || m.length === 0 || m === 'auto' || m === 'default') {
        parsedBody.model = injectedModel;
        mutated = true;
      }
    }

    if (mutated) {
      bodyText = JSON.stringify(parsedBody);
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
        upstream: isPlatform ? 'platform' : 'muirouter',
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
        const cost = computeLlmCharge(model, usage.prompt_tokens, usage.completion_tokens);
        if (cost == null) return;
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
      const cost = computeLlmCharge(json.model ?? model, json.usage.prompt_tokens, json.usage.completion_tokens);
      if (cost != null) {
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
    }
  } catch {
    // 不是 JSON，跳过扣账（不太可能，但容错）
  }
  return new Response(text, {
    status: upstreamRes.status,
    headers: responseHeaders,
  });
}
