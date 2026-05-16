import assert from 'node:assert/strict';
import { test } from 'node:test';

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
