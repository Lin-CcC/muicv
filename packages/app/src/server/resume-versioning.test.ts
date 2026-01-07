import assert from 'node:assert/strict';
import test from 'node:test';

import type { ResumeJson } from '@muicv/shared';

import { isResumeMeaningfullyDifferent } from './resume-versioning.ts';

function createResumeJson(params?: Partial<ResumeJson>): ResumeJson {
  return {
    basicInfo: {},
    lastUpdatedAt: new Date().toISOString(),
    version: 1,
    ...(params ?? {}),
  };
}

test('resume versioning：仅 lastUpdatedAt 不应视为变更', () => {
  const a = createResumeJson({ lastUpdatedAt: '2026-01-01T00:00:00.000Z', skills: ['React'] });
  const b = createResumeJson({ lastUpdatedAt: '2026-01-02T00:00:00.000Z', skills: ['React'] });
  assert.equal(isResumeMeaningfullyDifferent(a, b), false);
});

test('resume versioning：字段变化应视为变更', () => {
  const a = createResumeJson({ summary: 'v1' });
  const b = createResumeJson({ summary: 'v2' });
  assert.equal(isResumeMeaningfullyDifferent(a, b), true);
});

test('resume versioning：空与非空应视为变更', () => {
  const a: ResumeJson | null = null;
  const b = createResumeJson();
  assert.equal(isResumeMeaningfullyDifferent(a, b), true);
  assert.equal(isResumeMeaningfullyDifferent(a, null), false);
});
