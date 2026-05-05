import assert from 'node:assert/strict';
import test from 'node:test';

import { countFillers } from '../src/main/lib/filler-count.ts';

test('countFillers 空字符串 → 0', () => {
  assert.equal(countFillers(''), 0);
});

test('countFillers 中文：嗯 + 呃 + 那个', () => {
  // "嗯" "呃" 各 2 次；"那个" 1 次 + "这个" 1 次
  const text = '嗯，那个，我觉得呃，呃，这个问题嗯比较复杂。';
  assert.equal(countFillers(text), 6);
});

test('countFillers 英文按词边界：alike 不命中 like', () => {
  // "I sort of think basically alike" → sort of 1 + basically 1，alike 不算
  const text = 'I sort of think basically alike.';
  assert.equal(countFillers(text), 2);
});

test('countFillers 英文大小写不敏感 + 多词短语', () => {
  // "Um, you know, like" → um 1 + you know 1 + like 1
  const text = 'Um, You Know, Like, I am thinking.';
  assert.equal(countFillers(text), 3);
});

test('countFillers 中英文混合', () => {
  // 嗯 1 + 那个 1 + um 1 + like 1
  const text = '嗯，那个 um，是 like 那种 fallback 方案。';
  assert.equal(countFillers(text), 4);
});

test('countFillers 没有任何填充词 → 0', () => {
  assert.equal(countFillers('我设计了一个分布式系统，QPS 达到 100k。'), 0);
});

test('countFillers 中文不要求词边界（whisper 输出无空格）', () => {
  // 直接连写，"那个"、"就是" 仍能命中
  assert.equal(countFillers('那个就是说我不知道'), 2);
});
