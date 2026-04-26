import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { BrowserWindow, app, dialog, ipcMain, shell } from 'electron';

import type { AppConfig, ChatMessage } from '../shared/types.ts';
import { abortRun, runAgent } from './agent/runtime.ts';
import { beginConnect, handleDeepLink, registerScheme, setMainWindowGetter } from './deep-link.ts';
import { checkSession as runCheckSession, loginWithKey, logout as runLogout, verifyCandidateKey } from './session.ts';
import { getConfig, setConfig } from './store.ts';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const isDev = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;

// -------------------- Single instance（Windows/Linux deep-link 必需） --------------------

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    // 已运行时再次启动（含 muicv://... 唤起）—— 把 deep-link arg 喂给 handler
    const link = argv.find((a) => typeof a === 'string' && a.startsWith('muicv://'));
    if (link) void handleDeepLink(link);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// -------------------- macOS deep-link --------------------

app.on('open-url', (event, url) => {
  event.preventDefault();
  void handleDeepLink(url);
});

// 必须在 app.ready 之前注册 scheme（Win/Linux 需要 path arg）
registerScheme();
setMainWindowGetter(() => mainWindow);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 880,
    minHeight: 560,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#fdfaf2',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
    mainWindow.webContents.openDevTools({ mode: 'right' });
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// -------------------- IPC --------------------

ipcMain.handle('config:get', (): AppConfig => getConfig());

ipcMain.handle('config:set', (_event, patch: Partial<AppConfig>): AppConfig => setConfig(patch));

ipcMain.handle('config:selectWorkspace', async (): Promise<string | null> => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择 Mui简历的工作目录',
    properties: ['openDirectory', 'createDirectory'],
    message: '所有简历素材会以 Markdown 存在该目录下的 .claude/muicv/ 里。',
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const dir = result.filePaths[0] ?? null;
  if (dir) setConfig({ workspaceDir: dir });
  return dir;
});

// -------------------- session --------------------

ipcMain.handle('session:check', () => runCheckSession());
ipcMain.handle('session:verify', (_e, candidate: string) => verifyCandidateKey(candidate));
ipcMain.handle('session:login', (_e, candidate: string) => loginWithKey(candidate));
ipcMain.handle('session:logout', () => {
  runLogout();
});
ipcMain.handle('session:beginConnect', () => beginConnect());

// -------------------- shell --------------------

ipcMain.handle('shell:openExternal', async (_event, url: string) => {
  if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
    await shell.openExternal(url);
  }
});

ipcMain.handle('shell:openWorkspace', async () => {
  const cfg = getConfig();
  if (cfg.workspaceDir) await shell.openPath(cfg.workspaceDir);
});

/**
 * agent:chat —— 启动一次 agent 流式 run，立刻返回 channelId；
 * runtime 通过 webContents.send('agent:chunk', channelId, payload) 推增量。
 */
ipcMain.handle('agent:chat', async (event, messages: ChatMessage[]): Promise<{ channelId: string }> => {
  const channelId = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const cfg = getConfig();
  // 不 await：让 run 后台跑，我们靠 chunk event 给 renderer 反馈
  runAgent(channelId, messages, cfg, event.sender).catch((err) => {
    console.error('[agent:chat] runtime crashed', err);
  });
  return { channelId };
});

ipcMain.handle('agent:abort', async (_event, channelId: string) => {
  abortRun(channelId);
});

// -------------------- App lifecycle --------------------

app.whenReady().then(() => {
  createWindow();

  // app 启动时若 argv 里有 muicv:// （Windows/Linux 冷启动场景），消化掉
  const cold = process.argv.find((a) => typeof a === 'string' && a.startsWith('muicv://'));
  if (cold) {
    // 等 renderer 起来再处理（不然 webContents.send 没人收）
    mainWindow?.webContents.once('did-finish-load', () => {
      void handleDeepLink(cold);
    });
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
