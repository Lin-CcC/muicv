import { ipcMain } from 'electron';

import type { AppConfig } from '../../shared/types.ts';
import {
  type CreatePreviewInput,
  type CreatePreviewResult,
  createPreview,
  type PhotoHistoryResult,
  type PhotoUploadInput,
  type PhotoUploadResult,
  listPhotos,
  uploadPhoto,
} from '../api-preview.ts';
import {
  MicPermissionDenied,
  RecordingCancelled,
  isLocalReady,
  recordWav,
  transcribeWav,
  type TranscribeResult,
} from '../audio.ts';
import { getConfig } from '../store.ts';

export type RecordAndTranscribeOutcome =
  | { ok: true; result: TranscribeResult }
  | { ok: false; reason: 'mic-denied' | 'cancel'; message: string }
  | {
      ok: false;
      reason: 'error';
      message: string;
      lastAudio?: { wav: Uint8Array; mimeType: string; durationMs: number; pauses: Array<[number, number]> };
      localReady?: boolean;
    };

async function transcribeWavPayloadToOutcome(
  payload: { audioBase64: string; mimeType: string; durationMs: number; pauses: Array<[number, number]> },
  config: AppConfig,
): Promise<RecordAndTranscribeOutcome> {
  try {
    const result = await transcribeWav(payload, config);
    return { ok: true, result };
  } catch (err) {
    const localReady = await isLocalReady().catch(() => false);
    return {
      ok: false,
      reason: 'error',
      message: err instanceof Error ? err.message : String(err),
      lastAudio: {
        wav: new Uint8Array(Buffer.from(payload.audioBase64, 'base64')),
        mimeType: payload.mimeType,
        durationMs: payload.durationMs,
        pauses: payload.pauses,
      },
      localReady,
    };
  }
}

/** 录音 + 转写 + 在线预览 + 证件照 IPC。 */
export function registerAudioPreviewIpc(): void {
  /**
   * 让 renderer chatbox 也能主动触发录音 → 转写（issue #1 M2 增补）。
   *
   * issue #6：拆成 recordWav + transcribeWav 两阶段，转写阶段失败时把已录好的 wav 一起带回 renderer，
   * 让 UI 提供「重试转写 / 下载录音 / 安装本地模型」三条后路。agent tool 路径仍走 recordAndTranscribe。
   */
  ipcMain.handle(
    'audio:recordAndTranscribe',
    async (e, opts: { durationLimitSec?: number }): Promise<RecordAndTranscribeOutcome> => {
      let payload: Awaited<ReturnType<typeof recordWav>>;
      try {
        payload = await recordWav({ durationLimitSec: opts?.durationLimitSec ?? 180, sender: e.sender });
      } catch (err) {
        if (err instanceof MicPermissionDenied) return { ok: false, reason: 'mic-denied', message: err.message };
        if (err instanceof RecordingCancelled) return { ok: false, reason: 'cancel', message: err.message };
        // 录音阶段未拿到音频；不算 issue #6 的"转写失败"，没 lastAudio 可保留
        return { ok: false, reason: 'error', message: err instanceof Error ? err.message : String(err) };
      }
      return transcribeWavPayloadToOutcome(payload, getConfig());
    },
  );

  /** issue #6：手动重试。复用同一份 wav 走完整的 transcribe 流程（含 3 次重试 + 本地兜底）。 */
  ipcMain.handle(
    'audio:retranscribe',
    async (
      _e,
      audio: { wav: Uint8Array; mimeType: string; durationMs: number; pauses: Array<[number, number]> },
    ): Promise<RecordAndTranscribeOutcome> => {
      const payload = {
        audioBase64: Buffer.from(audio.wav).toString('base64'),
        mimeType: audio.mimeType,
        durationMs: audio.durationMs,
        pauses: audio.pauses,
      };
      return transcribeWavPayloadToOutcome(payload, getConfig());
    },
  );

  // 在线预览 + 证件照（muicv 后端 API 封装）
  ipcMain.handle('preview:uploadPhoto', async (_e, input: PhotoUploadInput): Promise<PhotoUploadResult> => {
    return uploadPhoto(getConfig(), input);
  });

  ipcMain.handle('preview:listPhotos', async (_e, limit?: number): Promise<PhotoHistoryResult> => {
    return listPhotos(getConfig(), typeof limit === 'number' ? limit : 20);
  });

  ipcMain.handle('preview:create', async (_e, input: CreatePreviewInput): Promise<CreatePreviewResult> => {
    return createPreview(getConfig(), input);
  });
}
