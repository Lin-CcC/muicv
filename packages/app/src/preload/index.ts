import { contextBridge, ipcRenderer } from 'electron';

import type { AppConfig, ChatMessage, RendererApi } from '../shared/types.ts';

/**
 * 桥接 main ↔ renderer。renderer 通过 window.muicv.* 调用，封装的实质是
 * ipcRenderer.invoke（Promise）+ event channel（流式）。
 */
const api: RendererApi = {
  config: {
    get: () => ipcRenderer.invoke('config:get') as Promise<AppConfig>,
    set: (patch: Partial<AppConfig>) =>
      ipcRenderer.invoke('config:set', patch) as Promise<AppConfig>,
    selectWorkspace: () => ipcRenderer.invoke('config:selectWorkspace') as Promise<string | null>,
  },
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url) as Promise<void>,
    openWorkspace: () => ipcRenderer.invoke('shell:openWorkspace') as Promise<void>,
  },
  agent: {
    chat: (messages: ChatMessage[]) =>
      ipcRenderer.invoke('agent:chat', messages) as Promise<{ channelId: string }>,
    abort: (channelId: string) =>
      ipcRenderer.invoke('agent:abort', channelId) as Promise<void>,
  },
};

contextBridge.exposeInMainWorld('muicv', api);

declare global {
  interface Window {
    muicv: RendererApi;
  }
}
