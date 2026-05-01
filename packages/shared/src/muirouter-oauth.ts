/**
 * muirouter OAuth 客户端纯逻辑——拼 authorize URL、用 code 换 token、刷新、撤销。
 * 不读 env 不依赖运行时，调用方传 endpoint + client 凭证。
 *
 * 协议参考（muirouter 端实现，与本仓库同步演进）：
 *   GET  https://muirouter.com/oauth/authorize
 *   POST https://api.muirouter.com/oauth/token
 *   POST https://api.muirouter.com/oauth/revoke
 */

export type OauthEndpoints = {
  authorizeUrl: string;
  tokenUrl: string;
  revokeUrl: string;
};

export type OauthClient = {
  clientId: string;
  clientSecret: string;
};

export type TokenResponse = {
  accessToken: string;
  refreshToken: string;
  /** access_token 过期时间（绝对时间戳，毫秒）。muirouter 返回 expires_in（秒），调用方在收到时换算。 */
  tokenExpiresAt: number;
  scope: string | null;
  user: {
    id: string;
    email: string | null;
    username: string | null;
  };
};

export type AuthorizeUrlInput = {
  endpoints: Pick<OauthEndpoints, 'authorizeUrl'>;
  clientId: string;
  redirectUri: string;
  state: string;
  scope?: string;
};

export function buildAuthorizeUrl(input: AuthorizeUrlInput): string {
  const u = new URL(input.endpoints.authorizeUrl);
  u.searchParams.set('client_id', input.clientId);
  u.searchParams.set('redirect_uri', input.redirectUri);
  u.searchParams.set('state', input.state);
  u.searchParams.set('scope', input.scope ?? 'balance,llm');
  u.searchParams.set('response_type', 'code');
  return u.toString();
}

type RawTokenResponse = {
  access_token?: unknown;
  refresh_token?: unknown;
  expires_in?: unknown;
  scope?: unknown;
  user?: { id?: unknown; email?: unknown; username?: unknown } | null;
  error?: unknown;
  error_description?: unknown;
};

export class MuirouterOauthError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(code: string, message: string, status = 500) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function parseTokenResponse(raw: RawTokenResponse, now: number): TokenResponse {
  if (typeof raw.access_token !== 'string' || raw.access_token.length === 0) {
    throw new MuirouterOauthError('invalid-token-response', 'muirouter 未返回 access_token');
  }
  if (typeof raw.refresh_token !== 'string' || raw.refresh_token.length === 0) {
    throw new MuirouterOauthError('invalid-token-response', 'muirouter 未返回 refresh_token');
  }
  const expiresInSec = typeof raw.expires_in === 'number' && raw.expires_in > 0 ? raw.expires_in : 3600;
  const userRaw = raw.user ?? null;
  return {
    accessToken: raw.access_token,
    refreshToken: raw.refresh_token,
    tokenExpiresAt: now + expiresInSec * 1000,
    scope: typeof raw.scope === 'string' ? raw.scope : null,
    user: {
      id: typeof userRaw?.id === 'string' ? userRaw.id : '',
      email: typeof userRaw?.email === 'string' ? userRaw.email : null,
      username: typeof userRaw?.username === 'string' ? userRaw.username : null,
    },
  };
}

async function postTokenEndpoint(url: string, body: Record<string, string>, now: number): Promise<TokenResponse> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new MuirouterOauthError(
      'network',
      `muirouter token 端点网络错误：${err instanceof Error ? err.message : String(err)}`,
      502,
    );
  }
  const text = await res.text();
  let parsed: RawTokenResponse;
  try {
    parsed = JSON.parse(text) as RawTokenResponse;
  } catch {
    throw new MuirouterOauthError(
      'invalid-json',
      `muirouter ${res.status} 响应不是合法 JSON：${text.slice(0, 200)}`,
      502,
    );
  }
  if (!res.ok) {
    const code = typeof parsed.error === 'string' ? parsed.error : 'token-exchange-failed';
    const desc = typeof parsed.error_description === 'string' ? parsed.error_description : `HTTP ${res.status}`;
    throw new MuirouterOauthError(code, desc, res.status);
  }
  if (parsed.user?.id == null) {
    throw new MuirouterOauthError('invalid-token-response', 'muirouter 未返回 user.id');
  }
  return parseTokenResponse(parsed, now);
}

export type ExchangeCodeInput = {
  endpoints: Pick<OauthEndpoints, 'tokenUrl'>;
  client: OauthClient;
  code: string;
  redirectUri: string;
  /** 注入当前时间（ms），便于测试。默认 Date.now()。 */
  now?: number;
};

export function exchangeCodeForToken(input: ExchangeCodeInput): Promise<TokenResponse> {
  return postTokenEndpoint(
    input.endpoints.tokenUrl,
    {
      grant_type: 'authorization_code',
      code: input.code,
      redirect_uri: input.redirectUri,
      client_id: input.client.clientId,
      client_secret: input.client.clientSecret,
    },
    input.now ?? Date.now(),
  );
}

export type RefreshTokenInput = {
  endpoints: Pick<OauthEndpoints, 'tokenUrl'>;
  client: OauthClient;
  refreshToken: string;
  now?: number;
};

export function refreshAccessToken(input: RefreshTokenInput): Promise<TokenResponse> {
  return postTokenEndpoint(
    input.endpoints.tokenUrl,
    {
      grant_type: 'refresh_token',
      refresh_token: input.refreshToken,
      client_id: input.client.clientId,
      client_secret: input.client.clientSecret,
    },
    input.now ?? Date.now(),
  );
}

export type RevokeTokenInput = {
  endpoints: Pick<OauthEndpoints, 'revokeUrl'>;
  client: OauthClient;
  token: string;
};

export async function revokeToken(input: RevokeTokenInput): Promise<void> {
  try {
    await fetch(input.endpoints.revokeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: input.token,
        client_id: input.client.clientId,
        client_secret: input.client.clientSecret,
      }),
    });
  } catch {
    // revoke 即使失败也不阻塞解绑（用户在 muirouter 端可手动撤销）
  }
}

/** 生成 OAuth state（CSRF token），128 bit 随机。 */
export function generateOauthState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let s = '';
  for (const b of bytes) s += b.toString(16).padStart(2, '0');
  return s;
}
