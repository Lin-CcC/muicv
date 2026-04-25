import { create } from 'zustand';

import type { AppConfig, ChatMessage } from '../../shared/types.ts';
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
  resetMessages: () => void;
};

export const useAppStore = create<AppStore>((set, get) => ({
  view: 'chat',
  setView: (v) => set({ view: v }),

  config: DEFAULT_CONFIG,
  configLoaded: false,
  loadConfig: async () => {
    const cfg = await window.muicv.config.get();
    set({ config: cfg, configLoaded: true });
    // 配置缺关键字段时直接进 settings 引导
    if (!cfg.workspaceDir || !cfg.muirouterKey) set({ view: 'settings' });
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
  resetMessages: () => set({ messages: [] }),
}));
