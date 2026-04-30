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
};

function mockEnv(opts: MockOptions = {}): unknown {
  const stmt: Stmt = {
    bind: () => stmt,
    run: opts.run ?? (async () => ({ success: true })),
    first: opts.first ?? (async () => null),
  };
  return {
    MUICV_API_DB: { prepare: () => stmt },
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
    { method: 'POST', headers: { 'content-type': 'text/plain' }, body: 'hi' },
    mockEnv(),
    ctx,
  );
  assert.equal(res.status, 400);
});

test('POST /render markdown 缺失 → 400', async () => {
  const res = await app.request(
    '/render',
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' },
    mockEnv(),
    ctx,
  );
  assert.equal(res.status, 400);
  const body = (await res.json()) as { error: string };
  assert.match(body.error, /markdown/);
});

test('POST /jobs/fetch url 不是 http(s) → 400', async () => {
  const res = await app.request(
    '/jobs/fetch',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'ftp://example.com/jd' }),
    },
    mockEnv(),
    ctx,
  );
  assert.equal(res.status, 400);
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
