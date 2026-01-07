import assert from 'node:assert/strict';
import test from 'node:test';

import { shouldAttemptMemoryExtraction } from './memory-extraction-heuristics.ts';

test('memory extraction heuristics：纯技术问答不触发', () => {
  assert.equal(shouldAttemptMemoryExtraction('React 跟 Vue 有什么区别？'), false);
  assert.equal(shouldAttemptMemoryExtraction('怎么实现一个虚拟列表？'), false);
});

test('memory extraction heuristics：第一人称经历陈述触发', () => {
  assert.equal(shouldAttemptMemoryExtraction('我这个月开始做 Vue 了。'), true);
  assert.equal(shouldAttemptMemoryExtraction('我去年入职了一家创业公司，负责前端开发。'), true);
});

test('memory extraction heuristics：联系方式/链接触发', () => {
  assert.equal(shouldAttemptMemoryExtraction('邮箱改成 foo@bar.com'), true);
  assert.equal(shouldAttemptMemoryExtraction('我的 GitHub：https://github.com/example'), true);
});
