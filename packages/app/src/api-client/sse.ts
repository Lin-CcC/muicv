export type SseEvent = {
  event: string;
  data: string;
};

function normalizeNewlines(value: string) {
  return value.replaceAll('\r\n', '\n');
}

function parseSseEventBlock(block: string): SseEvent | undefined {
  const lines = block
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean);

  let eventName = 'message';
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith('event:')) {
      eventName = line.slice('event:'.length).trim() || eventName;
      continue;
    }

    if (line.startsWith('data:')) {
      dataLines.push(line.slice('data:'.length).trimStart());
    }
  }

  if (dataLines.length === 0) return undefined;
  return { data: dataLines.join('\n'), event: eventName };
}

export async function* iterateSseEvents(response: Response): AsyncIterable<SseEvent> {
  if (!response.body) {
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      buffer += decoder.decode(value, { stream: true });
      buffer = normalizeNewlines(buffer);

      let boundaryIndex = buffer.indexOf('\n\n');
      while (boundaryIndex >= 0) {
        const block = buffer.slice(0, boundaryIndex);
        buffer = buffer.slice(boundaryIndex + 2);

        const event = parseSseEventBlock(block);
        if (event) {
          yield event;
        }

        boundaryIndex = buffer.indexOf('\n\n');
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}
