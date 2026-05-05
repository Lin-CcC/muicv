import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { homedir } from 'node:os';

import { ipcMain, type WebContents, systemPreferences } from 'electron';

import type {
  AppConfig,
  AudioRecordingPayload,
  AudioRecordingRequest,
  AudioTranscodeRequest,
  AudioTranscodedPayload,
} from '../shared/types.ts';
import { countFillers } from './lib/filler-count.ts';
import { getDefaultModel, getPreference, getStatus, transcribeLocal } from './whisper-engine/index.ts';

/**
 * 录音 / 文件转写 IPC 中转（issue #1 M2 + M4）。
 *
 *   M2 录音：
 *     agent tool execute() ──requestRecording──► renderer RecordPanel
 *                                                        │
 *                              ◄──── audio:complete / audio:cancel ──┘
 *
 *   M4 文件：
 *     agent tool execute() ──requestTranscode──► renderer use-audio-transcoder
 *                                                        │
 *                              ◄── audio:transcode-complete / transcode-error ──┘
 *
 * main 端持有两组 pending Map（recording / transcode），每次请求生成 requestId
 * 等 renderer 回调。两组互不抢占，但全 app 同时只允许 1 路录音（防 RecordPanel
 * 二次唤起）；transcode 不限并发（一般也只会有一个 agent tool 在跑）。
 */

type RecordingPending = {
  resolve: (payload: AudioRecordingPayload) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
};

type TranscodePending = {
  resolve: (payload: AudioTranscodedPayload) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
};

const recordingPending = new Map<string, RecordingPending>();
const transcodePending = new Map<string, TranscodePending>();

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

export class FileTranscribeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileTranscribeError';
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
  if (recordingPending.size > 0) {
    return Promise.reject(new Error('已有一路录音正在进行，请先完成或取消'));
  }
  const requestId = randomUUID();
  const limitSec = Math.max(5, Math.min(600, opts.durationLimitSec));
  const request: AudioRecordingRequest = { requestId, durationLimitSec: limitSec };

  return new Promise<AudioRecordingPayload>((resolve, reject) => {
    const timer = setTimeout(
      () => {
        recordingPending.delete(requestId);
        reject(new RecordingCancelled('timeout'));
      },
      (limitSec + 30) * 1000,
    );
    recordingPending.set(requestId, { resolve, reject, timer });
    if (opts.sender.isDestroyed()) {
      recordingPending.delete(requestId);
      clearTimeout(timer);
      reject(new Error('renderer 已销毁'));
      return;
    }
    opts.sender.send('audio:recording-request', request);
  });
}

/**
 * 让 renderer 把任意音频字节流（mp3 / m4a / webm / ogg / wav）转成 16k mono WAV。
 * 所有重活在 renderer 走 OfflineAudioContext，main 端只负责 IPC 等待。
 */
function requestTranscode(opts: {
  audioBase64: string;
  mimeType: string;
  sender: WebContents;
}): Promise<AudioTranscodedPayload> {
  ensureRegistered();
  const requestId = randomUUID();
  const request: AudioTranscodeRequest = {
    requestId,
    audioBase64: opts.audioBase64,
    mimeType: opts.mimeType,
  };
  return new Promise<AudioTranscodedPayload>((resolve, reject) => {
    // 转码不限录音上限，但给 5 分钟兜底防 renderer 卡死
    const timer = setTimeout(
      () => {
        transcodePending.delete(requestId);
        reject(new FileTranscribeError('音频转码超时（5 分钟）'));
      },
      5 * 60 * 1000,
    );
    transcodePending.set(requestId, { resolve, reject, timer });
    if (opts.sender.isDestroyed()) {
      transcodePending.delete(requestId);
      clearTimeout(timer);
      reject(new Error('renderer 已销毁'));
      return;
    }
    opts.sender.send('audio:transcode-request', request);
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
 * 录音 / 文件转写共用：拿到 wav payload → 按偏好选 provider → 返回结果。
 *
 * Provider 选择规则（issue #1 M3）：
 *   - 偏好 'local-preferred' 且本地引擎 + 默认模型都装好 → 走本地 whisper-cli
 *   - 否则 → 走云端 POST /audio/transcribe
 *
 * 本地失败时**不**自动 fallback 云端：本地用户多半在意隐私 / 离线，悄悄上云违背预期。
 */
async function transcribeWavPayload(payload: AudioRecordingPayload, config: AppConfig): Promise<TranscribeResult> {
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

  const res = await postTranscribe(config, payload);
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

/** 录音 → 转写。agent tool record_and_transcribe_response + chatbox 麦克风按钮共用。 */
export async function recordAndTranscribe(opts: {
  durationLimitSec: number;
  sender: WebContents;
  config: AppConfig;
}): Promise<TranscribeResult> {
  await ensureMicrophoneAccess();
  const payload = await requestRecording({ durationLimitSec: opts.durationLimitSec, sender: opts.sender });
  return transcribeWavPayload(payload, opts.config);
}

/**
 * 文件 → 转写（issue #1 M4）。agent tool transcribe_audio_file 用。
 *
 * 流程：
 *   1. 解析 filePath（绝对 / ~ / workspace 相对都支持），fs.stat 校验
 *   2. fs.readFile → buffer → base64
 *   3. requestTranscode 让 renderer 用 OfflineAudioContext 转 16k mono WAV
 *   4. transcribeWavPayload 走 provider switch
 *
 * 单文件大小上限 100 MB（防内存炸）。WebAudio 转码内部 fully decoded → memory；
 * 1h 录音 mp3 ~50MB，wav 转完 ~110MB float32 + 13MB int16，OK。再大就限。
 */
export async function transcribeFile(opts: {
  filePath: string;
  sender: WebContents;
  config: AppConfig;
}): Promise<TranscribeResult> {
  const absPath = resolveUserPath(opts.filePath, opts.config.workspaceDir);
  let fileStat: Awaited<ReturnType<typeof stat>>;
  try {
    fileStat = await stat(absPath);
  } catch {
    throw new FileTranscribeError(`找不到文件：${opts.filePath}`);
  }
  if (!fileStat.isFile()) {
    throw new FileTranscribeError(`不是文件：${opts.filePath}`);
  }
  if (fileStat.size > 100 * 1024 * 1024) {
    throw new FileTranscribeError(`文件超过 100 MB（${(fileStat.size / 1024 / 1024).toFixed(1)} MB），请先剪辑或压缩`);
  }

  const buf = await readFile(absPath);
  const audioBase64 = buf.toString('base64');
  const mimeType = mimeForExtension(absPath);

  const transcoded = await requestTranscode({ audioBase64, mimeType, sender: opts.sender });
  const payload: AudioRecordingPayload = {
    audioBase64: transcoded.wavBase64,
    mimeType: 'audio/wav',
    durationMs: transcoded.durationMs,
    pauses: [], // 文件转写没有 pause 时间戳（对应录音才有），算 0
  };
  return transcribeWavPayload(payload, opts.config);
}

/** ~ / 绝对 / workspace 相对 都接：用户视角友好。 */
function resolveUserPath(input: string, workspaceDir: string | null): string {
  let p = input.trim();
  if (p.startsWith('~')) p = p.replace(/^~/, homedir());
  if (isAbsolute(p)) return p;
  if (workspaceDir) return resolve(workspaceDir, p);
  return resolve(p);
}

function mimeForExtension(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.m4a') || lower.endsWith('.mp4')) return 'audio/mp4';
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.webm')) return 'audio/webm';
  if (lower.endsWith('.ogg') || lower.endsWith('.oga')) return 'audio/ogg';
  if (lower.endsWith('.flac')) return 'audio/flac';
  return 'application/octet-stream';
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
    const entry = recordingPending.get(requestId);
    if (!entry) return;
    clearTimeout(entry.timer);
    recordingPending.delete(requestId);
    entry.resolve(payload);
  });

  ipcMain.handle('audio:cancel', (_e, requestId: string, reason: string) => {
    const entry = recordingPending.get(requestId);
    if (!entry) return;
    clearTimeout(entry.timer);
    recordingPending.delete(requestId);
    entry.reject(new RecordingCancelled(reason));
  });

  ipcMain.handle('audio:transcode-complete', (_e, requestId: string, payload: AudioTranscodedPayload) => {
    const entry = transcodePending.get(requestId);
    if (!entry) return;
    clearTimeout(entry.timer);
    transcodePending.delete(requestId);
    entry.resolve(payload);
  });

  ipcMain.handle('audio:transcode-error', (_e, requestId: string, message: string) => {
    const entry = transcodePending.get(requestId);
    if (!entry) return;
    clearTimeout(entry.timer);
    transcodePending.delete(requestId);
    entry.reject(new FileTranscribeError(message));
  });
}
