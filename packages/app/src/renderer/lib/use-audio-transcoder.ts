import { useEffect } from 'react';

import type { AudioTranscodeRequest } from '../../shared/types.ts';
import { encodeWav16kMono } from './wav-encoder.ts';

/**
 * 监听 main 端 transcribe_audio_file 工具发起的转码请求（issue #1 M4）。
 *
 * main 不能直接转码（Node 没 WebAudio），把音频字节通过 IPC 给 renderer，
 * renderer 走同一份 wav-encoder（webm 录音也用它）转 16k mono WAV，回传 base64。
 *
 * 不渲染任何 UI，纯 listener。挂在 app-shell 整个生命周期。
 */
export function useAudioTranscoder() {
  useEffect(() => {
    const unsub = window.muicv.audio.onTranscodeRequest(async (req) => {
      try {
        const wavPayload = await transcode(req);
        await window.muicv.audio.transcodeComplete(req.requestId, wavPayload);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await window.muicv.audio.transcodeError(req.requestId, message || '音频转码失败');
      }
    });
    return unsub;
  }, []);
}

async function transcode(req: AudioTranscodeRequest): Promise<{ wavBase64: string; durationMs: number }> {
  // base64 → Bytes：data URL + fetch 是最稳的方式（避免 atob + String.fromCharCode 大字符串性能问题）
  const sourceBlob = await dataUrlToBlob(
    `data:${req.mimeType || 'application/octet-stream'};base64,${req.audioBase64}`,
  );
  const wavBlob = await encodeWav16kMono(sourceBlob);

  // wav blob 长度（mono 16-bit 16kHz）→ 时长 ms：(bytes - 44 header) / (16000 * 2) * 1000
  const dataBytes = wavBlob.size - 44;
  const durationMs = Math.max(0, Math.round((dataBytes / (16_000 * 2)) * 1000));

  const wavBase64 = await blobToBase64(wavBlob);
  return { wavBase64, durationMs };
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return await res.blob();
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(r.error ?? new Error('blob → base64 失败'));
    r.onloadend = () => {
      const result = r.result;
      if (typeof result !== 'string') {
        reject(new Error('reader.result not string'));
        return;
      }
      const idx = result.indexOf(',');
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    r.readAsDataURL(blob);
  });
}
