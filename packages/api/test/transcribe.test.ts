import assert from 'node:assert/strict';
import test from 'node:test';

import app from '../src/app.ts';

/**
 * /audio/transcribe 测试（issue #1 M1）。
 *
 * 跟 routes.test.ts 同一套 mock 思路：用 Hono 的 app.request() 直接打 in-memory 实例，
 * stub D1（apiKey / tokenBalance / tokenLedger）+ stub env.AI.run。覆盖：
 *   - 入口校验（缺 key / content-type / 缺 file / oversize）
 *   - 余额不足 / 余额够走通
 *   - Whisper 调用失败 → 502 + 不扣账
 *   - duration > 10min → 400
 */

type Stmt = {
  bind: (..._args: unknown[]) => Stmt;
  run: () => Promise<unknown>;
  first: <T = unknown>() => Promise<T | null>;
};

type AiRunResult = Ai_Cf_Openai_Whisper_Large_V3_Turbo_Output;

type MockOptions = {
  authenticated?: boolean;
  walletMicro?: number;
  /** AI.run 默认行为：返回固定 happy-path 输出。设为 'throw' 模拟模型错误；可传函数自定义。 */
  ai?: 'throw' | (() => Promise<AiRunResult> | AiRunResult);
  /** 收集 ledger 写入，断言扣账金额。 */
  ledgerCaptures?: Array<{ delta: number; type: string }>;
  /** 余额扣账后返回的新行（默认走 walletMicro - amount）。 */
  walletAfterCharge?: number;
};

const FAKE_API_KEY = `mui_${'a'.repeat(32)}`;
const FAKE_USER_ID = 'u_test';

function defaultAiResult(): AiRunResult {
  return {
    text: '这是一段中文测试转写。',
    transcription_info: {
      language: 'zh',
      duration: 12.5,
    },
    segments: [{ start: 0, end: 12.5, text: '这是一段中文测试转写。' }],
  };
}

function mockEnv(opts: MockOptions = {}): unknown {
  let walletBalance = opts.walletMicro;

  const makeStmt = (sql: string): Stmt => {
    const captured: { args: unknown[] } = { args: [] };
    const stmt: Stmt = {
      bind: (...args) => {
        captured.args = args;
        return stmt;
      },
      run: async () => {
        if (opts.ledgerCaptures && /INSERT INTO tokenLedger/i.test(sql)) {
          // tokenLedger 字段顺序：id, userId, delta, type, meta, createdAt
          const delta = captured.args[2] as number;
          const ledgerType = captured.args[3] as string;
          opts.ledgerCaptures.push({ delta, type: ledgerType });
        }
        return { success: true };
      },
      first: async <T = unknown>(): Promise<T | null> => {
        if (opts.authenticated && /FROM apiKey/i.test(sql)) {
          return { id: 'k_test', userId: FAKE_USER_ID, revokedAt: null } as T;
        }
        // ensureBalance 的 INSERT…ON CONFLICT…DO NOTHING RETURNING
        if (/INSERT INTO tokenBalance/i.test(sql) && /ON CONFLICT/i.test(sql)) {
          // conflict（行已存在）→ 返 null，让 ensureBalance 走 readBalance 兜底
          if (walletBalance != null) return null;
          return null;
        }
        // charge 的 UPDATE … WHERE balance >= ? RETURNING balance
        if (/UPDATE tokenBalance/i.test(sql) && /RETURNING balance/i.test(sql)) {
          if (walletBalance == null) return null;
          const amount = captured.args[0] as number;
          if (walletBalance < amount) return null;
          walletBalance -= amount;
          const after = opts.walletAfterCharge ?? walletBalance;
          return { balance: after } as T;
        }
        // readBalance
        if (/SELECT balance/i.test(sql) && /tokenBalance/i.test(sql)) {
          if (walletBalance == null) return null;
          return { balance: walletBalance, lifetimeEarned: walletBalance, lifetimeSpent: 0 } as T;
        }
        return null;
      },
    };
    return stmt;
  };

  const aiRun = async (model: string, _input: unknown): Promise<AiRunResult> => {
    if (model !== '@cf/openai/whisper-large-v3-turbo') {
      throw new Error(`unexpected model ${model}`);
    }
    if (opts.ai === 'throw') throw new Error('AI binding boom');
    if (typeof opts.ai === 'function') return await opts.ai();
    return defaultAiResult();
  };

  return {
    MUICV_API_DB: { prepare: (sql: string) => makeStmt(sql) },
    BROWSER: { fetch: async () => new Response('') },
    MUICV_KV: { put: async () => {}, get: async () => null, delete: async () => {} },
    AI: { run: aiRun },
    RENDER_BASE_URL: 'https://muicv.com',
    OPENAI_API_KEY: 'sk-fake',
    MIMO_API_KEY: 'sk-fake',
  };
}

const AUTH = { authorization: `Bearer ${FAKE_API_KEY}` };
const ctx = { waitUntil: (p: Promise<unknown>) => p, passThroughOnException: () => {} } as unknown as ExecutionContext;

function buildMultipart(filename: string, contentType: string, bytes: Uint8Array): { body: ArrayBuffer; ct: string } {
  const boundary = `----muicvtest${Math.random().toString(36).slice(2)}`;
  const head = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`;
  const tail = `\r\n--${boundary}--\r\n`;
  const headBuf = new TextEncoder().encode(head);
  const tailBuf = new TextEncoder().encode(tail);
  const body = new Uint8Array(headBuf.byteLength + bytes.byteLength + tailBuf.byteLength);
  body.set(headBuf, 0);
  body.set(bytes, headBuf.byteLength);
  body.set(tailBuf, headBuf.byteLength + bytes.byteLength);
  return {
    body: body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer,
    ct: `multipart/form-data; boundary=${boundary}`,
  };
}

test('POST /audio/transcribe 缺 Authorization → 401', async () => {
  const res = await app.request('/audio/transcribe', { method: 'POST' }, mockEnv(), ctx);
  assert.equal(res.status, 401);
});

test('POST /audio/transcribe content-type 不是 multipart → 400', async () => {
  const res = await app.request(
    '/audio/transcribe',
    { method: 'POST', headers: { 'content-type': 'application/json', ...AUTH }, body: '{}' },
    mockEnv({ authenticated: true, walletMicro: 100_000_000 }),
    ctx,
  );
  assert.equal(res.status, 400);
  const body = (await res.json()) as { error: string };
  assert.match(body.error, /multipart/);
});

test('POST /audio/transcribe 缺 file 字段 → 400', async () => {
  const boundary = 'boundary42';
  const empty = `--${boundary}--\r\n`;
  const res = await app.request(
    '/audio/transcribe',
    {
      method: 'POST',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}`, ...AUTH },
      body: empty,
    },
    mockEnv({ authenticated: true, walletMicro: 100_000_000 }),
    ctx,
  );
  assert.equal(res.status, 400);
  const body = (await res.json()) as { error: string };
  assert.match(body.error, /file/);
});

test('POST /audio/transcribe 余额不足 → 402', async () => {
  const { body, ct } = buildMultipart('test.webm', 'audio/webm', new Uint8Array([1, 2, 3, 4]));
  const res = await app.request(
    '/audio/transcribe',
    { method: 'POST', headers: { 'content-type': ct, ...AUTH }, body },
    // walletMicro 不设 → 余额 0 < 1 分钟最低预扣 → 402
    mockEnv({ authenticated: true }),
    ctx,
  );
  assert.equal(res.status, 402);
  const json = (await res.json()) as { error: { code: string } };
  assert.equal(json.error.code, 'insufficient_balance');
});

test('POST /audio/transcribe 余额够 + AI happy path → 200 + 扣账', async () => {
  const ledgerCaptures: Array<{ delta: number; type: string }> = [];
  const { body, ct } = buildMultipart('test.webm', 'audio/webm', new Uint8Array([1, 2, 3, 4]));
  const res = await app.request(
    '/audio/transcribe',
    { method: 'POST', headers: { 'content-type': ct, ...AUTH }, body },
    mockEnv({ authenticated: true, walletMicro: 100_000_000, ledgerCaptures }),
    ctx,
  );
  assert.equal(res.status, 200);
  const json = (await res.json()) as { transcript: string; duration_ms: number; language: string };
  assert.equal(json.transcript, '这是一段中文测试转写。');
  assert.equal(json.duration_ms, 12_500);
  assert.equal(json.language, 'zh');

  // duration 12.5s 向上取整到 1 分钟 = 100 显示 token = 1_000_000 μtoken
  // waitUntil 回调在测试 ctx 里直接 await（见 ctx 实现）
  await new Promise((r) => setTimeout(r, 0));
  const sttLedger = ledgerCaptures.find((l) => l.type === 'stt_transcribe');
  assert.ok(sttLedger, 'expected stt_transcribe ledger entry');
  // delta 是负数（扣账写 -amount）
  assert.equal(sttLedger.delta, -1_000_000);
});

test('POST /audio/transcribe AI 抛错 → 502 + 不扣账', async () => {
  const ledgerCaptures: Array<{ delta: number; type: string }> = [];
  const { body, ct } = buildMultipart('test.webm', 'audio/webm', new Uint8Array([1, 2, 3, 4]));
  const res = await app.request(
    '/audio/transcribe',
    { method: 'POST', headers: { 'content-type': ct, ...AUTH }, body },
    mockEnv({ authenticated: true, walletMicro: 100_000_000, ai: 'throw', ledgerCaptures }),
    ctx,
  );
  assert.equal(res.status, 502);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(
    ledgerCaptures.find((l) => l.type === 'stt_transcribe'),
    undefined,
    'AI 失败时不应该扣 stt_transcribe',
  );
});

test('POST /audio/transcribe duration > 10min → 400', async () => {
  const { body, ct } = buildMultipart('test.webm', 'audio/webm', new Uint8Array([1, 2, 3, 4]));
  const res = await app.request(
    '/audio/transcribe',
    { method: 'POST', headers: { 'content-type': ct, ...AUTH }, body },
    mockEnv({
      authenticated: true,
      walletMicro: 100_000_000,
      ai: () => ({ text: 'ok', transcription_info: { duration: 700, language: 'en' } }),
    }),
    ctx,
  );
  assert.equal(res.status, 400);
  const json = (await res.json()) as { error: string };
  assert.match(json.error, /10 分钟/);
});

test('POST /audio/transcribe AI 返回空 text → 502', async () => {
  const { body, ct } = buildMultipart('test.webm', 'audio/webm', new Uint8Array([1, 2, 3, 4]));
  const res = await app.request(
    '/audio/transcribe',
    { method: 'POST', headers: { 'content-type': ct, ...AUTH }, body },
    mockEnv({
      authenticated: true,
      walletMicro: 100_000_000,
      ai: () => ({ text: '   ', transcription_info: { duration: 5, language: 'en' } }),
    }),
    ctx,
  );
  assert.equal(res.status, 502);
});

test('POST /audio/transcribe AI 缺 duration → 502', async () => {
  const { body, ct } = buildMultipart('test.webm', 'audio/webm', new Uint8Array([1, 2, 3, 4]));
  const res = await app.request(
    '/audio/transcribe',
    { method: 'POST', headers: { 'content-type': ct, ...AUTH }, body },
    mockEnv({
      authenticated: true,
      walletMicro: 100_000_000,
      ai: () => ({ text: 'hi', transcription_info: { language: 'en' } }),
    }),
    ctx,
  );
  assert.equal(res.status, 502);
});
