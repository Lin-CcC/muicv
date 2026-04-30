-- Stripe 订阅状态承接表：每用户至多一条 active sub。
-- status 直接存 Stripe 原值（active / trialing / past_due / canceled / incomplete /
-- incomplete_expired / unpaid），UI 自己 map 成中文。
-- monthlyTokens 是订阅价位每月发放数量，从 priceIdToMonthlyTokens 反查后写入。
-- 注意 stripeSubscriptionId 允许 null：Stripe customer 可以早于 subscription 创建（用户
-- 点了升级但 checkout 还没付款），此时 stripeCustomerId 已写入但 subscriptionId 为空。
-- stripeCustomerId UNIQUE 防止同一 user 创出两个 customer 的脏数据。

CREATE TABLE IF NOT EXISTS subscription (
  userId TEXT PRIMARY KEY,
  stripeCustomerId TEXT NOT NULL UNIQUE,
  stripeSubscriptionId TEXT UNIQUE,
  stripePriceId TEXT,
  monthlyTokens INTEGER,
  status TEXT NOT NULL,
  currentPeriodStart INTEGER,
  currentPeriodEnd INTEGER,
  cancelAtPeriodEnd INTEGER NOT NULL DEFAULT 0,
  canceledAt INTEGER,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_subscription_status ON subscription (status);
