import assert from 'node:assert/strict';
import test from 'node:test';

import { CmsClient } from '../mcp/payload-client.ts';
import type { CmsPostPayload } from '../mcp/post-input.ts';

const payload: CmsPostPayload = {
  title: '测试文章',
  slug: 'test-post',
  section: 'jobs',
  status: 'draft',
  _status: 'draft',
  summary: '测试摘要',
  bodyMarkdown: '# 测试文章',
  tags: [],
  keywords: [],
  author: 'Mui简历',
  publishedAt: '2026-05-16',
  seoTitle: '测试文章',
  seoDescription: '测试摘要',
};

test('CmsClient 使用 bearer token 调 Payload API', async () => {
  const requests: Request[] = [];
  const client = new CmsClient({
    baseUrl: 'https://cms.example.com',
    token: 'token-123',
    fetchImpl: async (input, init) => {
      const request = new Request(input, init);
      requests.push(request);
      return Response.json({ docs: [{ id: 1, ...payload }] });
    },
  });

  const post = await client.findPostBySlug('test-post');

  assert.equal(post?.id, 1);
  assert.equal(requests[0]?.headers.get('Authorization'), 'Bearer token-123');
  assert.equal(
    requests[0]?.url,
    'https://cms.example.com/api/posts?depth=0&limit=1&where%5Bslug%5D%5Bequals%5D=test-post',
  );
});

test('CmsClient 可用邮箱密码登录并复用返回 token', async () => {
  const requests: Request[] = [];
  const client = new CmsClient({
    baseUrl: 'https://cms.example.com',
    token: '',
    email: 'editor@example.com',
    password: 'secret',
    fetchImpl: async (input, init) => {
      const request = new Request(input, init);
      requests.push(request);

      if (request.url.endsWith('/api/users/login')) {
        return Response.json({ token: 'login-token' });
      }

      return Response.json({ id: 2, ...payload });
    },
  });

  const post = await client.createPost(payload);

  assert.equal(post.id, 2);
  assert.equal(requests[0]?.url, 'https://cms.example.com/api/users/login');
  assert.deepEqual(await requests[0]?.json(), { email: 'editor@example.com', password: 'secret' });
  assert.equal(requests[1]?.headers.get('Authorization'), 'Bearer login-token');
  assert.equal(requests[1]?.method, 'POST');
  assert.equal(requests[1]?.headers.get('Content-Type'), 'application/json');
});
