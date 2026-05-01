-- muirouter 关联从「粘贴 sk-gw key」改为 OAuth 流程。
-- 改动：删除 keyCipher / keyIv / keyPreview；新增 access_token / refresh_token / scope /
-- muirouterUserId / muirouterEmail / defaultModel。
-- 没有已绑定用户，直接 DROP + 重建。

DROP TABLE IF EXISTS muirouterLink;

CREATE TABLE muirouterLink (
  userId TEXT PRIMARY KEY,
  accessTokenCipher TEXT NOT NULL,
  accessTokenIv TEXT NOT NULL,
  refreshTokenCipher TEXT NOT NULL,
  refreshTokenIv TEXT NOT NULL,
  tokenExpiresAt INTEGER NOT NULL,
  scope TEXT,
  muirouterUserId TEXT NOT NULL,
  muirouterEmail TEXT,
  defaultModel TEXT NOT NULL DEFAULT 'mimo',
  currency TEXT,
  balanceCents INTEGER,
  lifetimeToppedUpCents INTEGER,
  lifetimeSpentCents INTEGER,
  balanceUpdatedAt INTEGER,
  lastError TEXT,
  linkedAt INTEGER NOT NULL,
  FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
);
