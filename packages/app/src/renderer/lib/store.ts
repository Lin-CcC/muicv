import { create } from 'zustand';

import type { AppConfig, ChatMessage, ToolCallRecord } from '../../shared/types.ts';
import { DEFAULT_CONFIG } from '../../shared/types.ts';

type View = 'chat' | 'settings';

type AppStore = {
  view: View;
  setView: (v: View) => void;

  config: AppConfig;
  configLoaded: boolean;
  loadConfig: () => Promise<void>;
  patchConfig: (patch: Partial<AppConfig>) => Promise<void>;
  selectWorkspace: () => Promise<void>;

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

export const useAppStore = create<AppStore>((set) => ({
  view: 'chat',
  setView: (v) => set({ view: v }),

  config: DEFAULT_CONFIG,
  configLoaded: false,
  loadConfig: async () => {
    const cfg = await window.muicv.config.get();
    set({ config: cfg, configLoaded: true });
    if (!cfg.workspaceDir || !cfg.muicvApiKey) set({ view: 'settings' });
  },
  patchConfig: async (patch) => {
    const next = await window.muicv.config.set(patch);
    set({ config: next });
  },
  selectWorkspace: async () => {
    const dir = await window.muicv.config.selectWorkspace();
    if (dir) {
      const next = await window.muicv.config.get();
      set({ config: next });
    }
  },

  messages: [],
  pushMessage: (m) => set((s) => ({ messages: [...s.messages, m] })),
  appendAssistantText: (id, delta) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, content: m.content + delta } : m)),
    })),
  attachToolCall: (id, call) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, toolCalls: [...(m.toolCalls ?? []), call] } : m,
      ),
    })),
  updateToolOutput: (id, toolCallId, output) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id
          ? {
              ...m,
              toolCalls: (m.toolCalls ?? []).map((c) =>
                c.id === toolCallId ? { ...c, output } : c,
              ),
            }
          : m,
      ),
    })),
  resetMessages: () => set({ messages: [] }),

  activeChannel: null,
  setActiveChannel: (c) => set({ activeChannel: c }),
}));
