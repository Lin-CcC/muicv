import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeCreateChangelogInput, normalizeUpsertChangelogInput } from '../mcp/changelog-input.ts';

const NOW = new Date('2026-05-16T08:30:00.000Z');

test('normalizeCreateChangelogInput 补齐 Payload changelog 默认值', () => {
  const input = normalizeCreateChangelogInput(
    {
      title: '新增 Skill 目录和求职内容中心',
      slug: 'skill-directory-start',
      status: 'published',
      version: '0.5.0',
      summary: 'Mui 简历开始登记第三方官方 skill、自有 skill 与求职博文。',
      bodyMarkdown: '## 本次更新\n\n- 新增 skill 目录数据模型',
    },
    NOW,
  );

  assert.equal(input.dryRun, false);
  assert.deepEqual(input.payload, {
    title: '新增 Skill 目录和求职内容中心',
    slug: 'skill-directory-start',
    status: 'published',
    _status: 'published',
    version: '0.5.0',
    summary: 'Mui 简历开始登记第三方官方 skill、自有 skill 与求职博文。',
    bodyMarkdown: '## 本次更新\n\n- 新增 skill 目录数据模型',
    publishedAt: '2026-05-16',
  });
});

test('normalizeUpsertChangelogInput 默认允许按 slug 更新', () => {
  const input = normalizeUpsertChangelogInput(
    {
      title: '产品更新',
      summary: '更新说明。',
      bodyMarkdown: '## 更新\n\n完善 CMS MCP。',
      dryRun: true,
    },
    NOW,
  );

  assert.equal(input.dryRun, true);
  assert.equal(input.onConflict, 'update');
  assert.equal(input.payload.slug, 'post-20260516-083000');
  assert.equal(input.payload.status, 'draft');
});
