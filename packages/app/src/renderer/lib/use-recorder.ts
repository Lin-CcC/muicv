import { useEffect, useRef, useState } from 'react';

import type { AudioRecordingPayload, AudioRecordingRequest } from '../../shared/types.ts';
import { encodeWav16kMono } from './wav-encoder.ts';

/**
 * 通用录音 hook：负责 getUserMedia / MediaRecorder / 静音检测 / 限时停 / WAV 转码。
 *
 * 不耦合任何 UI，也不直接调 IPC——通过 onComplete/onCancel/onError 把结果交给调用方，
 * 让"内嵌 chat-input-bar"和"未来其他场景"都能复用。
 *
 * 流程对应 issue #1 M2 的录音 dialog 原版：
 *   1. start(req) → getUserMedia → MediaRecorder(webm/opus) + AnalyserNode RMS
 *   2. 每 100ms 采 RMS；静音 ≥ 1.5s 记一段 pause；静音 ≥ 3s 自动 stopRecording
 *   3. recorder.onstop → blob → 16k mono WAV → base64 → onComplete(req, payload)
 *   4. 用户点取消 / 准备阶段错误 → onCancel / onError
 */

const SILENCE_RMS_THRESHOLD = 0.02;
const PAUSE_MIN_MS = 1500;
const AUTO_STOP_SILENCE_MS = 3000;
const RMS_SAMPLE_INTERVAL_MS = 100;

export const RECORDER_AUTO_STOP_SILENCE_MS = AUTO_STOP_SILENCE_MS;

export type RecorderPhase = 'idle' | 'preparing' | 'recording' | 'finishing' | 'error';

export type UseRecorderOptions = {
  onComplete: (req: AudioRecordingRequest, payload: AudioRecordingPayload) => void;
  onCancel: (req: AudioRecordingRequest, reason: string) => void;
  onError: (req: AudioRecordingRequest, reason: string) => void;
};

export type RecorderApi = {
  active: AudioRecordingRequest | null;
  phase: RecorderPhase;
  elapsedMs: number;
  rms: number;
  errorMsg: string;
  start: (req: AudioRecordingRequest) => Promise<void>;
  finish: () => void;
  cancel: (reason: string) => void;
};

export function useRecorder(opts: UseRecorderOptions): RecorderApi {
  const [active, setActive] = useState<AudioRecordingRequest | null>(null);
  const [phase, setPhase] = useState<RecorderPhase>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [rms, setRms] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  // 定时器闭包要读最新 phase / active，不能走 React state 闭包（会停在 start() 时刻的旧值）
  const phaseRef = useRef<RecorderPhase>('idle');
  const activeRef = useRef<AudioRecordingRequest | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const pausesRef = useRef<Array<[number, number]>>([]);
  const silenceStartRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);

  const rmsTimerRef = useRef<number | null>(null);
  const tickTimerRef = useRef<number | null>(null);
  const limitTimerRef = useRef<number | null>(null);

  function setPhaseBoth(next: RecorderPhase): void {
    phaseRef.current = next;
    setPhase(next);
  }

  function setActiveBoth(next: AudioRecordingRequest | null): void {
    activeRef.current = next;
    setActive(next);
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
    const tracks = streamRef.current?.getTracks() ?? [];
    for (const t of tracks) t.stop();
    streamRef.current = null;
    void audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    analyserRef.current = null;
    recorderRef.current = null;
  }

  // 组件卸载兜底清理
  // biome-ignore lint/correctness/useExhaustiveDependencies: 只在卸载时跑；cleanup 内部全部走 ref，无需入 deps
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  async function start(request: AudioRecordingRequest): Promise<void> {
    setActiveBoth(request);
    setPhaseBoth('preparing');
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
      setPhaseBoth('error');
      optsRef.current.onError(request, `mic-permission-denied: ${msg}`);
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

    startedAtRef.current = Date.now();
    setPhaseBoth('recording');
    recorder.start();

    tickTimerRef.current = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAtRef.current);
    }, 200);

    rmsTimerRef.current = window.setInterval(() => {
      const a = analyserRef.current;
      if (!a) return;
      const value = sampleRms(a);
      setRms(value);
      const now = Date.now() - startedAtRef.current;
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
    if (phaseRef.current !== 'recording') return;
    setPhaseBoth('finishing');
    clearTimers();
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
  }

  async function finalizeRecording(request: AudioRecordingRequest): Promise<void> {
    const durationMs = Date.now() - startedAtRef.current;

    // 收尾：如果停时还在静音段中，把它也算一段 pause
    if (silenceStartRef.current != null) {
      const dur = durationMs - silenceStartRef.current;
      if (dur >= PAUSE_MIN_MS) pausesRef.current.push([silenceStartRef.current, durationMs]);
      silenceStartRef.current = null;
    }

    const recordedMime = recorderRef.current?.mimeType ?? 'audio/webm';
    const recordedBlob = new Blob(chunksRef.current, { type: recordedMime });

    // 转 16kHz mono WAV：whisper.cpp 强制要求；云端 Whisper 也能吃；统一一份格式。
    let wavBlob: Blob;
    try {
      wavBlob = await encodeWav16kMono(recordedBlob);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(`音频转码失败：${msg}`);
      setPhaseBoth('error');
      optsRef.current.onError(request, `encode-failed: ${msg}`);
      cleanup();
      return;
    }

    let audioBase64: string;
    try {
      audioBase64 = await blobToBase64(wavBlob);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(`录音编码失败：${msg}`);
      setPhaseBoth('error');
      optsRef.current.onError(request, `encode-failed: ${msg}`);
      cleanup();
      return;
    }

    const payload: AudioRecordingPayload = {
      audioBase64,
      mimeType: 'audio/wav',
      durationMs,
      pauses: pausesRef.current.slice(),
    };
    optsRef.current.onComplete(request, payload);
    cleanup();
    setActiveBoth(null);
    setPhaseBoth('idle');
  }

  function cancel(reason: string): void {
    const request = activeRef.current;
    clearTimers();
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      // 别让 onstop 再走 finalize；这是用户的"放弃"路径
      recorder.onstop = null;
      recorder.stop();
    }
    cleanup();
    if (request) optsRef.current.onCancel(request, reason);
    setActiveBoth(null);
    setPhaseBoth('idle');
  }

  return {
    active,
    phase,
    elapsedMs,
    rms,
    errorMsg,
    start,
    finish: stopRecording,
    cancel,
  };
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
