-- 早期兴趣用户的 waitlist 表。
-- POST /waitlist 写入，email 唯一避免重复，source 记录从哪块 UI 触发。
-- ip_hash 存哈希值（SHA-256）做粗暴防刷/防广告，不存原 IP。

CREATE TABLE waitlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  source TEXT,
  referrer TEXT,
  user_agent TEXT,
  ip_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
  UNIQUE (email)
);

CREATE INDEX idx_waitlist_created ON waitlist (created_at DESC);
