-- 把 OAuth token 的存储外包给 hsm.meathill.com（信封加密 + 客户端密钥分离）。
-- muicv 仓库不再持有任何密钥派生 / 解密代码。
--
-- D1 上只留非敏感元数据：过期时间、scope、muirouter 用户邮箱、模型偏好、余额快照。
-- access_token / refresh_token 走 hsmPut/hsmGet/hsmDelete，path = muicv/muirouter/<userId>。
--
-- 0010 上已绑定的用户的 token 留在表里也读不出来（HSM 没存），重新走一次 OAuth 即可。
-- 当前线上只有一个绑定（开发自测），直接 DROP+重建最干净。

DROP TABLE IF EXISTS muirouterLink;

CREATE TABLE muirouterLink (
  userId TEXT PRIMARY KEY,
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
