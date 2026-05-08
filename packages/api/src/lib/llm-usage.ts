/**
 * OpenAI Chat Completions stream 工具：
 *   - extractUsageFromSseStream: 消费整个流，返回最后一个 usage 对象
 *   - stripUsageChunkFromSse: 流式过滤掉"含 usage 但 choices 为空"的最后一个 chunk
 *
 * 默认 stream 不返 usage，必须在请求 body 里带 stream_options.include_usage=true。
 * 我们在 BYOK 之外的平台路径上**强制注入**这个字段以便扣账；如果 client 没主动声明，
 * 转发响应时把这个 chunk 吞掉，保持 OpenAI SDK 的流契约。
 *
 * SSE chunk 标准形态：
 *   data: { ... "choices":[...], "usage": null }\n\n
 *   data: { ... "choices":[],    "usage": {...} }\n\n   <-- 我们要 strip 这条
 *   data: [DONE]\n\n
 */

export type LlmUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens?: number;
  /** prompt cache 命中数（OpenAI: usage.prompt_tokens_details.cached_tokens）；已含在 prompt_tokens 里 */
  cached_tokens?: number;
};

const DATA_PREFIX = 'data: ';

function isUsageOnlyBlock(block: string): boolean {
  for (const line of block.split('\n')) {
    if (!line.startsWith(DATA_PREFIX)) continue;
    const payload = line.slice(DATA_PREFIX.length).trim();
    if (!payload || payload === '[DONE]') continue;
    try {
      const obj = JSON.parse(payload);
      if (obj?.usage && Array.isArray(obj.choices) && obj.choices.length === 0) {
        return true;
      }
    } catch {
      // ignore
    }
  }
  return false;
}

function tryReadUsageFromBlock(block: string): LlmUsage | null {
  for (const line of block.split('\n')) {
    if (!line.startsWith(DATA_PREFIX)) continue;
    const payload = line.slice(DATA_PREFIX.length).trim();
    if (!payload || payload === '[DONE]') continue;
    try {
      const obj = JSON.parse(payload);
      if (obj?.usage?.prompt_tokens != null && obj?.usage?.completion_tokens != null) {
        return {
          prompt_tokens: obj.usage.prompt_tokens,
          completion_tokens: obj.usage.completion_tokens,
          total_tokens: obj.usage.total_tokens,
          cached_tokens: obj.usage.prompt_tokens_details?.cached_tokens ?? 0,
        };
      }
    } catch {
      // ignore
    }
  }
  return null;
}

/**
 * 消费整个 SSE 流，返回最后一个含 usage 的 chunk 数据；流结束都没找到返回 null。
 * 由 caller 在 waitUntil 里调用，不阻塞 client 响应。
 */
export async function extractUsageFromSseStream(stream: ReadableStream<Uint8Array>): Promise<LlmUsage | null> {
  const reader = stream.pipeThrough(new TextDecoderStream()).getReader();
  let buf = '';
  let last: LlmUsage | null = null;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += value;
      let idx: number;
      while ((idx = buf.indexOf('\n\n')) !== -1) {
        const block = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        const u = tryReadUsageFromBlock(block);
        if (u) last = u;
      }
    }
    if (buf) {
      const u = tryReadUsageFromBlock(buf);
      if (u) last = u;
    }
  } finally {
    reader.releaseLock();
  }
  return last;
}

/**
 * 流式过滤：把"含 usage 且 choices 为空"的 SSE block 吞掉，其余原样转发。
 * 用于客户端没主动声明 include_usage 但我们偷偷注入的场景，保持调用方
 * （OpenAI SDK / 直 fetch）拿到的流契约不变。
 */
export function stripUsageChunkFromSse(stream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buf = '';

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = stream.getReader();
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });

          let lastSplit = 0;
          let idx: number;
          while ((idx = buf.indexOf('\n\n', lastSplit)) !== -1) {
            const block = buf.slice(lastSplit, idx);
            if (!isUsageOnlyBlock(block)) {
              controller.enqueue(encoder.encode(`${block}\n\n`));
            }
            lastSplit = idx + 2;
          }
          buf = buf.slice(lastSplit);
        }
        // flush 剩余
        if (buf) {
          if (!isUsageOnlyBlock(buf)) {
            controller.enqueue(encoder.encode(buf));
          }
        }
      } finally {
        reader.releaseLock();
      }
      controller.close();
    },
  });
}
