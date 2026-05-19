import type { Currency } from '@muicv/shared';

import { CURRENCY_COOKIE } from '@/lib/region';

export const dynamic = 'force-dynamic';

/**
 * POST /api/billing/currency —— 用户手动切换展示币种。
 *
 * Body: { currency: 'usd' | 'cny' }
 * 写 cookie `muicv_currency`，一年有效；之后 `getRequestCurrency` 会优先读它，覆盖 cf-ipcountry 自动判断。
 * 客户端切完调 router.refresh() 让 server component 用新币种重渲染。
 */
export async function POST(request: Request) {
  let body: { currency?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid-json' }, { status: 400 });
  }

  const currency = body.currency;
  if (currency !== 'usd' && currency !== 'cny') {
    return Response.json({ error: 'currency 必须是 usd | cny' }, { status: 400 });
  }

  const res = Response.json({ ok: true, currency: currency as Currency });
  res.headers.append('Set-Cookie', `${CURRENCY_COOKIE}=${currency}; Path=/; Max-Age=31536000; SameSite=Lax`);
  return res;
}
