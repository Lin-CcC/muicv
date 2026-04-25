-- API keys for skill / electron app to call packages/api 时身份识别 + 限速。
-- 不存原始 key 文本，只存 sha256 hash；UI 上用 preview（前缀+尾4字符）展示。
-- 撤销用软删（revokedAt），不真删，便于审计。

CREATE TABLE IF NOT EXISTS apiKey (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  name TEXT NOT NULL,
  keyHash TEXT NOT NULL UNIQUE,
  keyPreview TEXT NOT NULL,
  lastUsedAt INTEGER,
  createdAt INTEGER NOT NULL,
  revokedAt INTEGER,
  FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_apiKey_userId ON apiKey (userId);
CREATE INDEX IF NOT EXISTS idx_apiKey_userId_active ON apiKey (userId) WHERE revokedAt IS NULL;
