import assert from 'node:assert/strict';
import test from 'node:test';

import { CmsClient } from '../mcp/payload-client.ts';
import type { CmsPostPayload } from '../mcp/post-input.ts';
import type { CmsSkillPayload } from '../mcp/skill-input.ts';

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

const skillPayload: CmsSkillPayload = {
  title: '腾讯校园招聘 Skill',
  slug: 'tencent-campus-recruiting',
  status: 'draft',
  _status: 'draft',
  publisher: '腾讯招聘',
  publisherType: 'official',
  distributionMode: 'hosted',
  appAvailability: 'installable',
  summary: '测试摘要',
  bodyMarkdown: '# Skill',
  useCases: [],
  tags: [],
  keywords: [],
  publishedAt: '2026-05-16',
  seoTitle: '腾讯校园招聘 Skill',
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

test('CmsClient 使用 Payload 用户 API Key 调 Payload API', async () => {
  const requests: Request[] = [];
  const client = new CmsClient({
    baseUrl: 'https://cms.example.com',
    apiKey: 'payload-api-key',
    fetchImpl: async (input, init) => {
      const request = new Request(input, init);
      requests.push(request);
      return Response.json({ docs: [{ id: 1, ...payload }] });
    },
  });

  const post = await client.findPostBySlug('test-post');

  assert.equal(post?.id, 1);
  assert.equal(requests[0]?.headers.get('Authorization'), 'users API-Key payload-api-key');
});

test('CmsClient 可读写 skillExtensions collection', async () => {
  const requests: Request[] = [];
  const client = new CmsClient({
    baseUrl: 'https://cms.example.com',
    token: 'token-123',
    fetchImpl: async (input, init) => {
      const request = new Request(input, init);
      requests.push(request);
      if (request.method === 'PATCH') {
        return Response.json({ doc: { id: 3, ...skillPayload, title: '更新后的 Skill' } });
      }
      return Response.json({ docs: [{ id: 3, ...skillPayload }] });
    },
  });

  const skill = await client.findSkillBySlug('tencent-campus-recruiting');
  const updated = await client.updateSkill(3, { ...skillPayload, title: '更新后的 Skill' });

  assert.equal(skill?.id, 3);
  assert.equal(updated.title, '更新后的 Skill');
  assert.equal(
    requests[0]?.url,
    'https://cms.example.com/api/skillExtensions?depth=0&limit=1&where%5Bslug%5D%5Bequals%5D=tencent-campus-recruiting',
  );
  assert.equal(requests[1]?.url, 'https://cms.example.com/api/skillExtensions/3');
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

      return Response.json({ doc: { id: 2, ...payload } });
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
