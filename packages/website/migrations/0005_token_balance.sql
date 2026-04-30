-- Token 钱包：每用户一行余额，永不过期。
-- balance / lifetimeEarned / lifetimeSpent 都是单 statement 原子加减，
-- 见 packages/website/lib/wallet.ts 和 packages/api/src/lib/wallet.ts。
-- 注册赠送（10K）走 lazy init：第一次读这张表行不存在就 INSERT OR IGNORE。

CREATE TABLE IF NOT EXISTS tokenBalance (
  userId TEXT PRIMARY KEY,
  balance INTEGER NOT NULL DEFAULT 0,
  lifetimeEarned INTEGER NOT NULL DEFAULT 0,
  lifetimeSpent INTEGER NOT NULL DEFAULT 0,
  updatedAt INTEGER NOT NULL,
  FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
);
