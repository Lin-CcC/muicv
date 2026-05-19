import assert from 'node:assert/strict';
import test from 'node:test';

import { countCodePoints } from '../src/lib/feedback.ts';

test('countCodePoints: ASCII 与 length 一致', () => {
  assert.equal(countCodePoints(''), 0);
  assert.equal(countCodePoints('hello'), 5);
});

test('countCodePoints: 中文按 code point 数', () => {
  assert.equal(countCodePoints('你好世界'), 4);
});

test('countCodePoints: emoji / 代理对按 1 字符计', () => {
  // U+1F600 GRINNING FACE 在 UTF-16 是 surrogate pair (length=2)，
  // 但 code point 是 1。直接用 .length 会把 emoji 算成 2，导致
  // 用户少打 1 个字却被判定为已超长。countCodePoints 必须用 Array.from。
  assert.equal('😀'.length, 2);
  assert.equal(countCodePoints('😀'), 1);
  assert.equal(countCodePoints('a😀b'), 3);
});

test('countCodePoints: ZWJ 序列保留 grapheme 内每个 code point（按 spec 算）', () => {
  // 👨‍👩‍👧 = man + ZWJ + woman + ZWJ + girl —— 5 个 code point，
  // grapheme=1。我们按 code point 计费，不展开 grapheme，这一行保护现状。
  assert.equal(countCodePoints('👨‍👩‍👧'), 5);
});
