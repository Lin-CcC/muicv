import type { Currency } from '@muicv/shared';

/**
 * 用户币种 / 区域偏好。
 *
 * 判定顺序（短路）：
 *   1. cookie `muicv_currency` 显式值（usd | cny），用户手动 toggle 后写入
 *   2. Cloudflare 给的 `cf-ipcountry` 头：CN → cny
 *   3. 兜底 usd
 *
 * cookie 优先级最高，保证 VPN / 海外华人 / 临时切换都能锁住选择。
 * 该函数 server 端 / API route / Next server component 共用，
 * 入参 shape 兼容标准 `Request` 与 Next `headers()` 返回的对象。
 */
export const CURRENCY_COOKIE = 'muicv_currency';

const COOKIE_RE = /(?:^|;\s*)muicv_currency=(usd|cny)/;

export function getRequestCurrency(request: Request | { headers: Headers }): Currency {
  const headers = request.headers;
  const cookie = headers.get('cookie') ?? '';
  const match = cookie.match(COOKIE_RE);
  if (match) return match[1] as Currency;
  const country = headers.get('cf-ipcountry')?.toUpperCase();
  if (country === 'CN') return 'cny';
  return 'usd';
}

/**
 * 用户网络是否在中国大陆。只看 Cloudflare 注入的真实地理位置 `cf-ipcountry`，
 * 不读币种 cookie——下载路由要的是网络位置，与账单偏好解耦：海外华人即使把币种切到 ¥，
 * GitHub 直连通常更快，不该被强行代理。
 */
export function isMainlandChina(request: Request | { headers: Headers }): boolean {
  return request.headers.get('cf-ipcountry')?.toUpperCase() === 'CN';
}
