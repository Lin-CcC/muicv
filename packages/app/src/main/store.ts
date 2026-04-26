import { randomUUID } from 'node:crypto';

import { safeStorage } from 'electron';
import Store from 'electron-store';

import { type AppConfig, DEFAULT_CONFIG, type Profile } from '../shared/types.ts';

/**
 * 持久化配置 —— profile 列表 / 激活 profile / API base / 模型 / 加密 mui_ key。
 *
 * 多 profile：同一账号下可以管理多份独立简历资料夹（不同岗位 / 共用账号
 * 的家庭成员各一份）。activeProfileId 指向当前在用的那份。
 *
 * Secret 字段（mui_ key）走 electron safeStorage 二次加密：macOS Keychain /
 * Windows DPAPI / Linux libsecret。不可用时退化为 base64（仅 dev）。
 *
 * Migration: 旧版 store 有 workspaceDir 字段（单工作目录），首次升级时
 * 把它转成一份名为"默认"的 profile，再删掉旧字段。
 */

type StoredShape = {
  profiles: Profile[];
  activeProfileId: string | null;
  muicvApiBase: string;
  defaultModel: string;
  /** safeStorage 加密后的 muicv API key（mui_...） */
  muicvApiKeyCipher: string | null;
  /** 用户自带 LLM endpoint（OpenAI 兼容） */
  customLlmBase: string | null;
  /** safeStorage 加密后的自带 LLM key */
  customLlmKeyCipher: string | null;
};

type LegacyShape = StoredShape & {
  /** v1 字段：单工作目录。迁移到 profiles[0]。 */
  workspaceDir?: string | null;
};

const store = new Store<LegacyShape>({
  name: 'muicv-config',
  defaults: {
    profiles: [],
    activeProfileId: null,
    muicvApiBase: DEFAULT_CONFIG.muicvApiBase,
    defaultModel: DEFAULT_CONFIG.defaultModel,
    muicvApiKeyCipher: null,
    customLlmBase: null,
    customLlmKeyCipher: null,
  },
  // electron-store 的 migrations 按版本号执行。projectVersion 从 package.json
  // 读，所以我们只在版本号 >= migration key 时跑一次。这里用 0.0.2 作为引入
  // multi-profile 的版本号。
  migrations: {
    '0.0.2': (s) => {
      const old = s.get('workspaceDir' as keyof LegacyShape) as string | null | undefined;
      const existing = (s.get('profiles') as Profile[] | undefined) ?? [];
      if (typeof old === 'string' && old && existing.length === 0) {
        const p: Profile = {
          id: randomUUID(),
          name: '默认',
          dir: old,
          createdAt: Date.now(),
        };
        s.set('profiles', [p]);
        s.set('activeProfileId', p.id);
      }
      // delete 老字段，避免下次又被识别成"待迁移"
      // electron-store 的 delete 接受任意字符串
      (s as unknown as { delete: (key: string) => void }).delete('workspaceDir');
    },
  },
});

function encrypt(plaintext: string | null): string | null {
  if (plaintext === null) return null;
  if (!safeStorage.isEncryptionAvailable()) {
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

function activeWorkspaceDir(profiles: Profile[], activeId: string | null): string | null {
  if (!activeId) return null;
  return profiles.find((p) => p.id === activeId)?.dir ?? null;
}

export function getConfig(): AppConfig {
  const profiles = store.get('profiles');
  const activeProfileId = store.get('activeProfileId');
  return {
    profiles,
    activeProfileId,
    workspaceDir: activeWorkspaceDir(profiles, activeProfileId),
    muicvApiKey: decrypt(store.get('muicvApiKeyCipher')),
    muicvApiBase: store.get('muicvApiBase'),
    defaultModel: store.get('defaultModel'),
    customLlmBase: store.get('customLlmBase'),
    customLlmKey: decrypt(store.get('customLlmKeyCipher')),
  };
}

/** 只接受非 profile 类的标量字段。Profile 操作走专门的 API。 */
export function patchConfig(
  patch: Partial<Pick<AppConfig, 'muicvApiBase' | 'defaultModel' | 'muicvApiKey' | 'customLlmBase' | 'customLlmKey'>>,
): AppConfig {
  if ('muicvApiBase' in patch && typeof patch.muicvApiBase === 'string') {
    store.set('muicvApiBase', patch.muicvApiBase);
  }
  if ('defaultModel' in patch && typeof patch.defaultModel === 'string') {
    store.set('defaultModel', patch.defaultModel);
  }
  if ('muicvApiKey' in patch) store.set('muicvApiKeyCipher', encrypt(patch.muicvApiKey ?? null));
  if ('customLlmBase' in patch) {
    const v = typeof patch.customLlmBase === 'string' ? patch.customLlmBase.trim() : '';
    store.set('customLlmBase', v ? v : null);
  }
  if ('customLlmKey' in patch) {
    const v = typeof patch.customLlmKey === 'string' ? patch.customLlmKey.trim() : '';
    store.set('customLlmKeyCipher', encrypt(v ? v : null));
  }
  return getConfig();
}

// -------------------- Profile 操作 --------------------

export function listProfiles(): Profile[] {
  return store.get('profiles');
}

export function getActiveProfile(): Profile | null {
  const id = store.get('activeProfileId');
  if (!id) return null;
  return store.get('profiles').find((p) => p.id === id) ?? null;
}

/**
 * 按 dir 幂等：如果已经有 profile 指向同一目录，直接返回那一份（并按需切成 active），
 * 不会再加一份。这样无论是 ensureDefault 的并发调用，还是用户手动新建到已存在
 * 目录，都不会产生重复。
 */
export function addProfile(name: string, dir: string, makeActive = true): Profile {
  const list = store.get('profiles');
  const existing = list.find((p) => p.dir === dir);
  if (existing) {
    if (makeActive) store.set('activeProfileId', existing.id);
    return existing;
  }

  const profile: Profile = {
    id: randomUUID(),
    name: name.trim() || '未命名',
    dir,
    createdAt: Date.now(),
  };
  store.set('profiles', [...list, profile]);
  if (makeActive || list.length === 0) {
    store.set('activeProfileId', profile.id);
  }
  return profile;
}

/**
 * 启动时跑一次：把同 dir 的重复 profile 合并成一份（保留 createdAt 最早的，
 * 如果其中有 active，把 active 切到保留的那份）。给历史脏数据兜底。
 */
export function dedupeProfiles(): void {
  const list = store.get('profiles');
  const seen = new Map<string, Profile>();
  for (const p of list) {
    const prev = seen.get(p.dir);
    if (!prev || p.createdAt < prev.createdAt) {
      seen.set(p.dir, p);
    }
  }
  if (seen.size === list.length) return; // 没重复

  const cleaned = [...seen.values()];
  store.set('profiles', cleaned);

  // active 还在 cleaned 里就保留；不在了就指向 cleaned[0]
  const active = store.get('activeProfileId');
  if (!cleaned.some((p) => p.id === active)) {
    store.set('activeProfileId', cleaned[0]?.id ?? null);
  }
}

export function setActiveProfile(id: string): AppConfig {
  const list = store.get('profiles');
  if (list.some((p) => p.id === id)) {
    store.set('activeProfileId', id);
  }
  return getConfig();
}

export function renameProfile(id: string, name: string): AppConfig {
  const list = store.get('profiles');
  store.set(
    'profiles',
    list.map((p) => (p.id === id ? { ...p, name: name.trim() || p.name } : p)),
  );
  return getConfig();
}

export function removeProfile(id: string): AppConfig {
  const list = store.get('profiles');
  const next = list.filter((p) => p.id !== id);
  store.set('profiles', next);

  const active = store.get('activeProfileId');
  if (active === id) {
    store.set('activeProfileId', next[0]?.id ?? null);
  }
  return getConfig();
}
