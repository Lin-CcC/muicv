import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';

import { ipcMain, type WebContents, systemPreferences } from 'electron';

import type { AppConfig, AudioRecordingPayload, AudioRecordingRequest } from '../shared/types.ts';
import { countFillers } from './lib/filler-count.ts';
import { getDefaultModel, getPreference, getStatus, transcribeLocal } from './whisper-engine/index.ts';

/**
 * 录音中转 IPC（issue #1 M2）：
 *
 *   agent tool execute() ──requestRecording──► renderer RecordPanel
 *                                                      │
 *                              ◄────── audio:complete / audio:cancel ──┘
 *
 * main 端持有 pending Map，每次 agent 触发录音生成 requestId，等 renderer 回调。
 * 全 app 同时只允许 1 路录音；后到的请求直接 reject。
 */

type Pending = {
  resolve: (payload: AudioRecordingPayload) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
};

const pending = new Map<string, Pending>();

let registered = false;

export type RequestRecordingOpts = {
  durationLimitSec: number;
  sender: WebContents;
};

export class MicPermissionDenied extends Error {
  constructor() {
    super('麦克风未授权。请到 系统设置 → 隐私与安全性 → 麦克风 给 Mui简历 授权后重试。');
    this.name = 'MicPermissionDenied';
  }
}

export class RecordingCancelled extends Error {
  constructor(reason: string) {
    super(`录音取消（${reason}）`);
    this.name = 'RecordingCancelled';
  }
}

/** macOS 单独要权限；Windows / Linux 由浏览器 getUserMedia 弹窗自处理。 */
export async function ensureMicrophoneAccess(): Promise<void> {
  if (process.platform !== 'darwin') return;
  const status = systemPreferences.getMediaAccessStatus('microphone');
  if (status === 'granted') return;
  const granted = await systemPreferences.askForMediaAccess('microphone');
  if (!granted) throw new MicPermissionDenied();
}

/** 触发一次录音流程：返回录音完成后的 payload；用户取消 / 超时抛 RecordingCancelled。 */
export function requestRecording(opts: RequestRecordingOpts): Promise<AudioRecordingPayload> {
  ensureRegistered();
  if (pending.size > 0) {
    return Promise.reject(new Error('已有一路录音正在进行，请先完成或取消'));
  }
  const requestId = randomUUID();
  const limitSec = Math.max(5, Math.min(600, opts.durationLimitSec));
  const request: AudioRecordingRequest = { requestId, durationLimitSec: limitSec };

  return new Promise<AudioRecordingPayload>((resolve, reject) => {
    // 超时兜底：limit + 30s 还没回调（renderer 卡死），主动 reject
    const timer = setTimeout(
      () => {
        pending.delete(requestId);
        reject(new RecordingCancelled('timeout'));
      },
      (limitSec + 30) * 1000,
    );
    pending.set(requestId, { resolve, reject, timer });
    if (opts.sender.isDestroyed()) {
      pending.delete(requestId);
      clearTimeout(timer);
      reject(new Error('renderer 已销毁'));
      return;
    }
    opts.sender.send('audio:recording-request', request);
  });
}

export type TranscribeResult = {
  transcript: string;
  durationMs: number;
  language: string;
  fillerCount: number;
  pauseCount: number;
};

/**
 * 一站式：弹录音面板 → 按偏好选 provider（本地 / 云端）→ 算 filler/pause → 返回结果。
 * agent tool 和 chatbox 麦克风按钮共用这个公共流程。
 *
 * Provider 选择规则（issue #1 M3）：
 *   - 偏好 'local-preferred' 且本地引擎 + 默认模型都装好 → 走本地 whisper-cli
 *   - 否则 → 走云端 POST /audio/transcribe
 *   - 偏好 'always-ask' 暂时按 'cloud' 处理（UI 弹询问留给 P2）
 *
 * 本地失败时**不**自动 fallback 云端：本地用户多半在意隐私 / 离线，悄悄上云违背预期。
 * 报错让 agent / 用户决定下一步。
 */
export async function recordAndTranscribe(opts: {
  durationLimitSec: number;
  sender: WebContents;
  config: AppConfig;
}): Promise<TranscribeResult> {
  await ensureMicrophoneAccess();
  const payload = await requestRecording({ durationLimitSec: opts.durationLimitSec, sender: opts.sender });

  const useLocal = await shouldUseLocal();
  if (useLocal) {
    const local = await transcribeLocal({
      wavBase64: payload.audioBase64,
      modelName: getDefaultModel(),
    });
    return {
      transcript: local.transcript,
      durationMs: local.durationMs || payload.durationMs,
      language: local.language,
      fillerCount: countFillers(local.transcript),
      pauseCount: payload.pauses.length,
    };
  }

  const res = await postTranscribe(opts.config, payload);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`muicv /audio/transcribe 返回 ${res.status}：${text.slice(0, 300) || '未知错误'}`);
  }
  const body = (await res.json().catch(() => null)) as {
    transcript?: string;
    duration_ms?: number;
    language?: string;
  } | null;
  if (!body || typeof body.transcript !== 'string') {
    throw new Error('muicv /audio/transcribe 响应不含 transcript');
  }
  return {
    transcript: body.transcript,
    durationMs: body.duration_ms ?? payload.durationMs,
    language: body.language ?? 'unknown',
    fillerCount: countFillers(body.transcript),
    pauseCount: payload.pauses.length,
  };
}

async function shouldUseLocal(): Promise<boolean> {
  if (getPreference() !== 'local-preferred') return false;
  const status = await getStatus();
  if (!status.engine.installed) return false;
  return status.models.some((m) => m.name === getDefaultModel() && m.installed);
}

async function postTranscribe(config: AppConfig, payload: AudioRecordingPayload): Promise<Response> {
  const audio = Buffer.from(payload.audioBase64, 'base64');
  const blob = new Blob([audio], { type: payload.mimeType });
  const form = new FormData();
  form.append('file', blob, fileNameForMime(payload.mimeType));
  const headers: Record<string, string> = config.muicvApiKey ? { authorization: `Bearer ${config.muicvApiKey}` } : {};
  return await fetch(`${config.muicvApiBase.replace(/\/$/, '')}/audio/transcribe`, {
    method: 'POST',
    headers,
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

function ensureRegistered(): void {
  if (registered) return;
  registered = true;

  ipcMain.handle('audio:complete', (_e, requestId: string, payload: AudioRecordingPayload) => {
    const entry = pending.get(requestId);
    if (!entry) return;
    clearTimeout(entry.timer);
    pending.delete(requestId);
    entry.resolve(payload);
  });

  ipcMain.handle('audio:cancel', (_e, requestId: string, reason: string) => {
    const entry = pending.get(requestId);
    if (!entry) return;
    clearTimeout(entry.timer);
    pending.delete(requestId);
    entry.reject(new RecordingCancelled(reason));
  });
}
