import { displayToMicro, type LedgerType, SIGNUP_BONUS } from '@muicv/shared';
import { getCloudflareContext } from '@opennextjs/cloudflare';

/**
 * Token 钱包：原子扣账 / 入账 / 余额查询。
 *
 * **单位约定**：所有 `amount` / `balance` / `delta` 都是 **μtoken**（1 显示 token = 10_000 μtoken）。
 * 详见 packages/api/src/lib/wallet.ts 的 docstring。
 *
 * 镜像版本在 packages/api/src/lib/wallet.ts，函数签名一致，差别只在 D1 binding 名
 * （此处 `MUICV_DB`，api 那边 `MUICV_API_DB`，指向同一个 D1）。
 */

const SIGNUP_BONUS_MICRO = displayToMicro(SIGNUP_BONUS);

async function getDb(): Promise<D1Database> {
  const { env } = await getCloudflareContext({ async: true });
  return env.MUICV_DB;
}

export type ChargeResult =
  | { ok: true; balance: number }
  | { ok: false; balance: number; reason: 'insufficient_balance' | 'no_user' };

export type CreditMeta = Record<string, unknown>;

export async function readBalance(
  userId: string,
): Promise<{ balance: number; lifetimeEarned: number; lifetimeSpent: number } | null> {
  const db = await getDb();
  return await db
    .prepare('SELECT balance, lifetimeEarned, lifetimeSpent FROM tokenBalance WHERE userId = ? LIMIT 1')
    .bind(userId)
    .first<{ balance: number; lifetimeEarned: number; lifetimeSpent: number }>();
}

export async function ensureBalance(
  userId: string,
  bonus = SIGNUP_BONUS_MICRO,
): Promise<{ balance: number; justInitialized: boolean }> {
  const db = await getDb();
  const now = Date.now();
  const inserted = await db
    .prepare(
      `INSERT INTO tokenBalance (userId, balance, lifetimeEarned, lifetimeSpent, updatedAt)
       VALUES (?, ?, ?, 0, ?)
       ON CONFLICT(userId) DO NOTHING
       RETURNING balance`,
    )
    .bind(userId, bonus, bonus, now)
    .first<{ balance: number }>();

  if (inserted) {
    await db
      .prepare(
        `INSERT INTO tokenLedger (id, userId, delta, type, meta, createdAt)
         VALUES (?, ?, ?, 'signup_bonus', NULL, ?)`,
      )
      .bind(crypto.randomUUID(), userId, bonus, now)
      .run()
      .catch(() => {});
    return { balance: inserted.balance, justInitialized: true };
  }

  const existing = await readBalance(userId);
  return { balance: existing?.balance ?? 0, justInitialized: false };
}

export async function charge(
  userId: string,
  amount: number,
  type: LedgerType,
  meta?: CreditMeta,
): Promise<ChargeResult> {
  if (amount <= 0) {
    const cur = await readBalance(userId);
    return { ok: true, balance: cur?.balance ?? 0 };
  }

  const db = await getDb();
  const now = Date.now();
  const updated = await db
    .prepare(
      `UPDATE tokenBalance
         SET balance = balance - ?,
             lifetimeSpent = lifetimeSpent + ?,
             updatedAt = ?
       WHERE userId = ? AND balance >= ?
       RETURNING balance`,
    )
    .bind(amount, amount, now, userId, amount)
    .first<{ balance: number }>();

  if (!updated) {
    const existing = await readBalance(userId);
    if (!existing) return { ok: false, balance: 0, reason: 'no_user' };
    return { ok: false, balance: existing.balance, reason: 'insufficient_balance' };
  }

  await db
    .prepare(
      `INSERT INTO tokenLedger (id, userId, delta, type, meta, createdAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(crypto.randomUUID(), userId, -amount, type, meta ? JSON.stringify(meta) : null, now)
    .run()
    .catch(() => {});

  return { ok: true, balance: updated.balance };
}

export async function credit(
  userId: string,
  amount: number,
  type: LedgerType,
  meta?: CreditMeta,
  ledgerId?: string,
): Promise<{ balance: number; deduped: boolean }> {
  if (amount <= 0) {
    const cur = await readBalance(userId);
    return { balance: cur?.balance ?? 0, deduped: false };
  }

  const db = await getDb();
  const id = ledgerId ?? crypto.randomUUID();
  const now = Date.now();

  if (ledgerId) {
    const dup = await db.prepare('SELECT 1 FROM tokenLedger WHERE id = ? LIMIT 1').bind(ledgerId).first();
    if (dup) {
      const cur = await readBalance(userId);
      return { balance: cur?.balance ?? 0, deduped: true };
    }
  }

  await db.batch([
    db
      .prepare(
        `INSERT INTO tokenBalance (userId, balance, lifetimeEarned, lifetimeSpent, updatedAt)
         VALUES (?, ?, ?, 0, ?)
         ON CONFLICT(userId) DO UPDATE SET
           balance = balance + excluded.balance,
           lifetimeEarned = lifetimeEarned + excluded.lifetimeEarned,
           updatedAt = excluded.updatedAt`,
      )
      .bind(userId, amount, amount, now),
    db
      .prepare(
        `INSERT INTO tokenLedger (id, userId, delta, type, meta, createdAt)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(id, userId, amount, type, meta ? JSON.stringify(meta) : null, now),
  ]);

  const cur = await readBalance(userId);
  return { balance: cur?.balance ?? 0, deduped: false };
}

export type ListLedgerOptions = {
  limit?: number;
  offset?: number;
  order?: 'asc' | 'desc';
  type?: string;
};

/**
 * 列流水。支持分页、排序、按 type 过滤。
 *
 * - dashboard 调用：`listLedger(userId, { limit: 15 })`
 * - admin 详情页：`listLedger(userId, { limit, offset, order, type })`
 */
export async function listLedger(
  userId: string,
  options: ListLedgerOptions = {},
): Promise<Array<{ id: string; delta: number; type: string; meta: string | null; createdAt: number }>> {
  const limit = options.limit ?? 20;
  const offset = options.offset ?? 0;
  const order = options.order === 'asc' ? 'ASC' : 'DESC';
  const db = await getDb();
  const sql = options.type
    ? `SELECT id, delta, type, meta, createdAt
         FROM tokenLedger
        WHERE userId = ?1 AND type = ?2
        ORDER BY createdAt ${order}
        LIMIT ?3 OFFSET ?4`
    : `SELECT id, delta, type, meta, createdAt
         FROM tokenLedger
        WHERE userId = ?1
        ORDER BY createdAt ${order}
        LIMIT ?2 OFFSET ?3`;
  const stmt = options.type
    ? db.prepare(sql).bind(userId, options.type, limit, offset)
    : db.prepare(sql).bind(userId, limit, offset);
  const result = await stmt.all<{ id: string; delta: number; type: string; meta: string | null; createdAt: number }>();
  return result.results ?? [];
}
