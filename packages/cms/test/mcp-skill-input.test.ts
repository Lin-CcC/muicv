import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeCreateSkillInput, normalizeUpsertSkillInput } from '../mcp/skill-input.ts';

const NOW = new Date('2026-05-16T08:30:00.000Z');

test('normalizeCreateSkillInput 补齐 Payload skillExtensions 默认值', () => {
  const input = normalizeCreateSkillInput(
    {
      title: '腾讯校园招聘 Skill',
      slug: 'tencent-campus-recruiting',
      publisher: '腾讯招聘',
      publisherType: 'official',
      sourceUrl: 'https://join.qq.com/post.html?query=p_2&activity=1251899672503271424',
      sourceLabel: '腾讯招聘官方岗位页',
      distributionMode: 'hosted',
      appAvailability: 'installable',
      summary: '围绕腾讯校招做岗位匹配、简历修改和模拟面试。',
      bodyMarkdown: '## 这是什么\n\n腾讯校园招聘相关求职 skill。',
      useCases: ['腾讯校招岗位匹配', '简历修改'],
      tags: ['腾讯招聘', '校招'],
      keywords: ['腾讯校园招聘 Skill', '腾讯校招'],
    },
    NOW,
  );

  assert.equal(input.dryRun, false);
  assert.deepEqual(input.payload, {
    title: '腾讯校园招聘 Skill',
    slug: 'tencent-campus-recruiting',
    status: 'draft',
    _status: 'draft',
    publisher: '腾讯招聘',
    publisherType: 'official',
    sourceUrl: 'https://join.qq.com/post.html?query=p_2&activity=1251899672503271424',
    sourceLabel: '腾讯招聘官方岗位页',
    distributionMode: 'hosted',
    appAvailability: 'installable',
    summary: '围绕腾讯校招做岗位匹配、简历修改和模拟面试。',
    bodyMarkdown: '## 这是什么\n\n腾讯校园招聘相关求职 skill。',
    useCases: [{ value: '腾讯校招岗位匹配' }, { value: '简历修改' }],
    tags: [{ value: '腾讯招聘' }, { value: '校招' }],
    keywords: [{ value: '腾讯校园招聘 Skill' }, { value: '腾讯校招' }],
    publishedAt: '2026-05-16',
    seoTitle: '腾讯校园招聘 Skill',
    seoDescription: '围绕腾讯校招做岗位匹配、简历修改和模拟面试。',
  });
});

test('normalizeUpsertSkillInput 默认允许按 slug 更新', () => {
  const input = normalizeUpsertSkillInput(
    {
      title: 'Tencent Campus Recruiting Skill',
      summary: 'A skill extension managed by Payload.',
      bodyMarkdown: '## Body\n\nManaged by CMS.',
      publisher: 'MuiCV',
      status: 'published',
      dryRun: true,
    },
    NOW,
  );

  assert.equal(input.dryRun, true);
  assert.equal(input.onConflict, 'update');
  assert.equal(input.payload.slug, 'tencent-campus-recruiting-skill');
  assert.equal(input.payload.status, 'published');
  assert.equal(input.payload._status, 'published');
});
