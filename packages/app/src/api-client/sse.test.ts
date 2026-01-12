import assert from 'node:assert/strict';
import test from 'node:test';

import { iterateSseEvents } from './sse.ts';

function createResponseFromChunks(chunks: string[]) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });

  return new Response(stream);
}

test('iterateSseEvents：支持解析单个事件', async () => {
  const response = createResponseFromChunks(['event: delta\ndata: {"textDelta":"hi"}\n\n']);

  const events: Array<{ event: string; data: string }> = [];
  for await (const event of iterateSseEvents(response)) {
    events.push(event);
  }

  assert.deepEqual(events, [{ data: '{"textDelta":"hi"}', event: 'delta' }]);
});

test('iterateSseEvents：支持事件跨 chunk 拼接', async () => {
  const response = createResponseFromChunks(['event: delta\ndata: {"text', 'Delta":"hi"}\n\n']);

  const events: Array<{ event: string; data: string }> = [];
  for await (const event of iterateSseEvents(response)) {
    events.push(event);
  }

  assert.deepEqual(events, [{ data: '{"textDelta":"hi"}', event: 'delta' }]);
});

test('iterateSseEvents：支持解析多个事件与 CRLF', async () => {
  const response = createResponseFromChunks([
    'event: user\r\ndata: {"id":"1"}\r\n\r\n',
    'event: done\r\ndata: {"ok":true}\r\n\r\n',
  ]);

  const events: Array<{ event: string; data: string }> = [];
  for await (const event of iterateSseEvents(response)) {
    events.push(event);
  }

  assert.deepEqual(events, [
    { data: '{"id":"1"}', event: 'user' },
    { data: '{"ok":true}', event: 'done' },
  ]);
});
