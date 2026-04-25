-- muirouter 账号关联：每个 muicv 用户最多一条记录。
-- keyCipher 是 AES-GCM 加密后的 muirouter API key（base64），keyIv 是 IV（base64）。
-- 解密 key = HKDF(BETTER_AUTH_SECRET) —— 见 lib/crypto.ts。
-- balance / 消费等是上次成功调 muirouter 时的快照，dashboard 默认看缓存，
-- 用户点"刷新"才重打。

CREATE TABLE IF NOT EXISTS muirouterLink (
  userId TEXT PRIMARY KEY,
  keyCipher TEXT NOT NULL,
  keyIv TEXT NOT NULL,
  keyPreview TEXT NOT NULL,
  currency TEXT,
  balanceCents INTEGER,
  lifetimeToppedUpCents INTEGER,
  lifetimeSpentCents INTEGER,
  balanceUpdatedAt INTEGER,
  lastError TEXT,
  linkedAt INTEGER NOT NULL,
  FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
);
