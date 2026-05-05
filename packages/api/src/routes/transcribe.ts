import { displayToMicro, insufficientBalanceError, STT_TRANSCRIBE_RATE_PER_MIN } from '@muicv/shared';
import type { Context } from 'hono';

import { TranscribeError, transcribeAudio } from '../lib/transcribe.ts';
import { charge, ensureBalance } from '../lib/wallet.ts';
import type { AppEnv } from '../middleware/api-key.ts';

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_DURATION_MS = 10 * 60 * 1000;

/** 按音频时长（向上取整到分钟）算扣账金额（μtoken）。 */
function computeStCharge(durationMs: number): number {
  const minutes = Math.max(1, Math.ceil(durationMs / 60_000));
  return displayToMicro(minutes * STT_TRANSCRIBE_RATE_PER_MIN);
}

/**
 * POST /audio/transcribe —— STT 转写（issue #1 M1）。
 *
 * Request:
 *   - Content-Type: multipart/form-data
 *   - 字段 `file`: 音频文件（< 25MB，时长 < 10min）
 *   - Authorization: Bearer mui_xxx
 *
 * Response:
 *   200 application/json：{ transcript, duration_ms, language, segments? }
 *   400：参数错误（content-type / 缺 file / 文件过大 / 时长超限）
 *   402：余额不足（按 1 分钟最低预扣判断）
 *   502：Whisper 调用失败 / 转写空 / duration 缺失（不扣账）
 *
 * 计费：
 *   - 成功才扣，按返回 duration 实际时长向上取整到分钟 × STT_TRANSCRIBE_RATE_PER_MIN
 *   - 跟 /render 一致用 c.executionCtx.waitUntil 异步扣账，不阻塞响应
 *   - 余额不足直接 402，不进 Whisper 调用（避免 Workers AI 成本浪费）
 */
export async function handleTranscribe(c: Context<AppEnv>): Promise<Response> {
  const userId = c.get('userId');
  if (!userId) return c.json({ error: 'unauthorized' }, 401);

  const ct = c.req.header('content-type') ?? '';
  if (!ct.includes('multipart/form-data')) {
    return c.json({ error: 'Content-Type 必须是 multipart/form-data' }, 400);
  }

  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    return c.json({ error: '请求体不是合法 multipart/form-data' }, 400);
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return c.json({ error: '缺少字段 `file`（必须是音频文件）' }, 400);
  }

  if (file.size === 0) {
    return c.json({ error: '音频文件为空' }, 400);
  }
  if (file.size > MAX_FILE_BYTES) {
    return c.json({ error: '音频文件超过 25MB，请先剪辑' }, 400);
  }

  const minChargeMicro = displayToMicro(STT_TRANSCRIBE_RATE_PER_MIN);
  const wallet = await ensureBalance(c.env, userId);
  if (wallet.balance < minChargeMicro) {
    return c.json(insufficientBalanceError(wallet.balance), 402);
  }

  const audio = new Uint8Array(await file.arrayBuffer());

  let result: Awaited<ReturnType<typeof transcribeAudio>>;
  try {
    result = await transcribeAudio(audio, c.env);
  } catch (err) {
    if (err instanceof TranscribeError) {
      return c.json(err.detail, err.status);
    }
    return c.json(
      {
        error: '转写失败',
        detail: err instanceof Error ? err.message : String(err),
      },
      502,
    );
  }

  if (result.durationMs > MAX_DURATION_MS) {
    return c.json({ error: '音频时长超过 10 分钟，请分段', durationMs: result.durationMs }, 400);
  }

  const chargeMicro = computeStCharge(result.durationMs);
  c.executionCtx.waitUntil(
    charge(c.env, userId, chargeMicro, 'stt_transcribe', {
      durationMs: result.durationMs,
      language: result.language,
    }).catch(() => {}),
  );

  return c.json({
    transcript: result.transcript,
    duration_ms: result.durationMs,
    language: result.language,
    segments: result.segments,
  });
}
