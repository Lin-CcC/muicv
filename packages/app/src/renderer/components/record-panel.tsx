import { type ReactElement, useEffect, useRef, useState } from 'react';

import type { AudioRecordingPayload, AudioRecordingRequest } from '../../shared/types.ts';

/**
 * 模拟面试 / 录音复盘的录音面板。issue #1 M2。
 *
 * 流程：
 *   1. 监听 muicv.audio.onRecordingRequest（main 端 agent tool 触发）
 *   2. 弹全屏遮罩，getUserMedia → MediaRecorder 录 webm/opus
 *   3. 同步用 AudioContext + AnalyserNode 算 RMS：
 *      - 静音 ≥ 1.5s 记一段 pause
 *      - 静音 ≥ 3s 自动停止
 *   4. 录完 blob → base64 → muicv.audio.complete(requestId, payload)
 *
 * 用户中途按"完成" / "取消"也走 complete / cancel。
 */

const SILENCE_RMS_THRESHOLD = 0.02;
const PAUSE_MIN_MS = 1500;
const AUTO_STOP_SILENCE_MS = 3000;
const RMS_SAMPLE_INTERVAL_MS = 100;

type Phase = 'idle' | 'preparing' | 'recording' | 'finishing' | 'error';

type RecordingState = {
  request: AudioRecordingRequest;
  startedAt: number;
};

export function RecordPanel(): ReactElement | null {
  const [active, setActive] = useState<RecordingState | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [rms, setRms] = useState<number>(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const pausesRef = useRef<Array<[number, number]>>([]);
  const silenceStartRef = useRef<number | null>(null);
  const rmsTimerRef = useRef<number | null>(null);
  const tickTimerRef = useRef<number | null>(null);
  const limitTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const unsub = window.muicv.audio.onRecordingRequest((req) => {
      void start(req);
    });
    return () => {
      unsub();
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function start(request: AudioRecordingRequest): Promise<void> {
    setActive({ request, startedAt: Date.now() });
    setPhase('preparing');
    setErrorMsg('');
    setElapsedMs(0);
    setRms(0);
    chunksRef.current = [];
    pausesRef.current = [];
    silenceStartRef.current = null;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(`获取麦克风失败：${msg}`);
      setPhase('error');
      void window.muicv.audio.cancel(request.requestId, `mic-permission-denied: ${msg}`);
      return;
    }
    streamRef.current = stream;

    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    recorderRef.current = recorder;
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      void finalizeRecording(request);
    };

    const audioCtx = new AudioContext();
    audioCtxRef.current = audioCtx;
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    analyserRef.current = analyser;

    const startedAt = Date.now();
    setActive({ request, startedAt });
    setPhase('recording');
    recorder.start();

    tickTimerRef.current = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 200);

    rmsTimerRef.current = window.setInterval(() => {
      const value = sampleRms(analyser);
      setRms(value);
      const now = Date.now() - startedAt;
      if (value < SILENCE_RMS_THRESHOLD) {
        if (silenceStartRef.current == null) silenceStartRef.current = now;
        const silenceDur = now - silenceStartRef.current;
        if (silenceDur >= AUTO_STOP_SILENCE_MS && now > AUTO_STOP_SILENCE_MS + 500) {
          stopRecording();
        }
      } else if (silenceStartRef.current != null) {
        const silenceDur = now - silenceStartRef.current;
        if (silenceDur >= PAUSE_MIN_MS) {
          pausesRef.current.push([silenceStartRef.current, now]);
        }
        silenceStartRef.current = null;
      }
    }, RMS_SAMPLE_INTERVAL_MS);

    limitTimerRef.current = window.setTimeout(() => {
      stopRecording();
    }, Math.max(5, request.durationLimitSec) * 1000);
  }

  function stopRecording(): void {
    if (phase !== 'recording') return;
    setPhase('finishing');
    clearTimers();
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
  }

  async function finalizeRecording(request: AudioRecordingRequest): Promise<void> {
    const startedAt = active?.startedAt ?? Date.now();
    const durationMs = Date.now() - startedAt;

    // 收尾：如果停时还在静音段中，把它也算一段 pause
    if (silenceStartRef.current != null) {
      const dur = durationMs - silenceStartRef.current;
      if (dur >= PAUSE_MIN_MS) pausesRef.current.push([silenceStartRef.current, durationMs]);
      silenceStartRef.current = null;
    }

    const mimeType = recorderRef.current?.mimeType ?? 'audio/webm';
    const blob = new Blob(chunksRef.current, { type: mimeType });

    let audioBase64: string;
    try {
      audioBase64 = await blobToBase64(blob);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(`录音编码失败：${msg}`);
      setPhase('error');
      void window.muicv.audio.cancel(request.requestId, `encode-failed: ${msg}`);
      cleanup();
      return;
    }

    const payload: AudioRecordingPayload = {
      audioBase64,
      mimeType,
      durationMs,
      pauses: pausesRef.current.slice(),
    };
    void window.muicv.audio.complete(request.requestId, payload);
    cleanup();
    setActive(null);
    setPhase('idle');
  }

  function userCancel(): void {
    const requestId = active?.request.requestId;
    clearTimers();
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      // 注意不让 onstop 调 finalize：先解绑
      recorder.onstop = null;
      recorder.stop();
    }
    cleanup();
    if (requestId) void window.muicv.audio.cancel(requestId, 'user-cancel');
    setActive(null);
    setPhase('idle');
  }

  function clearTimers(): void {
    if (tickTimerRef.current) {
      clearInterval(tickTimerRef.current);
      tickTimerRef.current = null;
    }
    if (rmsTimerRef.current) {
      clearInterval(rmsTimerRef.current);
      rmsTimerRef.current = null;
    }
    if (limitTimerRef.current) {
      clearTimeout(limitTimerRef.current);
      limitTimerRef.current = null;
    }
  }

  function cleanup(): void {
    clearTimers();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    analyserRef.current = null;
    recorderRef.current = null;
  }

  if (!active && phase === 'idle') return null;

  const limitSec = active?.request.durationLimitSec ?? 180;
  const elapsedSec = Math.floor(elapsedMs / 1000);
  const remainSec = Math.max(0, limitSec - elapsedSec);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-[420px] rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        <h2 className="text-lg font-semibold mb-2">模拟面试录音</h2>
        <p className="text-sm text-zinc-500 mb-4">
          {phase === 'preparing' && '准备录音…'}
          {phase === 'recording' && `已录 ${formatTime(elapsedMs)} / 最长 ${formatTime(limitSec * 1000)}`}
          {phase === 'finishing' && '正在保存…'}
          {phase === 'error' && (errorMsg || '录音失败')}
        </p>

        <div className="h-16 w-full rounded-md bg-zinc-100 dark:bg-zinc-800 mb-4 overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-100"
            style={{ width: `${Math.min(100, rms * 500)}%` }}
          />
        </div>

        <div className="flex justify-between text-xs text-zinc-400 mb-4">
          <span>静音自动停 {AUTO_STOP_SILENCE_MS / 1000}s</span>
          <span>剩余 {remainSec}s</span>
        </div>

        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={userCancel}
            className="px-4 py-2 rounded-md text-sm border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            取消
          </button>
          {phase === 'recording' && (
            <button
              type="button"
              onClick={stopRecording}
              className="px-4 py-2 rounded-md text-sm bg-blue-600 text-white hover:bg-blue-700"
            >
              完成
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function pickMimeType(): string | null {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) return c;
  }
  return null;
}

function sampleRms(analyser: AnalyserNode): number {
  const buf = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(buf);
  let sumSquares = 0;
  for (let i = 0; i < buf.length; i++) {
    const v = buf[i] ?? 0;
    sumSquares += v * v;
  }
  return Math.sqrt(sumSquares / buf.length);
}

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('blob read failed'));
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('reader.result not string'));
        return;
      }
      // result 是 "data:<mime>;base64,<payload>"，剥掉前缀
      const idx = result.indexOf(',');
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}
