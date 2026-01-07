import assert from 'node:assert/strict';
import test from 'node:test';

import { shouldAttemptResumeExtraction } from './resume-extraction-heuristics.ts';

test('resume extraction heuristics：技术问答不触发抽取', () => {
  assert.equal(shouldAttemptResumeExtraction('React 跟 Vue 有什么区别？'), false);
  assert.equal(shouldAttemptResumeExtraction('怎么实现一个虚拟列表？'), false);
});

test('resume extraction heuristics：第一人称经历陈述触发抽取', () => {
  assert.equal(shouldAttemptResumeExtraction('我这个月开始做 Vue 了。'), true);
  assert.equal(shouldAttemptResumeExtraction('我去年入职了一家创业公司，负责前端开发。'), true);
});

test('resume extraction heuristics：显式简历关键词触发抽取', () => {
  assert.equal(shouldAttemptResumeExtraction('邮箱改成 foo@bar.com'), true);
  assert.equal(shouldAttemptResumeExtraction('帮我优化一下简历的项目经历描述'), true);
});
