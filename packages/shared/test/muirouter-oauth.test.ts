import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  generateOauthState,
  MuirouterOauthError,
  refreshAccessToken,
  revokeToken,
} from '../src/muirouter-oauth.ts';

const ENDPOINTS = {
  authorizeUrl: 'https://muirouter.com/oauth/authorize',
  tokenUrl: 'https://api.muirouter.com/oauth/token',
  revokeUrl: 'https://api.muirouter.com/oauth/revoke',
};

const CLIENT = { clientId: 'muicv', clientSecret: 'sek-test' };

function withMockFetch<T>(handler: (req: Request) => Promise<Response> | Response, run: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = input instanceof Request ? input : new Request(input.toString(), init);
    return handler(req);
  };
  return run().finally(() => {
    globalThis.fetch = original;
  });
}

test('buildAuthorizeUrl 拼参数完整且 url-safe', () => {
  const url = buildAuthorizeUrl({
    endpoints: ENDPOINTS,
    clientId: 'muicv',
    redirectUri: 'https://muicv.com/api/muirouter/oauth/callback',
    state: 'abc123',
  });
  const parsed = new URL(url);
  assert.equal(parsed.origin + parsed.pathname, 'https://muirouter.com/oauth/authorize');
  assert.equal(parsed.searchParams.get('client_id'), 'muicv');
  assert.equal(parsed.searchParams.get('redirect_uri'), 'https://muicv.com/api/muirouter/oauth/callback');
  assert.equal(parsed.searchParams.get('state'), 'abc123');
  assert.equal(parsed.searchParams.get('scope'), 'balance,llm');
  assert.equal(parsed.searchParams.get('response_type'), 'code');
});

test('exchangeCodeForToken 正常解析响应', async () => {
  await withMockFetch(
    async (req) => {
      assert.equal(req.url, ENDPOINTS.tokenUrl);
      const body = (await req.json()) as Record<string, string>;
      assert.equal(body.grant_type, 'authorization_code');
      assert.equal(body.code, 'CODE_X');
      assert.equal(body.client_secret, 'sek-test');
      return new Response(
        JSON.stringify({
          access_token: 'mr_at_aaa',
          refresh_token: 'mr_rt_bbb',
          expires_in: 1800,
          scope: 'balance,llm',
          user: { id: 'u_1', email: 'a@b.com', username: 'alice' },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    },
    async () => {
      const tok = await exchangeCodeForToken({
        endpoints: ENDPOINTS,
        client: CLIENT,
        code: 'CODE_X',
        redirectUri: 'https://muicv.com/api/muirouter/oauth/callback',
        now: 1_700_000_000_000,
      });
      assert.equal(tok.accessToken, 'mr_at_aaa');
      assert.equal(tok.refreshToken, 'mr_rt_bbb');
      assert.equal(tok.tokenExpiresAt, 1_700_000_000_000 + 1800 * 1000);
      assert.equal(tok.scope, 'balance,llm');
      assert.deepEqual(tok.user, { id: 'u_1', email: 'a@b.com', username: 'alice' });
    },
  );
});

test('exchangeCodeForToken 上游 4xx 抛 MuirouterOauthError 带 code', async () => {
  await withMockFetch(
    () =>
      new Response(JSON.stringify({ error: 'invalid_grant', error_description: 'code expired' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    async () => {
      await assert.rejects(
        exchangeCodeForToken({
          endpoints: ENDPOINTS,
          client: CLIENT,
          code: 'X',
          redirectUri: 'https://muicv.com/api/muirouter/oauth/callback',
        }),
        (err: unknown) => {
          assert.ok(err instanceof MuirouterOauthError);
          assert.equal(err.code, 'invalid_grant');
          assert.equal(err.status, 400);
          return true;
        },
      );
    },
  );
});

test('refreshAccessToken 同样解析新 token', async () => {
  await withMockFetch(
    async (req) => {
      const body = (await req.json()) as Record<string, string>;
      assert.equal(body.grant_type, 'refresh_token');
      assert.equal(body.refresh_token, 'mr_rt_old');
      return new Response(
        JSON.stringify({
          access_token: 'mr_at_new',
          refresh_token: 'mr_rt_new',
          expires_in: 3600,
          scope: 'balance,llm',
          user: { id: 'u_1' },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    },
    async () => {
      const tok = await refreshAccessToken({
        endpoints: ENDPOINTS,
        client: CLIENT,
        refreshToken: 'mr_rt_old',
        now: 1_700_000_000_000,
      });
      assert.equal(tok.accessToken, 'mr_at_new');
      assert.equal(tok.refreshToken, 'mr_rt_new');
      assert.equal(tok.tokenExpiresAt, 1_700_000_000_000 + 3600 * 1000);
    },
  );
});

test('revokeToken 即使上游报错也不抛错', async () => {
  await withMockFetch(
    () => new Response('boom', { status: 500 }),
    async () => {
      await revokeToken({ endpoints: ENDPOINTS, client: CLIENT, token: 'mr_at_x' });
    },
  );
});

test('exchangeCodeForToken 网络错误抛 network code', async () => {
  await withMockFetch(
    () => {
      throw new Error('econnrefused');
    },
    async () => {
      await assert.rejects(
        exchangeCodeForToken({
          endpoints: ENDPOINTS,
          client: CLIENT,
          code: 'X',
          redirectUri: 'https://muicv.com/cb',
        }),
        (err: unknown) => {
          assert.ok(err instanceof MuirouterOauthError);
          assert.equal(err.code, 'network');
          assert.equal(err.status, 502);
          return true;
        },
      );
    },
  );
});

test('exchangeCodeForToken 缺 user.id 抛 invalid-token-response', async () => {
  await withMockFetch(
    () =>
      new Response(
        JSON.stringify({
          access_token: 'a',
          refresh_token: 'r',
          expires_in: 60,
          user: null,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    async () => {
      await assert.rejects(
        exchangeCodeForToken({
          endpoints: ENDPOINTS,
          client: CLIENT,
          code: 'X',
          redirectUri: 'https://muicv.com/cb',
        }),
        (err: unknown) => {
          assert.ok(err instanceof MuirouterOauthError);
          assert.equal(err.code, 'invalid-token-response');
          return true;
        },
      );
    },
  );
});

test('generateOauthState 16 字节 hex', () => {
  const a = generateOauthState();
  const b = generateOauthState();
  assert.equal(a.length, 32);
  assert.match(a, /^[0-9a-f]{32}$/);
  assert.notEqual(a, b);
});
