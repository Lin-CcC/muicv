import { contextBridge, ipcRenderer } from 'electron';

import type { AgentChunk, AppConfig, ChatMessage, RendererApi, SessionCheckResult } from '../shared/types.ts';

/**
 * 注册全局 agent:chunk 转发：每条 chunk 来了就 dispatch 一个
 * `muicv:agent:chunk:<channelId>` CustomEvent 到 window，让 renderer 用
 * addEventListener 订阅自己关心的 channelId。这样不用 contextBridge 暴露
 * 函数 callback。
 */
ipcRenderer.on(
  'agent:chunk',
  (_e, channelId: string, payload: AgentChunk) => {
    window.dispatchEvent(
      new CustomEvent(`muicv:agent:chunk:${channelId}`, { detail: payload }),
    );
  },
);

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
  session: {
    check: () => ipcRenderer.invoke('session:check') as Promise<SessionCheckResult>,
    verify: (candidateKey: string) =>
      ipcRenderer.invoke('session:verify', candidateKey) as Promise<SessionCheckResult>,
    login: (candidateKey: string) =>
      ipcRenderer.invoke('session:login', candidateKey) as Promise<SessionCheckResult>,
    logout: () => ipcRenderer.invoke('session:logout') as Promise<void>,
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
