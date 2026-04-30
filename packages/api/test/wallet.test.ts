import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

import { charge, credit, ensureBalance, readBalance } from '../src/lib/wallet.ts';

/**
 * D1Database mock：基于 node:sqlite in-memory 包出 prepare/bind/first/run/all/batch
 * 接口。这样能跑真实的 SQL 语义（INSERT…ON CONFLICT…RETURNING、UPDATE…RETURNING、
 * page-level mutex），不依赖 wrangler / miniflare。
 */
function setupDb() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE tokenBalance (
      userId TEXT PRIMARY KEY,
      balance INTEGER NOT NULL DEFAULT 0,
      lifetimeEarned INTEGER NOT NULL DEFAULT 0,
      lifetimeSpent INTEGER NOT NULL DEFAULT 0,
      updatedAt INTEGER NOT NULL
    );
    CREATE TABLE tokenLedger (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      delta INTEGER NOT NULL,
      type TEXT NOT NULL,
      meta TEXT,
      createdAt INTEGER NOT NULL
    );
  `);

  function makeStmt(sql: string) {
    const compiled = sqlite.prepare(sql);
    let bound: unknown[] = [];
    const stmt = {
      bind(...args: unknown[]) {
        bound = args;
        return stmt;
      },
      async first<T = unknown>(): Promise<T | null> {
        const row = compiled.get(...(bound as never[]));
        return (row ?? null) as T | null;
      },
      async run() {
        const info = compiled.run(...(bound as never[]));
        return {
          success: true,
          meta: { changes: info.changes, last_row_id: Number(info.lastInsertRowid) },
        };
      },
      async all<T = unknown>() {
        const rows = compiled.all(...(bound as never[]));
        return { success: true, results: rows as T[], meta: {} };
      },
    };
    return stmt;
  }

  const db = {
    prepare(sql: string) {
      return makeStmt(sql);
    },
    async batch(stmts: ReturnType<typeof makeStmt>[]) {
      const out = [];
      for (const s of stmts) out.push(await s.run());
      return out;
    },
  } as unknown as D1Database;

  return { MUICV_API_DB: db };
}

test('ensureBalance 第一次 lazy init signup_bonus + ledger 一条', async () => {
  const env = setupDb();
  const r = await ensureBalance(env, 'u1', 10000);
  assert.equal(r.balance, 10000);
  assert.equal(r.justInitialized, true);

  const cur = await readBalance(env, 'u1');
  assert.equal(cur?.balance, 10000);
  assert.equal(cur?.lifetimeEarned, 10000);
  assert.equal(cur?.lifetimeSpent, 0);

  // ledger 应该有一条 signup_bonus
  const ledger = await env.MUICV_API_DB.prepare('SELECT type, delta FROM tokenLedger WHERE userId = ? AND type = ?')
    .bind('u1', 'signup_bonus')
    .first<{ type: string; delta: number }>();
  assert.equal(ledger?.type, 'signup_bonus');
  assert.equal(ledger?.delta, 10000);
});

test('ensureBalance 第二次不重复发 bonus', async () => {
  const env = setupDb();
  await ensureBalance(env, 'u1', 10000);
  const r = await ensureBalance(env, 'u1', 10000);
  assert.equal(r.balance, 10000);
  assert.equal(r.justInitialized, false);

  const cur = await readBalance(env, 'u1');
  assert.equal(cur?.lifetimeEarned, 10000); // 没翻倍
});

test('charge 余额够 → 扣减成功 + ledger -delta', async () => {
  const env = setupDb();
  await ensureBalance(env, 'u1', 100);
  const r = await charge(env, 'u1', 60, 'llm', { model: 'gpt-test' });
  assert.equal(r.ok, true);
  assert.equal(r.balance, 40);

  const cur = await readBalance(env, 'u1');
  assert.equal(cur?.balance, 40);
  assert.equal(cur?.lifetimeEarned, 100);
  assert.equal(cur?.lifetimeSpent, 60);

  const llmRow = await env.MUICV_API_DB.prepare("SELECT delta, meta FROM tokenLedger WHERE userId = ? AND type = 'llm'")
    .bind('u1')
    .first<{ delta: number; meta: string }>();
  assert.equal(llmRow?.delta, -60);
  const meta = JSON.parse(llmRow?.meta ?? 'null');
  assert.equal(meta.model, 'gpt-test');
});

test('charge 余额不足 → ok=false 余额不变', async () => {
  const env = setupDb();
  await ensureBalance(env, 'u1', 100);
  const r = await charge(env, 'u1', 200, 'llm');
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, 'insufficient_balance');
  assert.equal(r.balance, 100); // 余额未动
});

test('charge 用户不存在 → ok=false reason=no_user', async () => {
  const env = setupDb();
  const r = await charge(env, 'ghost', 50, 'llm');
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, 'no_user');
});

test('credit 入账：行不存在自动建', async () => {
  const env = setupDb();
  const r = await credit(env, 'u1', 100000, 'subscription', { invoice: 'inv_x' });
  assert.equal(r.balance, 100000);
  assert.equal(r.deduped, false);
});

test('credit 幂等：同 ledgerId 重发不翻倍', async () => {
  const env = setupDb();
  await ensureBalance(env, 'u1', 0);
  const r1 = await credit(env, 'u1', 500, 'subscription', { invoiceId: 'inv_001' }, 'inv_001');
  assert.equal(r1.balance, 500);
  assert.equal(r1.deduped, false);

  const r2 = await credit(env, 'u1', 500, 'subscription', { invoiceId: 'inv_001' }, 'inv_001');
  assert.equal(r2.balance, 500); // 没翻倍
  assert.equal(r2.deduped, true);
});
