import assert from 'node:assert/strict';
import { test } from 'node:test';

import { fetchCmsPublishedPosts, fetchCmsPublishedSkills } from '../src/cms-content.ts';
import {
  getPostBySlug,
  getPublishedChangelog,
  getPublishedPosts,
  getPublishedSkills,
  getSkillBySlug,
} from '../src/content-registry.ts';

test('content registry exposes published jobs posts', () => {
  const posts = getPublishedPosts('jobs');
  assert.ok(posts.length >= 2);
  assert.ok(posts.every((post) => post.status === 'published'));
  assert.equal(getPostBySlug('jobs', 'tencent-campus-recruiting-skill')?.section, 'jobs');
});

test('third-party official skill stays link-only', () => {
  const skill = getSkillBySlug('tencent-campus-recruiting');
  assert.ok(skill);
  assert.equal(skill.publisherType, 'official');
  assert.equal(skill.distributionMode, 'link_only');
  assert.equal(skill.appAvailability, 'link_only');
  assert.ok(skill.sourceUrl?.startsWith('https://mp.weixin.qq.com/'));
});

test('catalog includes built-in Mui skills and changelog', () => {
  const skills = getPublishedSkills();
  assert.ok(skills.some((skill) => skill.slug === 'muicv-interview' && skill.appAvailability === 'built_in'));
  assert.ok(getPublishedChangelog().some((item) => item.slug === 'skill-directory-start'));
});

test('cms content fetch maps Payload posts into registry shape', async () => {
  const posts = await fetchCmsPublishedPosts('jobs', {
    baseUrl: 'https://cms.example.com',
    fetchImpl: async () =>
      Response.json({
        docs: [
          {
            slug: 'cms-post',
            section: 'jobs',
            status: 'published',
            title: 'CMS 文章',
            summary: '来自 Payload 的文章。',
            bodyMarkdown: '# CMS 文章',
            tags: [{ value: '校招' }],
            keywords: [{ value: 'CMS' }],
            author: 'Mui简历',
            publishedAt: '2026-05-16',
            updatedAt: '2026-05-16T12:00:00.000Z',
            seoTitle: 'CMS 文章',
            seoDescription: '来自 Payload 的文章。',
          },
        ],
      }),
  });

  assert.equal(posts.length, 1);
  assert.equal(posts[0]?.slug, 'cms-post');
  assert.deepEqual(posts[0]?.tags, ['校招']);
});

test('cms content fetch falls back to seed when Payload is unavailable', async () => {
  const skills = await fetchCmsPublishedSkills({
    baseUrl: 'https://cms.example.com',
    fetchImpl: async () => Response.json({ errors: [{ message: 'forbidden' }] }, { status: 403 }),
  });

  assert.ok(skills.some((skill) => skill.slug === 'tencent-campus-recruiting'));
});
