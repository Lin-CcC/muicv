import { safeStorage } from 'electron';
import Store from 'electron-store';

import { type AppConfig, DEFAULT_CONFIG } from '../shared/types.ts';

/**
 * 持久化配置 —— 大部分字段明文（工作目录、API base URL 等），
 * secret 字段（muirouter / muicv key）走 electron safeStorage 二次加密。
 *
 * safeStorage 在 macOS 用 Keychain、Windows 用 DPAPI、Linux 用 libsecret。
 * 不可用时（比如 dev 环境没初始化）退化为明文，UI 会提示用户。
 */

type StoredShape = {
  workspaceDir: string | null;
  muicvApiBase: string;
  defaultModel: string;
  /** safeStorage 加密后的 muicv API key（mui_...） */
  muicvApiKeyCipher: string | null;
};

const store = new Store<StoredShape>({
  name: 'muicv-config',
  defaults: {
    workspaceDir: null,
    muicvApiBase: DEFAULT_CONFIG.muicvApiBase,
    defaultModel: DEFAULT_CONFIG.defaultModel,
    muicvApiKeyCipher: null,
  },
});

function encrypt(plaintext: string | null): string | null {
  if (plaintext === null) return null;
  if (!safeStorage.isEncryptionAvailable()) {
    // 退化：直接 base64（不安全，但至少不明文存在 disk 上）
    return Buffer.from(plaintext, 'utf8').toString('base64');
  }
  return safeStorage.encryptString(plaintext).toString('base64');
}

function decrypt(cipher: string | null): string | null {
  if (cipher === null) return null;
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      return Buffer.from(cipher, 'base64').toString('utf8');
    }
    return safeStorage.decryptString(Buffer.from(cipher, 'base64'));
  } catch {
    return null;
  }
}

export function getConfig(): AppConfig {
  return {
    workspaceDir: store.get('workspaceDir'),
    muicvApiKey: decrypt(store.get('muicvApiKeyCipher')),
    muicvApiBase: store.get('muicvApiBase'),
    defaultModel: store.get('defaultModel'),
  };
}

export function setConfig(patch: Partial<AppConfig>): AppConfig {
  if ('workspaceDir' in patch) store.set('workspaceDir', patch.workspaceDir ?? null);
  if ('muicvApiBase' in patch && typeof patch.muicvApiBase === 'string') {
    store.set('muicvApiBase', patch.muicvApiBase);
  }
  if ('defaultModel' in patch && typeof patch.defaultModel === 'string') {
    store.set('defaultModel', patch.defaultModel);
  }
  if ('muicvApiKey' in patch) store.set('muicvApiKeyCipher', encrypt(patch.muicvApiKey ?? null));
  return getConfig();
}
