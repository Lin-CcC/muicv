/**
 * muirouter client —— 通过 MCP over JSON-RPC streamable-http 调用。
 *
 * 协议参考：https://muirouter.com/mcp
 * 端点：POST https://api.muirouter.com/mcp
 * 认证：Authorization: Bearer sk-gw-...
 * 工具：tools/call name="get_balance" 返回钱包余额、累计充值、累计消费
 *
 * MCP `tools/call` 响应包在 JSON-RPC envelope 里：
 *   { jsonrpc, id, result: { content[], structuredContent?, isError? } }
 *
 * 我们优先取 `result.structuredContent`（MCP 2025-06 新字段），fallback
 * 到 `result.content[0].text` JSON.parse。字段名做 lenient 匹配以容忍
 * `balance` / `balance_cents` / camelCase / 元 vs 分等多种形态。如果实际
 * 响应字段名超出当前匹配范围，看 `result` 原文 + 报错信息排查再调 parser。
 */

const MCP_URL = process.env.MUIROUTER_MCP_URL ?? 'https://api.muirouter.com/mcp';

export type Balance = {
  currency: string;
  balanceCents: number;
  lifetimeToppedUpCents: number | null;
  lifetimeSpentCents: number | null;
  updatedAt: Date;
};

export type BalanceResult =
  | { status: 'ok'; balance: Balance }
  | { status: 'invalid'; message: string } // key 无效 / 撤销
  | { status: 'pending'; message: string } // 端点 404 / 工具未上线
  | { status: 'error'; message: string };

type JsonRpcEnvelope = {
  jsonrpc?: string;
  id?: unknown;
  result?: {
    content?: Array<{ type?: string; text?: string }>;
    structuredContent?: unknown;
    isError?: boolean;
  };
  error?: { code?: number; message?: string; data?: unknown };
};

export async function fetchMuirouterBalance(rawKey: string, signal?: AbortSignal): Promise<BalanceResult> {
  let res: Response;
  try {
    const init: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: `Bearer ${rawKey}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'get_balance', arguments: {} },
      }),
    };
    if (signal) init.signal = signal;
    res = await fetch(MCP_URL, init);
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : 'muirouter 网络错误' };
  }

  if (res.status === 401 || res.status === 403) {
    return { status: 'invalid', message: 'muirouter API key 无效或已被撤销' };
  }
  if (res.status === 404) {
    return { status: 'pending', message: 'muirouter MCP 端点未上线' };
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return {
      status: 'error',
      message: `muirouter ${res.status}: ${detail.slice(0, 200) || '未知错误'}`,
    };
  }

  const ct = res.headers.get('content-type') ?? '';
  let envelope: JsonRpcEnvelope | null;
  try {
    envelope = ct.includes('text/event-stream') ? await readSseFirstMessage(res) : ((await res.json()) as JsonRpcEnvelope);
  } catch {
    return { status: 'error', message: 'muirouter 响应不是合法 JSON' };
  }
  if (!envelope) {
    return { status: 'error', message: 'muirouter 响应为空' };
  }

  // JSON-RPC error
  if (envelope.error) {
    const code = envelope.error.code;
    const msg = envelope.error.message ?? 'muirouter MCP error';
    if (code === -32001 || /unauth|invalid.*key|forbidden/i.test(msg)) {
      return { status: 'invalid', message: msg };
    }
    return { status: 'error', message: msg };
  }

  const result = envelope.result;
  if (!result) {
    return { status: 'error', message: 'muirouter 响应缺 result 字段' };
  }
  if (result.isError) {
    const text = result.content?.find((c) => c?.type === 'text')?.text ?? 'tool returned error';
    return { status: 'error', message: text };
  }

  const payload =
    (typeof result.structuredContent === 'object' && result.structuredContent !== null
      ? (result.structuredContent as Record<string, unknown>)
      : null) ?? extractFromTextContent(result.content);

  if (!payload) {
    return {
      status: 'error',
      message: 'muirouter 响应未提取到 balance 数据。可能字段名超出当前 parser 覆盖；把 result 原文贴给开发者。',
    };
  }

  const balance = parseBalance(payload);
  if (!balance) {
    return {
      status: 'error',
      message: `muirouter balance 字段未识别：${JSON.stringify(payload).slice(0, 200)}`,
    };
  }
  return { status: 'ok', balance };
}

/** 从 content[].text 兜底找 JSON。 */
function extractFromTextContent(
  content: Array<{ type?: string; text?: string }> | undefined,
): Record<string, unknown> | null {
  if (!Array.isArray(content)) return null;
  for (const block of content) {
    if (block?.type === 'text' && typeof block.text === 'string') {
      try {
        const parsed = JSON.parse(block.text);
        if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
      } catch {
        // try next
      }
    }
  }
  return null;
}

function parseBalance(p: Record<string, unknown>): Balance | null {
  const currency = typeof p.currency === 'string' ? p.currency : 'CNY';

  const balanceCents = pickCents(p, ['balance_cents', 'balanceCents', 'wallet_cents', 'amount_cents']);
  const balanceYuan = pickFloat(p, ['balance', 'wallet_balance', 'wallet', 'amount']);
  const bc = balanceCents ?? (balanceYuan !== null ? Math.round(balanceYuan * 100) : null);
  if (bc === null) return null;

  const tuCents = pickCents(p, [
    'total_topped_up_cents',
    'topped_up_cents',
    'lifetime_topped_up_cents',
    'totalToppedUpCents',
  ]);
  const tuYuan = pickFloat(p, ['total_topped_up', 'topped_up', 'lifetime_topped_up', 'totalToppedUp']);
  const tu = tuCents ?? (tuYuan !== null ? Math.round(tuYuan * 100) : null);

  const spCents = pickCents(p, ['total_spent_cents', 'spent_cents', 'lifetime_spent_cents', 'totalSpentCents']);
  const spYuan = pickFloat(p, ['total_spent', 'spent', 'lifetime_spent', 'totalSpent']);
  const sp = spCents ?? (spYuan !== null ? Math.round(spYuan * 100) : null);

  const updatedAtRaw = p.updated_at ?? p.updatedAt;
  const updatedAt =
    typeof updatedAtRaw === 'string' && !Number.isNaN(Date.parse(updatedAtRaw))
      ? new Date(updatedAtRaw)
      : new Date();

  return { currency, balanceCents: bc, lifetimeToppedUpCents: tu, lifetimeSpentCents: sp, updatedAt };
}

function pickCents(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v);
  }
  return null;
}

function pickFloat(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim().length > 0) {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

/**
 * 读 SSE 流，返回第一个 message event 的 data JSON。
 * Streamable HTTP 模式下 server 用 SSE 包 JSON-RPC 响应是常见做法。
 */
async function readSseFirstMessage(res: Response): Promise<JsonRpcEnvelope | null> {
  const text = await res.text();
  const blocks = text.split(/\n\n+/);
  for (const block of blocks) {
    const dataLines = block
      .split('\n')
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.slice(5).trim())
      .filter(Boolean);
    if (dataLines.length === 0) continue;
    const json = dataLines.join('\n');
    try {
      return JSON.parse(json) as JsonRpcEnvelope;
    } catch {
      // try next
    }
  }
  return null;
}

// -------------------- key 校验 / preview / 显示 --------------------

const KEY_PREFIX = 'sk-gw-';
const KEY_PATTERN = /^sk-gw-[A-Za-z0-9_-]+$/;
const KEY_MIN_LENGTH = 14;

export function looksLikeMuirouterKey(input: unknown): input is string {
  if (typeof input !== 'string') return false;
  const trimmed = input.trim();
  return KEY_PATTERN.test(trimmed) && trimmed.length >= KEY_MIN_LENGTH;
}

export function previewMuirouterKey(key: string): string {
  const trimmed = key.trim();
  if (trimmed.length <= 8) return '••••';
  if (trimmed.startsWith(KEY_PREFIX)) {
    const body = trimmed.slice(KEY_PREFIX.length);
    return `${KEY_PREFIX}${body.slice(0, 4)}…${body.slice(-4)}`;
  }
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
}

export function formatCents(cents: number, currency = 'CNY'): string {
  const symbol = currency === 'CNY' ? '¥' : currency === 'USD' ? '$' : `${currency} `;
  return `${symbol}${(cents / 100).toFixed(2)}`;
}
