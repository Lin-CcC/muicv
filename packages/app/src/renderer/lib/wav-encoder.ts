/**
 * webm/opus Blob → 16kHz mono PCM WAV Blob（issue #1 M3）。
 *
 * whisper.cpp 强制要求 16kHz mono PCM WAV，不能直接喂 webm。
 * 用浏览器原生 OfflineAudioContext + AudioBuffer：decodeAudioData → 重采样 +
 * 取 mono → 写 WAV header（44 字节）→ 拼成 Blob。
 *
 * 16k mono 16-bit PCM 体积：~32 KB/s（10s 录音 ~320 KB），云端 / 本地都能吃。
 */

const TARGET_SAMPLE_RATE = 16_000;

export async function encodeWav16kMono(input: Blob): Promise<Blob> {
  const arrayBuf = await input.arrayBuffer();

  // OfflineAudioContext(numChannels=1, sampleRate=16000) → 强制 mono + 16k
  // decode 时长度未知，先用 AudioContext 解码拿原始时长，再用 Offline 渲染
  const decodeCtx = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await decodeCtx.decodeAudioData(arrayBuf.slice(0));
  } finally {
    void decodeCtx.close().catch(() => {});
  }

  const targetLength = Math.ceil(decoded.duration * TARGET_SAMPLE_RATE);
  const offline = new OfflineAudioContext(1, targetLength, TARGET_SAMPLE_RATE);
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start(0);
  const rendered = await offline.startRendering();

  const pcm16 = floatToPcm16(rendered.getChannelData(0));
  const wav = wrapWavHeader(pcm16, TARGET_SAMPLE_RATE);
  return new Blob([wav], { type: 'audio/wav' });
}

function floatToPcm16(samples: Float32Array): Int16Array {
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i] ?? 0));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

/** 标准 PCM WAV 文件头（44 字节）+ 数据。固定 mono / 16-bit / sampleRate。 */
function wrapWavHeader(pcm: Int16Array, sampleRate: number): ArrayBuffer {
  const dataBytes = pcm.length * 2;
  const buf = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buf);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // PCM 子块大小
  view.setUint16(20, 1, true); // PCM = 1
  view.setUint16(22, 1, true); // channels = 1
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate = sr * channels * bytesPerSample
  view.setUint16(32, 2, true); // block align = channels * bytesPerSample
  view.setUint16(34, 16, true); // bits per sample
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataBytes, true);

  // 写 PCM 数据
  const pcmBytes = new Uint8Array(buf, 44);
  pcmBytes.set(new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength));
  return buf;
}

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
}
