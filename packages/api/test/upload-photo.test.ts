import assert from 'node:assert/strict';
import test from 'node:test';

import app from '../src/app.ts';

const FAKE_API_KEY = `mui_${'a'.repeat(32)}`;
const FAKE_USER_ID = 'u_test';
const AUTH = { authorization: `Bearer ${FAKE_API_KEY}` };
const ctx = { waitUntil: () => {}, passThroughOnException: () => {} } as unknown as ExecutionContext;

type PhotoRow = {
  id: number;
  r2Key: string;
  url: string;
  contentType: string;
  sizeBytes: number;
  originalName: string | null;
  createdAt: number;
};

type MockOpts = {
  /** 预填好的 photoUpload 行，给 GET /history 用 */
  history?: PhotoRow[];
};

function mockEnv(opts: MockOpts = {}): unknown {
  const r2 = new Map<string, { body: Uint8Array; meta: unknown }>();
  const insertedAudits: Array<{ args: unknown[] }> = [];
  type Stmt = {
    bind: (..._a: unknown[]) => Stmt;
    run: () => Promise<unknown>;
    first: <T>() => Promise<T | null>;
    all: <T>() => Promise<{ results: T[] }>;
  };
  const makeStmt = (sql: string): Stmt => {
    let bound: unknown[] = [];
    const stmt: Stmt = {
      bind: (...args: unknown[]) => {
        bound = args;
        return stmt;
      },
      run: async () => {
        if (/INSERT INTO photoUpload/i.test(sql)) insertedAudits.push({ args: bound });
        return { success: true };
      },
      first: async <T>(): Promise<T | null> => {
        if (/FROM apiKey/i.test(sql)) {
          return { id: 'k', userId: FAKE_USER_ID, revokedAt: null } as T;
        }
        return null;
      },
      all: async <T>(): Promise<{ results: T[] }> => {
        if (/FROM photoUpload/i.test(sql)) {
          return { results: (opts.history ?? []) as T[] };
        }
        return { results: [] };
      },
    };
    return stmt;
  };
  return {
    __insertedAudits: insertedAudits,
    MUICV_API_DB: { prepare: (sql: string) => makeStmt(sql) },
    BROWSER: { fetch: async () => new Response('') },
    MUICV_KV: { put: async () => {}, get: async () => null, delete: async () => {} },
    MUICV_RESUME_BLOB: { put: async () => ({}), get: async () => null, delete: async () => {} },
    MUICV_PHOTOS: {
      put: async (key: string, body: ArrayBuffer, opt: unknown) => {
        r2.set(key, { body: new Uint8Array(body), meta: opt });
        return { key };
      },
      get: async (key: string) => r2.get(key) ?? null,
      delete: async (key: string) => {
        r2.delete(key);
      },
    },
    RENDER_BASE_URL: 'https://muicv.com',
    PHOTOS_PUBLIC_BASE_URL: 'https://i.muicv.com',
    PREVIEW_PUBLIC_BASE_URL: 'https://muicv.com',
  };
}

test('POST /upload/photo 缺 Authorization → 401', async () => {
  const fd = new FormData();
  fd.append('file', new Blob([new Uint8Array(64)], { type: 'image/jpeg' }), 'a.jpg');
  const res = await app.request('/upload/photo', { method: 'POST', body: fd }, mockEnv(), ctx);
  assert.equal(res.status, 401);
});

test('POST /upload/photo content-type 不是 multipart → 400', async () => {
  const res = await app.request(
    '/upload/photo',
    { method: 'POST', headers: { 'content-type': 'application/json', ...AUTH }, body: '{}' },
    mockEnv(),
    ctx,
  );
  assert.equal(res.status, 400);
});

test('POST /upload/photo file 缺失 → 400', async () => {
  const fd = new FormData();
  fd.append('summary', 'x');
  const res = await app.request('/upload/photo', { method: 'POST', headers: AUTH, body: fd }, mockEnv(), ctx);
  assert.equal(res.status, 400);
});

test('POST /upload/photo 类型不对 (text/plain) → 400', async () => {
  const fd = new FormData();
  fd.append('file', new Blob([new Uint8Array(8)], { type: 'text/plain' }), 'a.txt');
  const res = await app.request('/upload/photo', { method: 'POST', headers: AUTH, body: fd }, mockEnv(), ctx);
  assert.equal(res.status, 400);
});

test('POST /upload/photo 文件太大 → 400', async () => {
  const fd = new FormData();
  fd.append('file', new Blob([new Uint8Array(2 * 1024 * 1024 + 1)], { type: 'image/png' }), 'big.png');
  const res = await app.request('/upload/photo', { method: 'POST', headers: AUTH, body: fd }, mockEnv(), ctx);
  assert.equal(res.status, 400);
});

test('POST /upload/photo 正常 → 201 + 返回 url / key / createdAt', async () => {
  const env = mockEnv() as { __insertedAudits: Array<{ args: unknown[] }> } & object;
  const fd = new FormData();
  fd.append('file', new Blob([new Uint8Array(64)], { type: 'image/jpeg' }), 'me.jpg');
  const res = await app.request('/upload/photo', { method: 'POST', headers: AUTH, body: fd }, env, ctx);
  assert.equal(res.status, 201);
  const body = (await res.json()) as { url: string; key: string; contentType: string; size: number; createdAt: number };
  assert.ok(body.key.startsWith(`${FAKE_USER_ID}/`));
  assert.ok(body.key.endsWith('.jpg'));
  assert.equal(body.contentType, 'image/jpeg');
  assert.equal(body.size, 64);
  assert.equal(body.url, `https://i.muicv.com/${body.key}`);
  assert.ok(body.createdAt > 0);
  // 审计行：userId / r2Key / url / contentType / sizeBytes / originalName / createdAt
  assert.equal(env.__insertedAudits.length, 1);
  const audit = env.__insertedAudits[0]?.args ?? [];
  assert.equal(audit[0], FAKE_USER_ID);
  assert.equal(audit[1], body.key);
  assert.equal(audit[2], body.url);
  assert.equal(audit[3], 'image/jpeg');
  assert.equal(audit[4], 64);
  assert.equal(audit[5], 'me.jpg');
  assert.equal(audit[6], body.createdAt);
});

test('GET /upload/photo/history 缺 Authorization → 401', async () => {
  const res = await app.request('/upload/photo/history', undefined, mockEnv(), ctx);
  assert.equal(res.status, 401);
});

test('GET /upload/photo/history 正常 → 200 + items', async () => {
  const history: PhotoRow[] = [
    {
      id: 2,
      r2Key: `${FAKE_USER_ID}/uuid2.jpg`,
      url: `https://i.muicv.com/${FAKE_USER_ID}/uuid2.jpg`,
      contentType: 'image/jpeg',
      sizeBytes: 100,
      originalName: 'b.jpg',
      createdAt: Date.now(),
    },
    {
      id: 1,
      r2Key: `${FAKE_USER_ID}/uuid1.png`,
      url: `https://i.muicv.com/${FAKE_USER_ID}/uuid1.png`,
      contentType: 'image/png',
      sizeBytes: 80,
      originalName: 'a.png',
      createdAt: Date.now() - 1000,
    },
  ];
  const res = await app.request('/upload/photo/history', { headers: AUTH }, mockEnv({ history }), ctx);
  assert.equal(res.status, 200);
  const body = (await res.json()) as { items: PhotoRow[] };
  assert.equal(body.items.length, 2);
  assert.equal(body.items[0]?.url, history[0]?.url);
});
