import { randomUUID } from 'node:crypto';

import { ipcMain, type WebContents, systemPreferences } from 'electron';

import type { AudioRecordingPayload, AudioRecordingRequest } from '../shared/types.ts';

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
