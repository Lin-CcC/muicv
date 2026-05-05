import { existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';

import { app } from 'electron';
import Store from 'electron-store';

/**
 * 本地 whisper.cpp 引擎 + 模型状态。issue #1 M3 plugin 模式。
 *
 * 文件布局：
 *   <userData>/whisper-engine/
 *     engine/
 *       whisper-cli           （macOS Developer ID 签名，无 quarantine 因为 fetch 下载）
 *       whisper-cli.exe       （Windows）
 *       LICENSE.whisper-cpp
 *       .version              （文本文件，写当前装的 muicv-whisper-engine release tag）
 *     models/
 *       ggml-base.bin
 *       ggml-small.bin
 *
 * 偏好走 electron-store 单独的 namespace（不混进 muicv-config）。
 */

export type ModelName = 'base' | 'small';

export type SttPreference = 'cloud' | 'local-preferred' | 'always-ask';

export type EngineStatus = {
  installed: boolean;
  version: string | null;
  binPath: string | null;
};

export type ModelStatus = {
  name: ModelName;
  installed: boolean;
  /** 已安装的字节数；未安装时给出预期下载大小 */
  bytes: number;
  path: string | null;
};

export type WhisperPluginStatus = {
  engine: EngineStatus;
  models: ModelStatus[];
  preference: SttPreference;
  defaultModel: ModelName;
};

/**
 * HuggingFace ggerganov/whisper.cpp 仓库的官方模型镜像。
 * 模型大小是上游公布值，未安装时给 UI 展示用，安装后用实际文件 size。
 */
export const MODEL_CATALOG: Record<ModelName, { sizeBytes: number; downloadUrl: string; description: string }> = {
  base: {
    sizeBytes: 147_964_211,
    downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
    description: '~140 MB · 中等准确率，CPU 跑得飞快',
  },
  small: {
    sizeBytes: 487_614_752,
    downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin',
    description: '~470 MB · 中英文准确率高，推荐',
  },
};

const ENGINE_DIR = 'whisper-engine';

type StoredShape = {
  preference: SttPreference;
  defaultModel: ModelName;
};

const store = new Store<StoredShape>({
  name: 'muicv-whisper',
  defaults: {
    preference: 'cloud',
    defaultModel: 'base',
  },
});

export function getEngineRoot(): string {
  return join(app.getPath('userData'), ENGINE_DIR);
}

export function getEngineBinDir(): string {
  return join(getEngineRoot(), 'engine');
}

export function getModelsDir(): string {
  return join(getEngineRoot(), 'models');
}

function binFileName(): string {
  return process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli';
}

export function getEngineBinPath(): string {
  return join(getEngineBinDir(), binFileName());
}

export function getModelPath(name: ModelName): string {
  return join(getModelsDir(), `ggml-${name}.bin`);
}

async function readVersion(): Promise<string | null> {
  const file = join(getEngineBinDir(), '.version');
  try {
    const { readFile } = await import('node:fs/promises');
    const content = await readFile(file, 'utf8');
    return content.trim() || null;
  } catch {
    return null;
  }
}

async function getEngineStatus(): Promise<EngineStatus> {
  const binPath = getEngineBinPath();
  if (!existsSync(binPath)) {
    return { installed: false, version: null, binPath: null };
  }
  const version = await readVersion();
  return { installed: true, version, binPath };
}

async function getModelStatus(name: ModelName): Promise<ModelStatus> {
  const path = getModelPath(name);
  if (!existsSync(path)) {
    return { name, installed: false, bytes: MODEL_CATALOG[name].sizeBytes, path: null };
  }
  const s = await stat(path);
  return { name, installed: true, bytes: s.size, path };
}

export async function getStatus(): Promise<WhisperPluginStatus> {
  const [engine, base, small] = await Promise.all([getEngineStatus(), getModelStatus('base'), getModelStatus('small')]);
  return {
    engine,
    models: [base, small],
    preference: store.get('preference'),
    defaultModel: store.get('defaultModel'),
  };
}

export function getPreference(): SttPreference {
  return store.get('preference');
}

export function setPreference(pref: SttPreference): void {
  store.set('preference', pref);
}

export function getDefaultModel(): ModelName {
  return store.get('defaultModel');
}

export function setDefaultModel(name: ModelName): void {
  store.set('defaultModel', name);
}
