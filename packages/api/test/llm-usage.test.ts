import assert from 'node:assert/strict';
import test from 'node:test';

import {
  extractUsageFromResponsesJson,
  extractUsageFromResponsesSseStream,
  extractUsageFromSseStream,
  stripUsageChunkFromSse,
} from '../src/lib/llm-usage.ts';

function sseStream(blocks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const b of blocks) controller.enqueue(encoder.encode(`${b}\n\n`));
      controller.close();
    },
  });
}

async function readAllText(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.pipeThrough(new TextDecoderStream()).getReader();
  let out = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    out += value;
  }
  return out;
}

test('extractUsageFromSseStream 找到最后一个 usage chunk', async () => {
  const stream = sseStream([
    'data: {"id":"1","choices":[{"delta":{"content":"hi"}}]}',
    'data: {"id":"1","choices":[],"usage":{"prompt_tokens":12,"completion_tokens":5,"total_tokens":17}}',
    'data: [DONE]',
  ]);
  const usage = await extractUsageFromSseStream(stream);
  assert.equal(usage?.prompt_tokens, 12);
  assert.equal(usage?.completion_tokens, 5);
  assert.equal(usage?.total_tokens, 17);
});

test('extractUsageFromSseStream 解析 prompt_tokens_details.cached_tokens', async () => {
  const stream = sseStream([
    'data: {"id":"1","choices":[{"delta":{"content":"hi"}}]}',
    'data: {"id":"1","choices":[],"usage":{"prompt_tokens":1000,"completion_tokens":50,"prompt_tokens_details":{"cached_tokens":800}}}',
    'data: [DONE]',
  ]);
  const usage = await extractUsageFromSseStream(stream);
  assert.equal(usage?.prompt_tokens, 1000);
  assert.equal(usage?.completion_tokens, 50);
  assert.equal(usage?.cached_tokens, 800);
});

test('extractUsageFromSseStream usage 缺 prompt_tokens_details 时 cached_tokens=0', async () => {
  const stream = sseStream([
    'data: {"id":"1","choices":[],"usage":{"prompt_tokens":12,"completion_tokens":5}}',
    'data: [DONE]',
  ]);
  const usage = await extractUsageFromSseStream(stream);
  assert.equal(usage?.cached_tokens, 0);
});

test('extractUsageFromSseStream 没有 usage 返回 null', async () => {
  const stream = sseStream(['data: {"id":"1","choices":[{"delta":{"content":"hi"}}]}', 'data: [DONE]']);
  const usage = await extractUsageFromSseStream(stream);
  assert.equal(usage, null);
});

test('stripUsageChunkFromSse 把 choices 为空 + 含 usage 的 block 去掉', async () => {
  const stream = sseStream([
    'data: {"id":"1","choices":[{"delta":{"content":"hi"}}]}',
    'data: {"id":"1","choices":[],"usage":{"prompt_tokens":12,"completion_tokens":5}}',
    'data: [DONE]',
  ]);
  const out = await readAllText(stripUsageChunkFromSse(stream));
  assert.match(out, /choices":\[{"delta"/);
  assert.doesNotMatch(out, /usage/);
  assert.match(out, /\[DONE\]/);
});

test('stripUsageChunkFromSse 不去掉含 choices 的正常 chunk', async () => {
  const stream = sseStream([
    'data: {"id":"1","choices":[{"delta":{"content":"hi"}}]}',
    'data: {"id":"1","choices":[{"delta":{"content":" world"}}]}',
    'data: [DONE]',
  ]);
  const out = await readAllText(stripUsageChunkFromSse(stream));
  assert.match(out, /hi/);
  assert.match(out, /world/);
  assert.match(out, /\[DONE\]/);
});

// === Responses API（/v1/responses）SSE / JSON 抽 usage ===

test('extractUsageFromResponsesSseStream 在 response.completed 事件里找到 usage', async () => {
  const stream = sseStream([
    'event: response.created\ndata: {"type":"response.created","response":{"id":"resp_1"}}',
    'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"hi"}',
    'event: response.completed\ndata: {"type":"response.completed","response":{"id":"resp_1","usage":{"input_tokens":42,"output_tokens":7,"total_tokens":49,"input_tokens_details":{"cached_tokens":10}}}}',
  ]);
  const usage = await extractUsageFromResponsesSseStream(stream);
  assert.equal(usage?.prompt_tokens, 42);
  assert.equal(usage?.completion_tokens, 7);
  assert.equal(usage?.total_tokens, 49);
  assert.equal(usage?.cached_tokens, 10);
});

test('extractUsageFromResponsesSseStream 缺 cached_tokens 时回 0', async () => {
  const stream = sseStream([
    'event: response.completed\ndata: {"type":"response.completed","response":{"usage":{"input_tokens":12,"output_tokens":5}}}',
  ]);
  const usage = await extractUsageFromResponsesSseStream(stream);
  assert.equal(usage?.prompt_tokens, 12);
  assert.equal(usage?.completion_tokens, 5);
  assert.equal(usage?.cached_tokens, 0);
});

test('extractUsageFromResponsesSseStream 没拿到 completed 事件 → null', async () => {
  const stream = sseStream([
    'event: response.created\ndata: {"type":"response.created","response":{"id":"resp_1"}}',
    'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"hi"}',
  ]);
  const usage = await extractUsageFromResponsesSseStream(stream);
  assert.equal(usage, null);
});

test('extractUsageFromResponsesSseStream 忽略其他事件里残留的 usage 形状（防误识别）', async () => {
  const stream = sseStream([
    // 假事件：有 usage 但不是 response.completed —— 必须不能抽
    'event: response.in_progress\ndata: {"response":{"usage":{"input_tokens":999,"output_tokens":999}}}',
  ]);
  const usage = await extractUsageFromResponsesSseStream(stream);
  assert.equal(usage, null);
});

test('extractUsageFromResponsesJson 抽 input_tokens / output_tokens', () => {
  const usage = extractUsageFromResponsesJson({
    id: 'resp_1',
    usage: {
      input_tokens: 100,
      output_tokens: 30,
      total_tokens: 130,
      input_tokens_details: { cached_tokens: 50 },
    },
  });
  assert.equal(usage?.prompt_tokens, 100);
  assert.equal(usage?.completion_tokens, 30);
  assert.equal(usage?.cached_tokens, 50);
});

test('extractUsageFromResponsesJson 没 usage 返回 null', () => {
  assert.equal(extractUsageFromResponsesJson({ id: 'resp_1' }), null);
  assert.equal(extractUsageFromResponsesJson(null), null);
  assert.equal(extractUsageFromResponsesJson({ usage: { input_tokens: 'oops' } }), null);
});

test('stripUsageChunkFromSse 跨 chunk 边界正确处理', async () => {
  // 模拟 byte stream 在 block 中间断开
  const encoder = new TextEncoder();
  const full =
    'data: {"id":"1","choices":[{"delta":{"content":"hi"}}]}\n\n' +
    'data: {"id":"1","choices":[],"usage":{"prompt_tokens":12,"completion_tokens":5}}\n\n' +
    'data: [DONE]\n\n';
  const bytes = encoder.encode(full);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // 每 10 字节切一次
      for (let i = 0; i < bytes.length; i += 10) {
        controller.enqueue(bytes.slice(i, i + 10));
      }
      controller.close();
    },
  });
  const out = await readAllText(stripUsageChunkFromSse(stream));
  assert.match(out, /hi/);
  assert.doesNotMatch(out, /usage/);
  assert.match(out, /\[DONE\]/);
});
