import { displayToMicro, insufficientBalanceError, JD_FETCH_COST } from '@muicv/shared';
import type { Context } from 'hono';

import { toErrorMessage } from '../lib/error-message.ts';
import { FetchJdError, fetchJd } from '../lib/fetch-jd.ts';
import { readJsonBody } from '../lib/json-body.ts';
import { charge, ensureBalance } from '../lib/wallet.ts';
import type { AppEnv } from '../middleware/api-key.ts';

/**
 * POST /jobs/fetch —— 用 Cloudflare Browser Rendering 抓公开 JD 页面，转 markdown 返回。
 *
 * Body: { url: string }
 * 响应：200 / 400 / 402 / 502
 * 计费：成功才扣 JD_FETCH_COST tokens；抓取失败 502 但不扣账。
 *
 * 限制（MVP）：不绕登录墙、不对抗 Turnstile / Captcha、不伪装 UA 规避 ToS、
 * 单次请求 20s 超时（在 container 侧）。
 */
export async function handleJobsFetch(c: Context<AppEnv>): Promise<Response> {
  const parsed = await readJsonBody<{ url?: unknown }>(c);
  if (!parsed.ok) return parsed.response;
  const payload = parsed.body;

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
        detail: toErrorMessage(error),
        url,
      },
      502,
    );
  }
}
