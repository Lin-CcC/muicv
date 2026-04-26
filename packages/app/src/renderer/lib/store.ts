import { create } from 'zustand';

import type { AppConfig, ChatMessage, Profile, SessionInfo, ToolCallRecord } from '../../shared/types.ts';
import { DEFAULT_CONFIG } from '../../shared/types.ts';

type View = 'login' | 'chat' | 'settings';

type AppStore = {
  view: View;
  setView: (v: View) => void;

  /** 启动期，等 loadConfig + checkSession + ensureDefaultProfile 跑完前 true */
  bootstrapping: boolean;

  config: AppConfig;
  loadConfig: () => Promise<void>;
  patchConfig: (
    patch: Partial<Pick<AppConfig, 'muicvApiBase' | 'defaultModel' | 'muicvApiKey' | 'customLlmBase' | 'customLlmKey'>>,
  ) => Promise<void>;

  /** 当前激活的 profile（派生）。 */
  activeProfile: Profile | null;
  /** 在 ~/Documents/Mui简历/<name>/ 下自动建一份 profile。返回是否成功。 */
  createProfileInDocuments: (name: string) => Promise<{ ok: boolean; message?: string | undefined }>;
  /** 让用户挑目录后挂成一份 profile。 */
  createProfilePickFolder: (name: string) => Promise<{ ok: boolean; message?: string | undefined }>;
  switchProfile: (id: string) => Promise<void>;
  renameProfile: (id: string, name: string) => Promise<void>;
  removeProfile: (id: string) => Promise<void>;
  openProfileInFinder: (id: string) => Promise<void>;

  /** 已登录的 session，未登录 / 未验证 = null */
  session: SessionInfo | null;
  setSession: (s: SessionInfo | null) => void;
  refreshSession: () => Promise<void>;
  logout: () => Promise<void>;

  messages: ChatMessage[];
  pushMessage: (m: ChatMessage) => void;
  appendAssistantText: (id: string, delta: string) => void;
  attachToolCall: (id: string, call: ToolCallRecord) => void;
  updateToolOutput: (id: string, toolCallId: string, output: string) => void;
  resetMessages: () => void;

  activeChannel: string | null;
  setActiveChannel: (c: string | null) => void;
};

/**
 * 路由：
 *   未登录 → login
 *   已登录 → chat（默认）/ settings（用户主动切）
 *
 * 之前的 onboarding 已删——登录后 main 会保证有一份默认 profile，
 * 用户立刻能开始打字。BYOK / 升级 / 换目录这些都在 settings 里按需操作。
 */
function routeFor(session: SessionInfo | null, current: View): View {
  if (!session) return 'login';
  if (current === 'login') return 'chat';
  return current;
}

function deriveActiveProfile(cfg: AppConfig): Profile | null {
  if (!cfg.activeProfileId) return null;
  return cfg.profiles.find((p) => p.id === cfg.activeProfileId) ?? null;
}

export const useAppStore = create<AppStore>((set, get) => ({
  view: 'login',
  setView: (v) => set({ view: v }),

  bootstrapping: true,

  config: DEFAULT_CONFIG,
  activeProfile: null,
  loadConfig: async () => {
    const cfg = await window.muicv.config.get();
    set({ config: cfg, activeProfile: deriveActiveProfile(cfg) });
  },
  patchConfig: async (patch) => {
    const next = await window.muicv.config.set(patch);
    set({ config: next, activeProfile: deriveActiveProfile(next) });
  },
  createProfileInDocuments: async (name) => {
    const r = await window.muicv.profile.createInDocuments(name);
    if (r.ok) await get().loadConfig();
    return { ok: r.ok, message: r.message };
  },
  createProfilePickFolder: async (name) => {
    const r = await window.muicv.profile.pickFolder(name);
    if (r.ok) await get().loadConfig();
    return { ok: r.ok, message: r.message };
  },
  switchProfile: async (id) => {
    const next = await window.muicv.profile.switchTo(id);
    set({ config: next, activeProfile: deriveActiveProfile(next) });
  },
  renameProfile: async (id, name) => {
    const next = await window.muicv.profile.rename(id, name);
    set({ config: next, activeProfile: deriveActiveProfile(next) });
  },
  removeProfile: async (id) => {
    const next = await window.muicv.profile.remove(id);
    set({ config: next, activeProfile: deriveActiveProfile(next) });
  },
  openProfileInFinder: (id) => window.muicv.profile.openInFinder(id),

  session: null,
  setSession: (s) => {
    set({ session: s });
    set((st) => ({ view: routeFor(s, st.view) }));
  },
  refreshSession: async () => {
    await get().loadConfig();
    const result = await window.muicv.session.check();
    if (result.status === 'ok') {
      get().setSession(result.session);
    } else {
      get().setSession(null);
    }
  },
  logout: async () => {
    await window.muicv.session.logout();
    await get().loadConfig();
    get().setSession(null);
  },

  messages: [],
  pushMessage: (m) => set((s) => ({ messages: [...s.messages, m] })),
  appendAssistantText: (id, delta) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, content: m.content + delta } : m)),
    })),
  attachToolCall: (id, call) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, toolCalls: [...(m.toolCalls ?? []), call] } : m)),
    })),
  updateToolOutput: (id, toolCallId, output) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id
          ? {
              ...m,
              toolCalls: (m.toolCalls ?? []).map((c) => (c.id === toolCallId ? { ...c, output } : c)),
            }
          : m,
      ),
    })),
  resetMessages: () => set({ messages: [] }),

  activeChannel: null,
  setActiveChannel: (c) => set({ activeChannel: c }),
}));

/**
 * 登录态变化（包括 bootstrap 时的首次校验、OAuth 自动登录、手动 login、切换账号）后，
 * 都要保证当前账号至少有一份 profile，没有就在 ~/Documents/Mui简历/默认/ 自动建。
 *
 * 切换 profile 时要清空 messages（不同简历有不同上下文，不该串）。
 */
async function ensureProfileAfterLogin(): Promise<void> {
  const cfg = await window.muicv.profile.ensureDefault();
  useAppStore.setState({ config: cfg, activeProfile: deriveActiveProfile(cfg) });
}

export async function bootstrap(): Promise<void> {
  const s = useAppStore.getState();
  await s.refreshSession();
  if (useAppStore.getState().session) {
    await ensureProfileAfterLogin();
  }

  // OAuth 自动登录回调
  window.muicv.session.onAutoLogin(async (result) => {
    if (result.status === 'ok') {
      await useAppStore.getState().loadConfig();
      useAppStore.getState().setSession(result.session);
      await ensureProfileAfterLogin();
    } else if (result.status !== 'no-key') {
      console.warn('[auto-login] failed', result);
    }
  });

  useAppStore.setState({ bootstrapping: false });
}
