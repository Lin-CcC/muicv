import { eq } from 'drizzle-orm';
import { MuirouterOauthError, refreshAccessToken } from '@muicv/shared';

import { decryptSecret, encryptSecret } from './crypto';
import { getDb, schema } from './db';
import { getMuirouterOauthConfig } from './muirouter-config';

/**
 * 提前 60 秒视为过期，避免请求发出时刚好踩在边界上被 muirouter 拒。
 */
const REFRESH_LEEWAY_MS = 60 * 1000;

export type FreshAccessToken = {
  accessToken: string;
  expiresAt: Date;
  /** true：触发了 refresh 并已写回 D1。 */
  rotated: boolean;
};

/**
 * 给定 userId，返回有效 access_token。如果即将过期则自动用 refresh_token 续期并写回 D1。
 * 用户未绑定 muirouter 时返回 null（调用方决定是否报错）。
 */
export async function getFreshMuirouterAccessToken(userId: string): Promise<FreshAccessToken | null> {
  const db = await getDb();
  const row = (await db.select().from(schema.muirouterLink).where(eq(schema.muirouterLink.userId, userId)).limit(1))[0];
  if (!row) return null;

  const now = Date.now();
  if (row.tokenExpiresAt.getTime() - REFRESH_LEEWAY_MS > now) {
    const accessToken = await decryptSecret(row.accessTokenCipher, row.accessTokenIv);
    return { accessToken, expiresAt: row.tokenExpiresAt, rotated: false };
  }

  // 过期或将过期 → 用 refresh_token 换新
  const refreshToken = await decryptSecret(row.refreshTokenCipher, row.refreshTokenIv);
  const config = await getMuirouterOauthConfig();
  let token;
  try {
    token = await refreshAccessToken({
      endpoints: config.endpoints,
      client: config.client,
      refreshToken,
      now,
    });
  } catch (err) {
    if (err instanceof MuirouterOauthError && (err.status === 400 || err.status === 401)) {
      // refresh_token 也失效了——清掉绑定，让用户重新走 OAuth
      await db.delete(schema.muirouterLink).where(eq(schema.muirouterLink.userId, userId));
    }
    throw err;
  }

  const [accessEnc, refreshEnc] = await Promise.all([
    encryptSecret(token.accessToken),
    encryptSecret(token.refreshToken),
  ]);
  const expiresAt = new Date(token.tokenExpiresAt);
  await db
    .update(schema.muirouterLink)
    .set({
      accessTokenCipher: accessEnc.cipher,
      accessTokenIv: accessEnc.iv,
      refreshTokenCipher: refreshEnc.cipher,
      refreshTokenIv: refreshEnc.iv,
      tokenExpiresAt: expiresAt,
      scope: token.scope,
    })
    .where(eq(schema.muirouterLink.userId, userId));

  return { accessToken: token.accessToken, expiresAt, rotated: true };
}
