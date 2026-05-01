import { MuirouterOauthError, refreshAccessToken } from '@muicv/shared';

import { decryptToken, encryptToken } from './crypto.ts';

/**
 * Worker 端 muirouter OAuth token 管理：根据 D1 行判断是否要刷新，
 * 必要时调 muirouter `/oauth/token`，把新 token 加密写回 D1。
 *
 * 与 packages/website/lib/muirouter-token.ts 行为一致——区别只是 worker 用 raw D1
 * prepare 而不是 drizzle。
 */

const REFRESH_LEEWAY_MS = 60 * 1000;

const DEFAULT_TOKEN_URL = 'https://api.muirouter.com/oauth/token';

export type MuirouterEnv = {
  MUICV_API_DB: D1Database;
  BETTER_AUTH_SECRET: string;
  MUIROUTER_OAUTH_CLIENT_SECRET: string;
  MUIROUTER_OAUTH_TOKEN_URL?: string;
  MUIROUTER_OAUTH_CLIENT_ID?: string;
};

type LinkRow = {
  accessTokenCipher: string;
  accessTokenIv: string;
  refreshTokenCipher: string;
  refreshTokenIv: string;
  tokenExpiresAt: number;
  defaultModel: string;
};

export type MuirouterUpstreamCreds = {
  accessToken: string;
  defaultModel: string;
};

const SELECT_LINK_SQL = `SELECT accessTokenCipher, accessTokenIv, refreshTokenCipher, refreshTokenIv,
  tokenExpiresAt, defaultModel FROM muirouterLink WHERE userId = ? LIMIT 1`;

const UPDATE_TOKEN_SQL = `UPDATE muirouterLink
  SET accessTokenCipher = ?, accessTokenIv = ?, refreshTokenCipher = ?, refreshTokenIv = ?,
      tokenExpiresAt = ?, scope = ?
  WHERE userId = ?`;

const DELETE_LINK_SQL = `DELETE FROM muirouterLink WHERE userId = ?`;

export async function getMuirouterUpstreamCreds(
  env: MuirouterEnv,
  userId: string,
): Promise<MuirouterUpstreamCreds | null> {
  const row = await env.MUICV_API_DB.prepare(SELECT_LINK_SQL).bind(userId).first<LinkRow | null>();
  if (!row) return null;

  const now = Date.now();
  if (row.tokenExpiresAt - REFRESH_LEEWAY_MS > now) {
    const accessToken = await decryptToken(env.BETTER_AUTH_SECRET, row.accessTokenCipher, row.accessTokenIv);
    return { accessToken, defaultModel: row.defaultModel };
  }

  const refreshTokenPlain = await decryptToken(env.BETTER_AUTH_SECRET, row.refreshTokenCipher, row.refreshTokenIv);
  let token;
  try {
    token = await refreshAccessToken({
      endpoints: { tokenUrl: env.MUIROUTER_OAUTH_TOKEN_URL ?? DEFAULT_TOKEN_URL },
      client: { clientId: env.MUIROUTER_OAUTH_CLIENT_ID ?? 'muicv', clientSecret: env.MUIROUTER_OAUTH_CLIENT_SECRET },
      refreshToken: refreshTokenPlain,
      now,
    });
  } catch (err) {
    if (err instanceof MuirouterOauthError && (err.status === 400 || err.status === 401)) {
      // refresh_token 也失效了，清掉绑定逼用户重新走 OAuth
      await env.MUICV_API_DB.prepare(DELETE_LINK_SQL).bind(userId).run();
    }
    throw err;
  }

  const [accessEnc, refreshEnc] = await Promise.all([
    encryptToken(env.BETTER_AUTH_SECRET, token.accessToken),
    encryptToken(env.BETTER_AUTH_SECRET, token.refreshToken),
  ]);
  await env.MUICV_API_DB.prepare(UPDATE_TOKEN_SQL)
    .bind(accessEnc.cipher, accessEnc.iv, refreshEnc.cipher, refreshEnc.iv, token.tokenExpiresAt, token.scope, userId)
    .run();

  return { accessToken: token.accessToken, defaultModel: row.defaultModel };
}
