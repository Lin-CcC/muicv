/**
 * Better Auth 标准 4 表的 Drizzle schema。
 *
 * 列名与 Better Auth 默认完全对齐（camelCase）；类型映射：
 *   - createdAt / updatedAt / *expiresAt：integer mode 'timestamp_ms'，
 *     Drizzle 自动 Date <-> ms 互转
 *   - emailVerified：integer mode 'boolean'，0/1 自动 ↔ false/true
 *
 * SQL 表本身已由 migrations/0002_better_auth.sql 创建（运行时不会再 CREATE）。
 * 这份 schema 只作为 Better Auth Drizzle adapter 的查询元数据使用。
 */
import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('emailVerified', { mode: 'boolean' }).notNull(),
  image: text('image'),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).notNull(),
});

export const session = sqliteTable('session', {
  id: text('id').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: integer('expiresAt', { mode: 'timestamp_ms' }).notNull(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).notNull(),
});

export const account = sqliteTable(
  'account',
  {
    id: text('id').primaryKey(),
    userId: text('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accountId: text('accountId').notNull(),
    providerId: text('providerId').notNull(),
    accessToken: text('accessToken'),
    refreshToken: text('refreshToken'),
    accessTokenExpiresAt: integer('accessTokenExpiresAt', { mode: 'timestamp_ms' }),
    refreshTokenExpiresAt: integer('refreshTokenExpiresAt', { mode: 'timestamp_ms' }),
    scope: text('scope'),
    idToken: text('idToken'),
    password: text('password'),
    createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [uniqueIndex('idx_account_provider').on(t.providerId, t.accountId)],
);

export const verification = sqliteTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expiresAt', { mode: 'timestamp_ms' }).notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).notNull(),
});

/**
 * API keys —— 给 skill / electron app 用。不存原文，只存 sha256(key)；
 * 撤销走软删（revokedAt 非空 = 已撤销）。
 */
export const apiKey = sqliteTable('apiKey', {
  id: text('id').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  keyHash: text('keyHash').notNull().unique(),
  keyPreview: text('keyPreview').notNull(),
  lastUsedAt: integer('lastUsedAt', { mode: 'timestamp_ms' }),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(),
  revokedAt: integer('revokedAt', { mode: 'timestamp_ms' }),
});

/**
 * muirouter BYOK 关联（每用户最多一条）。
 * 用户在 muirouter 自己生成 API key，在 muicv dashboard 粘贴进来。
 * key 走 AES-GCM 加密存储（lib/crypto.ts），原文 muicv 永远不再持有。
 * balance 等字段是上次成功 fetch 的快照，避免每次 dashboard 刷新都打 muirouter。
 */
export const muirouterLink = sqliteTable('muirouterLink', {
  userId: text('userId')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  keyCipher: text('keyCipher').notNull(),
  keyIv: text('keyIv').notNull(),
  keyPreview: text('keyPreview').notNull(),
  currency: text('currency'),
  balanceCents: integer('balanceCents'),
  lifetimeToppedUpCents: integer('lifetimeToppedUpCents'),
  lifetimeSpentCents: integer('lifetimeSpentCents'),
  balanceUpdatedAt: integer('balanceUpdatedAt', { mode: 'timestamp_ms' }),
  lastError: text('lastError'),
  linkedAt: integer('linkedAt', { mode: 'timestamp_ms' }).notNull(),
});
