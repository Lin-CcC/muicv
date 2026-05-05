import { contextBridge, ipcRenderer } from 'electron';

import type {
  AgentChunk,
  AppConfig,
  AudioRecordingPayload,
  AudioRecordingRequest,
  ChatMessage,
  Conversation,
  ConversationSummary,
  ConversationType,
  MuirouterLinkResult,
  Profile,
  RendererApi,
  SessionCheckResult,
} from '../shared/types.ts';

ipcRenderer.on('agent:chunk', (_e, channelId: string, payload: AgentChunk) => {
  window.dispatchEvent(new CustomEvent(`muicv:agent:chunk:${channelId}`, { detail: payload }));
});

type ProfileResult = { ok: boolean; profile?: Profile; message?: string };

const api: RendererApi = {
  config: {
    get: () => ipcRenderer.invoke('config:get') as Promise<AppConfig>,
    set: (patch) => ipcRenderer.invoke('config:set', patch) as Promise<AppConfig>,
  },
  profile: {
    create: (opts) => ipcRenderer.invoke('profile:create', opts) as Promise<ProfileResult>,
    createInDocuments: (name) => ipcRenderer.invoke('profile:createInDocuments', name) as Promise<ProfileResult>,
    pickFolder: (name) => ipcRenderer.invoke('profile:pickFolder', name) as Promise<ProfileResult>,
    switchTo: (id) => ipcRenderer.invoke('profile:switchTo', id) as Promise<AppConfig>,
    rename: (id, name) => ipcRenderer.invoke('profile:rename', id, name) as Promise<AppConfig>,
    remove: (id) => ipcRenderer.invoke('profile:remove', id) as Promise<AppConfig>,
    openInFinder: (id) => ipcRenderer.invoke('profile:openInFinder', id) as Promise<void>,
    ensureDefault: () => ipcRenderer.invoke('profile:ensureDefault') as Promise<AppConfig>,
  },
  session: {
    check: () => ipcRenderer.invoke('session:check') as Promise<SessionCheckResult>,
    verify: (candidateKey: string) => ipcRenderer.invoke('session:verify', candidateKey) as Promise<SessionCheckResult>,
    login: (candidateKey: string) => ipcRenderer.invoke('session:login', candidateKey) as Promise<SessionCheckResult>,
    logout: () => ipcRenderer.invoke('session:logout') as Promise<void>,
    beginConnect: () => ipcRenderer.invoke('session:beginConnect') as Promise<{ ok: boolean; message?: string }>,
    onAutoLogin: (handler: (result: SessionCheckResult) => void) => {
      const listener = (_e: Electron.IpcRendererEvent, result: SessionCheckResult) => handler(result);
      ipcRenderer.on('session:autoLogin', listener);
      return () => ipcRenderer.removeListener('session:autoLogin', listener);
    },
    beginLinkMuirouter: () =>
      ipcRenderer.invoke('session:beginLinkMuirouter') as Promise<{ ok: boolean; message?: string }>,
    onMuirouterLinked: (handler: (result: MuirouterLinkResult) => void) => {
      const listener = (_e: Electron.IpcRendererEvent, result: MuirouterLinkResult) => handler(result);
      ipcRenderer.on('muirouter:linked', listener);
      return () => ipcRenderer.removeListener('muirouter:linked', listener);
    },
  },
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url) as Promise<void>,
    openWorkspace: () => ipcRenderer.invoke('shell:openWorkspace') as Promise<void>,
  },
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion') as Promise<string>,
  },
  agent: {
    chat: (opts) => ipcRenderer.invoke('agent:chat', opts) as Promise<{ channelId: string }>,
    abort: (channelId: string) => ipcRenderer.invoke('agent:abort', channelId) as Promise<void>,
  },
  conversation: {
    list: (profileId) => ipcRenderer.invoke('conversation:list', profileId) as Promise<ConversationSummary[]>,
    get: (profileId, convId) =>
      ipcRenderer.invoke('conversation:get', profileId, convId) as Promise<Conversation | null>,
    create: (opts) => ipcRenderer.invoke('conversation:create', opts) as Promise<Conversation>,
    rename: (profileId, convId, title) =>
      ipcRenderer.invoke('conversation:rename', profileId, convId, title) as Promise<void>,
    remove: (profileId, convId) => ipcRenderer.invoke('conversation:remove', profileId, convId) as Promise<void>,
  },
  fs: {
    read: (path) => ipcRenderer.invoke('fs:read', path) as Promise<string | null>,
    listDir: (path) =>
      ipcRenderer.invoke('fs:listDir', path) as Promise<Array<{
        name: string;
        path: string;
        isDirectory: boolean;
      }> | null>,
    showInFolder: (path) => ipcRenderer.invoke('fs:showInFolder', path) as Promise<void>,
  },
  audio: {
    onRecordingRequest: (handler: (req: AudioRecordingRequest) => void) => {
      const listener = (_e: Electron.IpcRendererEvent, req: AudioRecordingRequest) => handler(req);
      ipcRenderer.on('audio:recording-request', listener);
      return () => ipcRenderer.removeListener('audio:recording-request', listener);
    },
    complete: (requestId: string, payload: AudioRecordingPayload) =>
      ipcRenderer.invoke('audio:complete', requestId, payload) as Promise<void>,
    cancel: (requestId: string, reason: string) =>
      ipcRenderer.invoke('audio:cancel', requestId, reason) as Promise<void>,
  },
};

contextBridge.exposeInMainWorld('muicv', api);

declare global {
  interface Window {
    muicv: RendererApi;
  }
}
