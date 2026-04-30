-- Token 流水：所有 balance 变化的审计日志。
-- delta 正负：正 = 入账（signup_bonus / subscription / topup / admin_grant）
--             负 = 出账（llm / pdf_render / jd_fetch / admin_deduct）
-- meta JSON：根据 type 不同字段：
--   llm: { model, promptTokens, completionTokens, ratio }
--   pdf_render / jd_fetch: { url? }
--   subscription: { invoiceId, periodStart, periodEnd }
--   topup: { sessionId, pack }
--   signup_bonus: {}
-- invoice.paid 第二层幂等靠 meta->>'invoiceId' 查询防重复入账。

CREATE TABLE IF NOT EXISTS tokenLedger (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  delta INTEGER NOT NULL,
  type TEXT NOT NULL,
  meta TEXT,
  createdAt INTEGER NOT NULL,
  FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tokenLedger_userId_createdAt ON tokenLedger (userId, createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_tokenLedger_type ON tokenLedger (type);
