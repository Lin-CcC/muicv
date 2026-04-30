import test from 'node:test';
import assert from 'node:assert/strict';

import app from '../src/app.ts';

/**
 * 真正的 happy path（PDF 渲染、JD 抓取）需要 Docker + Container，留给 e2e。
 * 这里用 Hono 的 app.request() 直接打 in-memory 实例，覆盖：
 *
 * 1. 入口层请求校验（content-type / 字段 schema）—— 最容易回归
 * 2. /waitlist 走 mock D1 的成功 / 冲突路径
 * 3. /me 缺 key 直接 401
 *
 * D1 mock 只实现 prepare→bind→run/first 链路，足够 hit handler 的所有分支。
 */

type Stmt = {
  bind: (..._args: unknown[]) => Stmt;
  run: () => Promise<unknown>;
  first: <T = unknown>() => Promise<T | null>;
};

type MockOptions = {
  run?: () => Promise<unknown>;
  first?: <T = unknown>() => Promise<T | null>;
  /** true 时 SELECT FROM apiKey 强制返 fake 行，让带 FAKE_API_KEY 的请求通过 requireApiKey */
  authenticated?: boolean;
};

const FAKE_API_KEY = `mui_${'a'.repeat(32)}`;
const FAKE_USER_ID = 'u_test';

function mockEnv(opts: MockOptions = {}): unknown {
  const makeStmt = (sql: string): Stmt => {
    const stmt: Stmt = {
      bind: () => stmt,
      run: opts.run ?? (async () => ({ success: true })),
      first: async <T = unknown>(): Promise<T | null> => {
        if (opts.authenticated && /FROM apiKey/i.test(sql)) {
          return { id: 'k_test', userId: FAKE_USER_ID, revokedAt: null } as T;
        }
        // 其余表走调用方 first override 或默认 null
        return opts.first ? await opts.first<T>() : null;
      },
    };
    return stmt;
  };
  return {
    MUICV_API_DB: { prepare: (sql: string) => makeStmt(sql) },
    // BROWSER / MUICV_KV 这些只需要满足 type shape；当前测试只覆盖入口校验
    // 路径，不会真的走 puppeteer 渲染 / KV 读写。
    BROWSER: { fetch: async () => new Response('') },
    MUICV_KV: {
      put: async () => {},
      get: async () => null,
      delete: async () => {},
    },
    RENDER_BASE_URL: 'https://muicv.com',
  };
}

const AUTH = { authorization: `Bearer ${FAKE_API_KEY}` };
const authedEnv = (opts: Omit<MockOptions, 'authenticated'> = {}) => mockEnv({ ...opts, authenticated: true });

const ctx = { waitUntil: () => {}, passThroughOnException: () => {} } as unknown as ExecutionContext;

test('GET / 返回 routes 清单', async () => {
  const res = await app.request('/', undefined, mockEnv(), ctx);
  assert.equal(res.status, 200);
  const body = (await res.json()) as { name: string; routes: string[] };
  assert.equal(body.name, 'muicv-api');
  assert.ok(Array.isArray(body.routes) && body.routes.length > 0);
});

test('GET /health 返回 ok', async () => {
  const res = await app.request('/health', undefined, mockEnv(), ctx);
  assert.equal(res.status, 200);
  assert.equal(await res.text(), 'ok');
});

test('POST /render content-type 不是 JSON → 400', async () => {
  const res = await app.request(
    '/render',
    { method: 'POST', headers: { 'content-type': 'text/plain', ...AUTH }, body: 'hi' },
    authedEnv(),
    ctx,
  );
  assert.equal(res.status, 400);
});

test('POST /render markdown 缺失 → 400', async () => {
  const res = await app.request(
    '/render',
    { method: 'POST', headers: { 'content-type': 'application/json', ...AUTH }, body: '{}' },
    authedEnv(),
    ctx,
  );
  assert.equal(res.status, 400);
  const body = (await res.json()) as { error: string };
  assert.match(body.error, /markdown/);
});

test('POST /render 缺 Authorization → 401', async () => {
  const res = await app.request(
    '/render',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ markdown: '# hi' }),
    },
    mockEnv(),
    ctx,
  );
  assert.equal(res.status, 401);
});

test('POST /render 余额不足 → 402', async () => {
  const res = await app.request(
    '/render',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...AUTH },
      body: JSON.stringify({ markdown: '# hi' }),
    },
    // ensureBalance 的 INSERT…ON CONFLICT…DO NOTHING RETURNING 在 mock 里返 null
    // → 走 readBalance 兜底也返 null → 余额视作 0 < PDF_RENDER_COST → 402
    authedEnv(),
    ctx,
  );
  assert.equal(res.status, 402);
  const body = (await res.json()) as { error: { code: string } };
  assert.equal(body.error.code, 'insufficient_balance');
});

test('POST /jobs/fetch url 不是 http(s) → 400', async () => {
  const res = await app.request(
    '/jobs/fetch',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...AUTH },
      body: JSON.stringify({ url: 'ftp://example.com/jd' }),
    },
    authedEnv(),
    ctx,
  );
  assert.equal(res.status, 400);
});

test('POST /jobs/fetch 缺 Authorization → 401', async () => {
  const res = await app.request(
    '/jobs/fetch',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com/jd' }),
    },
    mockEnv(),
    ctx,
  );
  assert.equal(res.status, 401);
});

test('POST /waitlist email 非法 → 400', async () => {
  const res = await app.request(
    '/waitlist',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email' }),
    },
    mockEnv(),
    ctx,
  );
  assert.equal(res.status, 400);
});

test('POST /waitlist 合法 email → 201', async () => {
  const res = await app.request(
    '/waitlist',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'someone@example.com', source: 'test' }),
    },
    mockEnv(),
    ctx,
  );
  assert.equal(res.status, 201);
  const body = (await res.json()) as { ok: boolean };
  assert.equal(body.ok, true);
});

test('POST /waitlist UNIQUE 冲突 → 409', async () => {
  const res = await app.request(
    '/waitlist',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'dup@example.com' }),
    },
    mockEnv({
      run: async () => {
        throw new Error('UNIQUE constraint failed: waitlist.email');
      },
    }),
    ctx,
  );
  assert.equal(res.status, 409);
  const body = (await res.json()) as { error: string };
  assert.equal(body.error, 'already-registered');
});

test('GET /me 缺 Authorization → 401', async () => {
  const res = await app.request('/me', undefined, mockEnv(), ctx);
  assert.equal(res.status, 401);
});

test('POST /render 请求体不是合法 JSON → 400', async () => {
  const res = await app.request(
    '/render',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...AUTH },
      body: '{not-json',
    },
    authedEnv(),
    ctx,
  );
  assert.equal(res.status, 400);
  const body = (await res.json()) as { error: string };
  assert.match(body.error, /JSON/);
});

test('POST /render markdown 是空字符串 → 400', async () => {
  const res = await app.request(
    '/render',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...AUTH },
      body: JSON.stringify({ markdown: '   ' }),
    },
    authedEnv(),
    ctx,
  );
  assert.equal(res.status, 400);
});

test('POST /jobs/fetch content-type 不是 JSON → 400', async () => {
  const res = await app.request(
    '/jobs/fetch',
    { method: 'POST', headers: { 'content-type': 'text/plain', ...AUTH }, body: 'hi' },
    authedEnv(),
    ctx,
  );
  assert.equal(res.status, 400);
});

test('POST /jobs/fetch url 缺失 → 400', async () => {
  const res = await app.request(
    '/jobs/fetch',
    { method: 'POST', headers: { 'content-type': 'application/json', ...AUTH }, body: '{}' },
    authedEnv(),
    ctx,
  );
  assert.equal(res.status, 400);
});

test('POST /jobs/fetch 请求体不是合法 JSON → 400', async () => {
  const res = await app.request(
    '/jobs/fetch',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...AUTH },
      body: '{bad',
    },
    authedEnv(),
    ctx,
  );
  assert.equal(res.status, 400);
});

test('POST /waitlist 请求体不是合法 JSON → 400', async () => {
  const res = await app.request(
    '/waitlist',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'oops',
    },
    mockEnv(),
    ctx,
  );
  // waitlist 路由当前对非法 JSON 走 email 缺失分支 → 400
  assert.equal(res.status, 400);
});

test('GET /me Authorization 不是 Bearer → 401', async () => {
  const res = await app.request('/me', { headers: { authorization: 'Basic abcd' } }, mockEnv(), ctx);
  assert.equal(res.status, 401);
  const body = (await res.json()) as { error: string };
  assert.match(body.error, /Bearer/);
});

test('GET /me Bearer 后是非法 key 格式 → 401', async () => {
  const res = await app.request('/me', { headers: { authorization: 'Bearer not-a-mui-key' } }, mockEnv(), ctx);
  assert.equal(res.status, 401);
});

test('GET /me 合法格式但 DB 查不到 key → 401', async () => {
  const res = await app.request(
    '/me',
    { headers: { authorization: `Bearer mui_${'a'.repeat(32)}` } },
    mockEnv({ first: async () => null }),
    ctx,
  );
  assert.equal(res.status, 401);
});

test('GET /llm/v1/models 缺 key → 401', async () => {
  const res = await app.request('/llm/v1/models', undefined, mockEnv(), ctx);
  assert.equal(res.status, 401);
});

test('CORS preflight from muicv.com 被允许', async () => {
  const res = await app.request(
    '/render',
    {
      method: 'OPTIONS',
      headers: {
        origin: 'https://muicv.com',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      },
    },
    mockEnv(),
    ctx,
  );
  // hono cors middleware: 命中白名单时回 access-control-allow-origin
  assert.equal(res.headers.get('access-control-allow-origin'), 'https://muicv.com');
});

test('CORS preflight from 未授信 origin 不返回 allow-origin', async () => {
  const res = await app.request(
    '/render',
    {
      method: 'OPTIONS',
      headers: {
        origin: 'https://evil.example.com',
        'access-control-request-method': 'POST',
      },
    },
    mockEnv(),
    ctx,
  );
  assert.equal(res.headers.get('access-control-allow-origin'), null);
});
