import assert from 'node:assert/strict';
import test from 'node:test';

import type { AgentInputItem } from '@openai/agents';

import { applyImageAttachments } from '../src/main/agent/multimodal.ts';
import type { AttachmentRef } from '../src/shared/types.ts';

const WORKSPACE = '/tmp/fake-workspace';

function makeRef(overrides: Partial<AttachmentRef> = {}): AttachmentRef {
  return {
    path: 'inbox/20260506-143022-shot.png',
    name: 'shot.png',
    kind: 'image',
    mimeType: 'image/png',
    size: 100,
    ...overrides,
  };
}

function makeItems(text: string): AgentInputItem[] {
  return [{ role: 'user', content: text }];
}

test('applyImageAttachments 没附件时原样返回', async () => {
  const items = makeItems('hi');
  const out = await applyImageAttachments(items, undefined, WORKSPACE, async () => Buffer.from('x'));
  assert.deepEqual(out, items);
});

test('applyImageAttachments 只有非 image 附件 → 原样返回', async () => {
  const items = makeItems('hi');
  const refs: AttachmentRef[] = [{ path: 'inbox/a.txt', name: 'a.txt', kind: 'text', mimeType: 'text/plain', size: 1 }];
  const out = await applyImageAttachments(items, refs, WORKSPACE, async () => Buffer.from('x'));
  assert.deepEqual(out, items);
});

test('applyImageAttachments 拼成 input_text + input_image', async () => {
  const items = makeItems('解析这个截图');
  const refs = [makeRef()];
  const out = await applyImageAttachments(items, refs, WORKSPACE, async () => Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  assert.equal(out.length, 1);
  const last = out[0] as { role: 'user'; content: Array<{ type: string; text?: string; image?: string }> };
  assert.equal(last.role, 'user');
  assert.ok(Array.isArray(last.content));
  assert.equal(last.content.length, 2);
  assert.equal(last.content[0]?.type, 'input_text');
  assert.equal(last.content[0]?.text, '解析这个截图');
  assert.equal(last.content[1]?.type, 'input_image');
  assert.match(last.content[1]?.image ?? '', /^data:image\/png;base64,/);
});

test('applyImageAttachments 多张图片全部 inline', async () => {
  const items = makeItems('两张截图');
  const refs = [
    makeRef({ path: 'inbox/a.png', name: 'a.png' }),
    makeRef({ path: 'inbox/b.jpg', name: 'b.jpg', mimeType: 'image/jpeg' }),
  ];
  let calls = 0;
  const out = await applyImageAttachments(items, refs, WORKSPACE, async () => {
    calls++;
    return Buffer.from([0x00, 0x01, 0x02]);
  });
  assert.equal(calls, 2);
  const last = out[0] as { content: Array<{ type: string; image?: string }> };
  // text + 2 images
  assert.equal(last.content.length, 3);
  assert.match(last.content[2]?.image ?? '', /^data:image\/jpeg;base64,/);
});

test('applyImageAttachments 文本为空时只塞图像 block', async () => {
  const items = makeItems('');
  const refs = [makeRef()];
  const out = await applyImageAttachments(items, refs, WORKSPACE, async () => Buffer.from('x'));
  const last = out[0] as { content: Array<{ type: string }> };
  assert.equal(last.content.length, 1);
  assert.equal(last.content[0]?.type, 'input_image');
});

test('applyImageAttachments 读文件失败的图像跳过，不崩', async () => {
  const items = makeItems('两张图');
  const refs = [makeRef({ path: 'inbox/ok.png' }), makeRef({ path: 'inbox/missing.png' })];
  const out = await applyImageAttachments(items, refs, WORKSPACE, async (abs) => {
    if (abs.includes('missing')) throw new Error('ENOENT');
    return Buffer.from([1]);
  });
  const last = out[0] as { content: Array<{ type: string }> };
  // text + 1 ok image
  assert.equal(last.content.length, 2);
});

test('applyImageAttachments 全部读失败 → 退回原 items（不替换 content）', async () => {
  const items = makeItems('图');
  const refs = [makeRef()];
  const out = await applyImageAttachments(items, refs, WORKSPACE, async () => {
    throw new Error('ENOENT');
  });
  // 没图像可塞 → 不替换
  assert.deepEqual(out, items);
});

test('applyImageAttachments 越界路径被拒绝', async () => {
  const items = makeItems('坏图');
  const refs = [makeRef({ path: '../../../etc/passwd.png' })];
  let called = false;
  const out = await applyImageAttachments(items, refs, WORKSPACE, async () => {
    called = true;
    return Buffer.from('x');
  });
  assert.equal(called, false, '越界应该在 read 之前拒绝，不读盘');
  assert.deepEqual(out, items);
});

test('applyImageAttachments 最后一条不是 user → 不动', async () => {
  const items: AgentInputItem[] = [
    { role: 'user', content: 'hi' },
    { role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: 'hello' }] },
  ];
  const refs = [makeRef()];
  const out = await applyImageAttachments(items, refs, WORKSPACE, async () => Buffer.from('x'));
  assert.deepEqual(out, items);
});
