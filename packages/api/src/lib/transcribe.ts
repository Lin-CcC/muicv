import { Buffer } from 'node:buffer';

/**
 * STT 转写：Cloudflare Workers AI Whisper。issue #1 M1。
 *
 * 模型选 `@cf/openai/whisper-large-v3-turbo`：
 *   - 比 base 准很多，中英文都能跑
 *   - 返回 transcription_info.duration（秒）+ language + segments，省去自己解 vtt
 *   - 计费维度对齐：duration 直接给后端做按分钟计费
 *
 * 不做的事（按 plan，客户端职责）：
 *   - filler 词统计
 *   - pause 检测（renderer 录音时已经有时间戳，不绕一圈走后端再算一遍）
 */

export type TranscribeEnv = {
  AI: Ai;
};

export type TranscribeResult = {
  transcript: string;
  durationMs: number;
  language: string;
  segments?: Array<{ start: number; end: number; text: string }>;
};

/**
 * Whisper 调用的可预期失败：模型错误 / duration 拿不到 / 文本为空。
 * caller 拿到这个错误就 502 透传 detail，不扣账。
 */
export class TranscribeError extends Error {
  readonly status = 502 as const;
  readonly detail: { error: string; [k: string]: unknown };
  constructor(detail: { error: string; [k: string]: unknown }) {
    super(detail.error);
    this.detail = detail;
  }
}

/** Worker runtime 可用 nodejs_compat 的 Buffer 把 binary 转 base64，比 btoa(String.fromCharCode(...)) 稳。 */
function toBase64(audio: Uint8Array): string {
  return Buffer.from(audio).toString('base64');
}

export async function transcribeAudio(audio: Uint8Array, env: TranscribeEnv): Promise<TranscribeResult> {
  if (audio.byteLength === 0) {
    throw new TranscribeError({ error: '音频为空' });
  }

  let result: Ai_Cf_Openai_Whisper_Large_V3_Turbo_Output;
  try {
    result = await env.AI.run('@cf/openai/whisper-large-v3-turbo', {
      audio: toBase64(audio),
      vad_filter: true,
    });
  } catch (err) {
    throw new TranscribeError({
      error: 'Workers AI Whisper 调用失败',
      cause: err instanceof Error ? err.message : String(err),
    });
  }

  const transcript = (result.text ?? '').trim();
  if (!transcript) {
    throw new TranscribeError({ error: '转写结果为空（可能是纯静音 / 音频格式不支持）' });
  }

  const durationSec = result.transcription_info?.duration;
  if (typeof durationSec !== 'number' || !Number.isFinite(durationSec) || durationSec <= 0) {
    throw new TranscribeError({ error: 'Whisper 未返回音频时长' });
  }

  const segments = result.segments
    ?.map((seg) => ({
      start: seg.start ?? 0,
      end: seg.end ?? 0,
      text: (seg.text ?? '').trim(),
    }))
    .filter((seg) => seg.text.length > 0);

  return {
    transcript,
    durationMs: Math.round(durationSec * 1000),
    language: result.transcription_info?.language ?? 'unknown',
    segments: segments && segments.length > 0 ? segments : undefined,
  };
}
