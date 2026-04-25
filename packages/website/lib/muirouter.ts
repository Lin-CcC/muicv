/**
 * muirouter HTTP client —— 见 docs/muirouter-spec.md。
 *
 * MVP 只调 GET /api/v1/balance。muirouter 端这个 endpoint 还没实现时，
 * 我们 graceful-degrade 返回 'pending'，dashboard 显示"已绑定，余额查询待
 * muirouter API 上线"。
 */

const MUIROUTER_BASE = process.env.MUIROUTER_BASE_URL ?? 'https://muirouter.com';

export type Balance = {
  currency: string;
  balanceCents: number;
  lifetimeToppedUpCents: number | null;
  lifetimeSpentCents: number | null;
  updatedAt: Date;
};

export type BalanceResult =
  | { status: 'ok'; balance: Balance }
  | { status: 'invalid'; message: string } // 401 - key 无效
  | { status: 'pending'; message: string } // 端点未上线 / 404
  | { status: 'error'; message: string }; // 网络 / 5xx

/** 拿到 raw muirouter key（调用方负责解密），调 muirouter 拿 balance。 */
export async function fetchMuirouterBalance(rawKey: string, signal?: AbortSignal): Promise<BalanceResult> {
  let res: Response;
  try {
    const init: RequestInit = {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${rawKey}`,
        Accept: 'application/json',
      },
    };
    if (signal) init.signal = signal;
    res = await fetch(`${MUIROUTER_BASE}/api/v1/balance`, init);
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'muirouter 网络错误',
    };
  }

  if (res.status === 401 || res.status === 403) {
    return { status: 'invalid', message: 'muirouter API key 无效或已被撤销' };
  }
  if (res.status === 404) {
    return { status: 'pending', message: 'muirouter 余额 API 即将上线' };
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return {
      status: 'error',
      message: `muirouter ${res.status}: ${detail.slice(0, 200) || '未知错误'}`,
    };
  }

  let body: {
    currency?: string;
    balance_cents?: number;
    lifetime_topped_up_cents?: number;
    lifetime_spent_cents?: number;
    updated_at?: string;
  };
  try {
    body = await res.json();
  } catch {
    return { status: 'error', message: 'muirouter 响应不是合法 JSON' };
  }

  if (typeof body.balance_cents !== 'number') {
    return { status: 'error', message: 'muirouter 响应缺 balance_cents 字段' };
  }

  return {
    status: 'ok',
    balance: {
      currency: typeof body.currency === 'string' ? body.currency : 'CNY',
      balanceCents: body.balance_cents,
      lifetimeToppedUpCents: typeof body.lifetime_topped_up_cents === 'number' ? body.lifetime_topped_up_cents : null,
      lifetimeSpentCents: typeof body.lifetime_spent_cents === 'number' ? body.lifetime_spent_cents : null,
      updatedAt: body.updated_at ? new Date(body.updated_at) : new Date(),
    },
  };
}

/** 简易格式化 cents → "12.34"。 */
export function formatCents(cents: number, currency = 'CNY'): string {
  const symbol = currency === 'CNY' ? '¥' : currency === 'USD' ? '$' : `${currency} `;
  return `${symbol}${(cents / 100).toFixed(2)}`;
}

const MUIROUTER_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{15,}$/; // 宽松：让 muirouter 端最终决定格式

export function looksLikeMuirouterKey(input: unknown): input is string {
  return typeof input === 'string' && MUIROUTER_KEY_PATTERN.test(input.trim());
}

/** 用于 UI 显示：保留前 4 + 末 4 字符，中间省略。 */
export function previewMuirouterKey(key: string): string {
  const trimmed = key.trim();
  if (trimmed.length <= 8) return '••••';
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
}
