-- Stripe webhook 幂等表：Stripe at-least-once 重发，靠 evt_xxx 去重。
-- handler 入口先 INSERT OR IGNORE，changes()=0 说明已处理过，直接返回 200。

CREATE TABLE IF NOT EXISTS stripeEvent (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  receivedAt INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stripeEvent_type ON stripeEvent (type);
