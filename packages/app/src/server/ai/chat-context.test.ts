import assert from 'node:assert/strict';
import test from 'node:test';

import type { MemoryEntry, ResumeJson } from '@muicv/shared';

import { buildChatSystemPrompt } from './chat-context.ts';

function createMemoryEntry(overrides?: Partial<MemoryEntry>): MemoryEntry {
  return {
    id: 'm1',
    userId: 'u1',
    conversationId: null,
    messageId: null,
    kind: 'skill',
    title: '我开始使用 Vue 进行开发',
    createdAt: '2026-01-07T00:00:00.000Z',
    ...(overrides ?? {}),
  };
}

function createResumeJson(overrides?: Partial<ResumeJson>): ResumeJson {
  return {
    version: 1,
    basicInfo: {},
    lastUpdatedAt: '2026-01-07T00:00:00.000Z',
    ...(overrides ?? {}),
  };
}

test('buildChatSystemPrompt：无上下文则返回 basePrompt', () => {
  const prompt = buildChatSystemPrompt({ basePrompt: 'BASE' });
  assert.equal(prompt, 'BASE');
});

test('buildChatSystemPrompt：记忆条目输出为 JSON 且可限制数量', () => {
  const prompt = buildChatSystemPrompt({
    basePrompt: 'BASE',
    maxMemoryEntries: 1,
    memoryEntries: [
      createMemoryEntry({ id: 'm1', createdAt: '2026-01-07T00:00:00.000Z', title: '第一条' }),
      createMemoryEntry({ id: 'm2', createdAt: '2026-01-06T00:00:00.000Z', title: '第二条' }),
    ],
  });

  const lines = prompt.split('\n');
  const markerIndex = lines.findIndex((line) => line.startsWith('【用户记忆（只读 JSON'));
  assert.ok(markerIndex >= 0);

  const jsonLine = lines[markerIndex + 1];
  assert.ok(jsonLine);

  const parsed = JSON.parse(jsonLine) as Array<{ title: string }>;
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0]?.title, '第一条');
});

test('buildChatSystemPrompt：关联简历输出为 JSON 且不带 source 字段', () => {
  const longHighlight = 'A'.repeat(500);
  const resume = createResumeJson({
    experiences: [
      {
        company: 'Foo',
        role: 'Frontend',
        highlights: [longHighlight],
        source: [{ messageId: 'msg-1', quote: '不应出现在上下文里' }],
      },
    ],
  });

  const prompt = buildChatSystemPrompt({
    basePrompt: 'BASE',
    contextResume: { title: '我的简历', resume },
  });

  const lines = prompt.split('\n');
  const markerIndex = lines.findIndex((line) => line === '【对话已关联简历（只读 JSON）】');
  assert.ok(markerIndex >= 0);

  const jsonLine = lines[markerIndex + 1];
  assert.ok(jsonLine);

  const parsed = JSON.parse(jsonLine) as { resume: ResumeJson };
  const firstExperience = parsed.resume.experiences?.[0] as Record<string, unknown> | undefined;
  assert.ok(firstExperience);
  assert.equal(Object.prototype.hasOwnProperty.call(firstExperience, 'source'), false);

  const normalizedHighlight = parsed.resume.experiences?.[0]?.highlights?.[0];
  assert.ok(normalizedHighlight);
  assert.ok(normalizedHighlight.length <= 201);
});
