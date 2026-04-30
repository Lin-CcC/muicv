import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyError,
  cryptoRandomId,
  resolveWorkspacePath,
  safeParseJson,
} from '../src/renderer/components/chat-utils.ts';

test('classifyError 空字符串 / NOT_LOGGED_IN → plain', () => {
  assert.equal(classifyError(''), 'plain');
  assert.equal(classifyError('NOT_LOGGED_IN'), 'plain');
});

test('classifyError NO_PROFILE → no-profile', () => {
  assert.equal(classifyError('NO_PROFILE'), 'no-profile');
});

test('classifyError muirouter / 402 / no-muirouter-link / byok → ai-not-configured', () => {
  assert.equal(classifyError('no-muirouter-link'), 'ai-not-configured');
  assert.equal(classifyError('upstream returned 402'), 'ai-not-configured');
  assert.equal(classifyError('muirouter not bound'), 'ai-not-configured');
  assert.equal(classifyError('需要 BYOK'), 'ai-not-configured');
});

test('classifyError 大小写不敏感', () => {
  assert.equal(classifyError('Muirouter not configured'), 'ai-not-configured');
});

test('classifyError 任意其它字符串 → plain', () => {
  assert.equal(classifyError('something exploded'), 'plain');
  assert.equal(classifyError('500 Internal'), 'plain');
});

test('safeParseJson 合法 JSON → 解析后的对象', () => {
  assert.deepEqual(safeParseJson('{"a":1}'), { a: 1 });
  assert.deepEqual(safeParseJson('[1,2,3]'), [1, 2, 3]);
});

test('safeParseJson 非法 JSON → 原样字符串', () => {
  assert.equal(safeParseJson('{not json'), '{not json');
  assert.equal(safeParseJson(''), '');
});

test('cryptoRandomId 返回 UUID 字符串', () => {
  const id = cryptoRandomId();
  assert.equal(typeof id, 'string');
  // RFC4122 v4 形如 xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
});

test('cryptoRandomId 多次调用产生不同值', () => {
  const a = cryptoRandomId();
  const b = cryptoRandomId();
  assert.notEqual(a, b);
});

test('resolveWorkspacePath 已经是绝对路径（POSIX）→ 原样返回', () => {
  assert.equal(resolveWorkspacePath('/Users/me/work', '/etc/hosts'), '/etc/hosts');
});

test('resolveWorkspacePath 已经是绝对路径（Windows）→ 原样返回', () => {
  assert.equal(resolveWorkspacePath('C:\\Users\\me', 'D:/Other/file.md'), 'D:/Other/file.md');
  assert.equal(resolveWorkspacePath('C:\\Users\\me', 'D:\\Other\\file.md'), 'D:\\Other\\file.md');
});

test('resolveWorkspacePath 相对路径 + POSIX workspace → 拼接 /', () => {
  assert.equal(resolveWorkspacePath('/Users/me/work', 'versions/g.md'), '/Users/me/work/versions/g.md');
});

test('resolveWorkspacePath workspace 末尾带 / → 不会出现 //', () => {
  assert.equal(resolveWorkspacePath('/Users/me/work/', 'versions/g.md'), '/Users/me/work/versions/g.md');
});

test('resolveWorkspacePath 相对路径前缀 / 会被剥掉，避免拼成绝对路径', () => {
  assert.equal(
    resolveWorkspacePath('/Users/me/work', '/versions/g.md'),
    // '/versions/g.md' 被 isPosixAbs 当成绝对路径直接返回
    '/versions/g.md',
  );
});

test('resolveWorkspacePath 相对路径 + Windows workspace → 拼接 \\', () => {
  assert.equal(resolveWorkspacePath('C:\\Users\\me\\work', 'versions/g.md'), 'C:\\Users\\me\\work\\versions/g.md');
});

test('resolveWorkspacePath workspace 为 null 时原样返回', () => {
  assert.equal(resolveWorkspacePath(null, 'versions/g.md'), 'versions/g.md');
});

test('resolveWorkspacePath 空路径直接返回', () => {
  assert.equal(resolveWorkspacePath('/Users/me/work', ''), '');
});
