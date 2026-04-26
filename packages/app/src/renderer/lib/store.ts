import { create } from 'zustand';

import type {
  AppConfig,
  ArtifactRef,
  ChatMessage,
  Conversation,
  ConversationSummary,
  ConversationType,
  Profile,
  SessionInfo,
  ToolCallRecord,
} from '../../shared/types.ts';
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
  createProfileInDocuments: (name: string) => Promise<{ ok: boolean; message?: string | undefined }>;
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

  // -------------------- Conversations --------------------

  /** 当前 profile 下的对话列表（轻量 summary，不含 messages）。 */
  conversations: ConversationSummary[];
  /** 当前激活的 conversation（含 messages）。 */
  activeConversation: Conversation | null;
  /** 加载当前 profile 的对话列表（左栏渲染用）。 */
  loadConversations: () => Promise<void>;
  /** 切到某个 conversation：拉它的完整内容。 */
  switchConversation: (convId: string) => Promise<void>;
  /** 新建对话；自动切到这个新对话。 */
  createConversation: (type: ConversationType, title?: string) => Promise<Conversation>;
  renameConversation: (convId: string, title: string) => Promise<void>;
  removeConversation: (convId: string) => Promise<void>;

  // 对话流操作（作用于 activeConversation.messages）
  pushMessage: (m: ChatMessage) => void;
  appendAssistantText: (id: string, delta: string) => void;
  attachToolCall: (id: string, call: ToolCallRecord) => void;
  updateToolOutput: (id: string, toolCallId: string, output: string) => void;
  attachArtifact: (id: string, artifact: ArtifactRef) => void;
  /** 清空当前 activeConversation 的消息（不删 conversation 本身）。 */
  resetMessages: () => void;

  /** 当前 streaming 的 channelId，none 表示空闲。 */
  activeChannel: string | null;
  setActiveChannel: (c: string | null) => void;

  // -------------------- 三栏 UI 状态 --------------------

  leftCollapsed: boolean;
  rightCollapsed: boolean;
  /** 右栏当前预览的文件绝对路径；null = 右栏关。 */
  rightPanelPath: string | null;
  toggleLeft: () => void;
  toggleRight: () => void;
  openRightPanel: (path: string) => void;
  closeRightPanel: () => void;
};

/** 路由：未登录 → login；已登录 → chat（默认）/ settings（用户主动切）。 */
function routeFor(session: SessionInfo | null, current: View): View {
  if (!session) return 'login';
  if (current === 'login') return 'chat';
  return current;
}

function deriveActiveProfile(cfg: AppConfig): Profile | null {
  if (!cfg.activeProfileId) return null;
  return cfg.profiles.find((p) => p.id === cfg.activeProfileId) ?? null;
}

/** 把一份 conversation 的元数据折叠成 summary（用于更新左栏列表里的某行）。 */
function toSummary(conv: Conversation): ConversationSummary {
  return {
    id: conv.id,
    profileId: conv.profileId,
    type: conv.type,
    title: conv.title,
    createdAt: conv.createdAt,
    updatedAt: conv.updatedAt,
    messageCount: conv.messages.length,
  };
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
    if (r.ok) {
      await get().loadConfig();
      await get().loadConversations();
    }
    return { ok: r.ok, message: r.message };
  },
  createProfilePickFolder: async (name) => {
    const r = await window.muicv.profile.pickFolder(name);
    if (r.ok) {
      await get().loadConfig();
      await get().loadConversations();
    }
    return { ok: r.ok, message: r.message };
  },
  switchProfile: async (id) => {
    const next = await window.muicv.profile.switchTo(id);
    set({ config: next, activeProfile: deriveActiveProfile(next), activeConversation: null });
    await get().loadConversations();
  },
  renameProfile: async (id, name) => {
    const next = await window.muicv.profile.rename(id, name);
    set({ config: next, activeProfile: deriveActiveProfile(next) });
  },
  removeProfile: async (id) => {
    const next = await window.muicv.profile.remove(id);
    set({ config: next, activeProfile: deriveActiveProfile(next), activeConversation: null });
    await get().loadConversations();
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
    set({ activeConversation: null, conversations: [] });
  },

  // -------------------- Conversations --------------------

  conversations: [],
  activeConversation: null,
  loadConversations: async () => {
    const profileId = get().activeProfile?.id;
    if (!profileId) {
      set({ conversations: [] });
      return;
    }
    const list = await window.muicv.conversation.list(profileId);
    set({ conversations: list });
  },
  switchConversation: async (convId) => {
    const profileId = get().activeProfile?.id;
    if (!profileId) return;
    const conv = await window.muicv.conversation.get(profileId, convId);
    // 切对话 = 用户想聊天了，自动从 settings/其他 view 拉回 chat
    set({ activeConversation: conv, view: 'chat' });
  },
  createConversation: async (type, title) => {
    const profileId = get().activeProfile?.id;
    if (!profileId) throw new Error('no-active-profile');
    const conv = await window.muicv.conversation.create({ profileId, type, ...(title ? { title } : {}) });
    // 新建对话 = 用户已经选好类型要开始了，自动切到 chat
    set((st) => ({
      conversations: [toSummary(conv), ...st.conversations],
      activeConversation: conv,
      view: 'chat',
    }));
    return conv;
  },
  renameConversation: async (convId, title) => {
    const profileId = get().activeProfile?.id;
    if (!profileId) return;
    await window.muicv.conversation.rename(profileId, convId, title);
    set((st) => ({
      conversations: st.conversations.map((c) => (c.id === convId ? { ...c, title } : c)),
      activeConversation:
        st.activeConversation?.id === convId ? { ...st.activeConversation, title } : st.activeConversation,
    }));
  },
  removeConversation: async (convId) => {
    const profileId = get().activeProfile?.id;
    if (!profileId) return;
    await window.muicv.conversation.remove(profileId, convId);
    set((st) => ({
      conversations: st.conversations.filter((c) => c.id !== convId),
      activeConversation: st.activeConversation?.id === convId ? null : st.activeConversation,
    }));
  },

  pushMessage: (m) =>
    set((s) => {
      if (!s.activeConversation) return {};
      return {
        activeConversation: { ...s.activeConversation, messages: [...s.activeConversation.messages, m] },
      };
    }),
  appendAssistantText: (id, delta) =>
    set((s) => {
      if (!s.activeConversation) return {};
      return {
        activeConversation: {
          ...s.activeConversation,
          messages: s.activeConversation.messages.map((m) => (m.id === id ? { ...m, content: m.content + delta } : m)),
        },
      };
    }),
  attachToolCall: (id, call) =>
    set((s) => {
      if (!s.activeConversation) return {};
      return {
        activeConversation: {
          ...s.activeConversation,
          messages: s.activeConversation.messages.map((m) =>
            m.id === id ? { ...m, toolCalls: [...(m.toolCalls ?? []), call] } : m,
          ),
        },
      };
    }),
  updateToolOutput: (id, toolCallId, output) =>
    set((s) => {
      if (!s.activeConversation) return {};
      return {
        activeConversation: {
          ...s.activeConversation,
          messages: s.activeConversation.messages.map((m) =>
            m.id === id
              ? {
                  ...m,
                  toolCalls: (m.toolCalls ?? []).map((c) => (c.id === toolCallId ? { ...c, output } : c)),
                }
              : m,
          ),
        },
      };
    }),
  attachArtifact: (id, artifact) =>
    set((s) => {
      if (!s.activeConversation) return {};
      return {
        activeConversation: {
          ...s.activeConversation,
          messages: s.activeConversation.messages.map((m) =>
            m.id === id ? { ...m, artifacts: [...(m.artifacts ?? []), artifact] } : m,
          ),
        },
      };
    }),
  resetMessages: () =>
    set((s) => (s.activeConversation ? { activeConversation: { ...s.activeConversation, messages: [] } } : {})),

  activeChannel: null,
  setActiveChannel: (c) => set({ activeChannel: c }),

  // -------------------- 三栏 UI --------------------

  leftCollapsed: false,
  rightCollapsed: true,
  rightPanelPath: null,
  toggleLeft: () => set((s) => ({ leftCollapsed: !s.leftCollapsed })),
  toggleRight: () => set((s) => ({ rightCollapsed: !s.rightCollapsed })),
  openRightPanel: (path) => set({ rightPanelPath: path, rightCollapsed: false }),
  closeRightPanel: () => set({ rightPanelPath: null, rightCollapsed: true }),
}));

/**
 * 登录态变化后保证有一份 profile + 加载对话列表。
 */
async function ensureProfileAfterLogin(): Promise<void> {
  const cfg = await window.muicv.profile.ensureDefault();
  useAppStore.setState({ config: cfg, activeProfile: deriveActiveProfile(cfg) });
  await useAppStore.getState().loadConversations();
}

export async function bootstrap(): Promise<void> {
  const s = useAppStore.getState();
  await s.refreshSession();
  if (useAppStore.getState().session) {
    await ensureProfileAfterLogin();
  }

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
