import { Buffer } from 'node:buffer';

import { tool } from '@openai/agents';
import type { WebContents } from 'electron';
import { z } from 'zod';

import type { AppConfig, AudioRecordingPayload } from '../../shared/types.ts';
import { MicPermissionDenied, RecordingCancelled, ensureMicrophoneAccess, requestRecording } from '../audio.ts';
import { countFillers } from '../lib/filler-count.ts';

/**
 * STT 工具集（issue #1 M2）。
 *
 * record_and_transcribe_response：让用户口头答题。
 *   1. ensureMicrophoneAccess（macOS 权限弹窗）
 *   2. 触发 renderer RecordPanel → 等用户录完 base64 + duration + pauses
 *   3. POST {muicvApiBase}/audio/transcribe（multipart/form-data）
 *   4. 拿到 transcript → countFillers + pause 数 → 返回 JSON
 *
 * 失败语义（直接返回字符串给 agent，agent 据此决定要不要回退打字模式）：
 *   - 麦克风未授权 → "录音失败：麦克风未授权..."
 *   - 用户取消 → "录音失败：用户取消"
 *   - 网络错误 → "调 muicv API 失败：..."
 *   - 后端 4xx/5xx → "muicv /audio/transcribe 返回 NNN：..."
 *
 * 仅在 muicv 桌面 app 内有效；description 里说清楚让 agent 在 terminal 别误调。
 */

function authHeader(config: AppConfig): Record<string, string> {
  return config.muicvApiKey ? { authorization: `Bearer ${config.muicvApiKey}` } : {};
}

export function buildSttTools(config: AppConfig, sender: WebContents) {
  const recordAndTranscribeResponse = tool({
    name: 'record_and_transcribe_response',
    description:
      '弹出录音面板让用户用麦克风口头回答（最长 N 秒）。返回 JSON 字符串，含 transcript / durationMs / language / fillerCount / pauseCount。**仅在 muicv 桌面 app 内可用**。',
    parameters: z.object({
      durationLimitSec: z.number().nullable().describe('录音上限秒数，默认 180（3 分钟）'),
    }),
    execute: async ({ durationLimitSec }) => {
      const limitSec = durationLimitSec ?? 180;

      try {
        await ensureMicrophoneAccess();
      } catch (err) {
        if (err instanceof MicPermissionDenied) return `录音失败：${err.message}`;
        return `录音失败：${err instanceof Error ? err.message : String(err)}`;
      }

      let payload: AudioRecordingPayload;
      try {
        payload = await requestRecording({ durationLimitSec: limitSec, sender });
      } catch (err) {
        if (err instanceof RecordingCancelled) return `录音失败：${err.message}`;
        return `录音失败：${err instanceof Error ? err.message : String(err)}`;
      }

      let res: Response;
      try {
        res = await postTranscribe(config, payload);
      } catch (err) {
        return `调 muicv API 失败（网络错）：${err instanceof Error ? err.message : String(err)}`;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return `muicv /audio/transcribe 返回 ${res.status}：${text.slice(0, 300) || '未知错误'}`;
      }

      let body: { transcript?: string; duration_ms?: number; language?: string };
      try {
        body = (await res.json()) as typeof body;
      } catch {
        return 'muicv /audio/transcribe 响应不是合法 JSON';
      }

      if (typeof body.transcript !== 'string') {
        return 'muicv /audio/transcribe 没返回 transcript';
      }

      const fillerCount = countFillers(body.transcript);
      const pauseCount = payload.pauses.length;

      // 用 client 测的录音 duration（pause 检测同源）；后端的 duration_ms 是 Whisper 算的
      // 实际语音时长，更准但跟 pause 时间戳轴不同。pauseCount 是本地数据，所以用本地 duration。
      const durationMs = body.duration_ms ?? payload.durationMs;

      return JSON.stringify({
        transcript: body.transcript,
        durationMs,
        language: body.language ?? 'unknown',
        fillerCount,
        pauseCount,
      });
    },
  });

  return [recordAndTranscribeResponse];
}

async function postTranscribe(config: AppConfig, payload: AudioRecordingPayload): Promise<Response> {
  const audio = Buffer.from(payload.audioBase64, 'base64');
  const blob = new Blob([audio], { type: payload.mimeType });
  const form = new FormData();
  form.append('file', blob, fileNameForMime(payload.mimeType));

  return await fetch(`${config.muicvApiBase.replace(/\/$/, '')}/audio/transcribe`, {
    method: 'POST',
    headers: { ...authHeader(config) },
    body: form,
  });
}

function fileNameForMime(mime: string): string {
  if (mime.includes('webm')) return 'recording.webm';
  if (mime.includes('ogg')) return 'recording.ogg';
  if (mime.includes('mp4') || mime.includes('m4a')) return 'recording.m4a';
  if (mime.includes('wav')) return 'recording.wav';
  return 'recording.bin';
}
