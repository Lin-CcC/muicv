import { create } from 'zustand';

import type { AppConfig, ChatMessage, SessionInfo, ToolCallRecord } from '../../shared/types.ts';
import { DEFAULT_CONFIG } from '../../shared/types.ts';

type View = 'login' | 'onboarding' | 'chat' | 'settings';

type AppStore = {
  view: View;
  setView: (v: View) => void;

  /** 启动期，等 loadConfig + checkSession 跑完前 true */
  bootstrapping: boolean;

  config: AppConfig;
  loadConfig: () => Promise<void>;
  patchConfig: (patch: Partial<AppConfig>) => Promise<void>;
  selectWorkspace: () => Promise<void>;

  /** 已登录的 session，未登录 / 未验证 = null */
  session: SessionInfo | null;
  setSession: (s: SessionInfo | null) => void;
  /** 启动 / 配置变化时调一次 /me 校验 + 决定路由 */
  refreshSession: () => Promise<void>;
  logout: () => Promise<void>;

  messages: ChatMessage[];
  pushMessage: (m: ChatMessage) => void;
  appendAssistantText: (id: string, delta: string) => void;
  attachToolCall: (id: string, call: ToolCallRecord) => void;
  updateToolOutput: (id: string, toolCallId: string, output: string) => void;
  resetMessages: () => void;

  /** 当前 streaming 的 channelId，none 表示空闲。 */
  activeChannel: string | null;
  setActiveChannel: (c: string | null) => void;
};

/**
 * 路由决策（每次 session / config 变化后调）：
 *   未登录 → login
 *   登录 + 没工作目录 → onboarding
 *   登录 + 有工作目录 → chat（除非用户主动开了 settings）
 */
function routeFor(session: SessionInfo | null, cfg: AppConfig, current: View): View {
  if (!session) return 'login';
  if (!cfg.workspaceDir) return 'onboarding';
  if (current === 'login' || current === 'onboarding') return 'chat';
  return current; // 已经在 chat / settings 不强制切
}

export const useAppStore = create<AppStore>((set, get) => ({
  view: 'login',
  setView: (v) => set({ view: v }),

  bootstrapping: true,

  config: DEFAULT_CONFIG,
  loadConfig: async () => {
    const cfg = await window.muicv.config.get();
    set({ config: cfg });
  },
  patchConfig: async (patch) => {
    const next = await window.muicv.config.set(patch);
    set({ config: next });
    set((s) => ({ view: routeFor(s.session, next, s.view) }));
  },
  selectWorkspace: async () => {
    const dir = await window.muicv.config.selectWorkspace();
    if (dir) {
      const next = await window.muicv.config.get();
      set({ config: next });
      set((s) => ({ view: routeFor(s.session, next, s.view) }));
    }
  },

  session: null,
  setSession: (s) => {
    set({ session: s });
    set((st) => ({ view: routeFor(s, st.config, st.view) }));
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

// bootstrap：app 启动后调一次
export async function bootstrap(): Promise<void> {
  const s = useAppStore.getState();
  await s.refreshSession();

  // 订阅 OAuth 自动登录（main 进程从 muicv:// callback 拿到 key 后会推过来）
  window.muicv.session.onAutoLogin(async (result) => {
    if (result.status === 'ok') {
      // loginWithKey 已经把 key 写到 store —— 重新拉一遍 config 确保同步
      await useAppStore.getState().loadConfig();
      useAppStore.getState().setSession(result.session);
    } else if (result.status !== 'no-key') {
      // 网页授权失败 / state 不匹配 —— 在 console 留痕，UI 在 LoginView 监听同事件给提示
      console.warn('[auto-login] failed', result);
    }
  });

  useAppStore.setState({ bootstrapping: false });
}
