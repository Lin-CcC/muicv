import assert from 'node:assert/strict';
import test from 'node:test';

import { describeCause } from '../src/main/whisper-engine/error-format.ts';

/**
 * #9 whisper fetch 错误细化：describeCause 把底层 Error / errno code / 嵌套 cause
 * 拍平成 UI 能直接读懂的一行，避免只剩 `fetch failed`。
 */

test('describeCause: 普通 Error → 只输出 message', () => {
  assert.equal(describeCause(new Error('boom')), 'boom');
});

test('describeCause: Error 带 errno code → 拼上 [code]', () => {
  const err = new Error('ENOTFOUND example.invalid') as NodeJS.ErrnoException;
  err.code = 'ENOTFOUND';
  assert.equal(describeCause(err), 'ENOTFOUND example.invalid [ENOTFOUND]');
});

test('describeCause: 嵌套 cause（fetch failed → ECONNREFUSED）→ 链式展开', () => {
  const inner = new Error('connect ECONNREFUSED 127.0.0.1:80') as NodeJS.ErrnoException;
  inner.code = 'ECONNREFUSED';
  const outer = new TypeError('fetch failed', { cause: inner });
  const out = describeCause(outer);
  assert.match(out, /fetch failed/);
  assert.match(out, /ECONNREFUSED/);
  assert.match(out, /→/);
});

test('describeCause: 非 Error → String()', () => {
  assert.equal(describeCause('plain string'), 'plain string');
  assert.equal(describeCause(42), '42');
});

test('describeCause: 多层 cause 链 → 全部展开', () => {
  const a = new Error('layer-a');
  const b = new Error('layer-b', { cause: a });
  const c = new Error('layer-c', { cause: b });
  const out = describeCause(c);
  assert.match(out, /layer-c.*→.*layer-b.*→.*layer-a/);
});
