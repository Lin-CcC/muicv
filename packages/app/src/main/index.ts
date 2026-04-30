import { mkdir, readFile, readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { BrowserWindow, app, dialog, ipcMain, protocol, shell } from 'electron';

import type { AppConfig, ChatMessage, ConversationType, Profile } from '../shared/types.ts';
import { abortRun, runAgent } from './agent/runtime.ts';
import {
  createConversation,
  deleteConversation,
  getConversation,
  listConversations,
  renameConversation,
} from './conversations.ts';
import { beginConnect, handleDeepLink, registerScheme, setMainWindowGetter } from './deep-link.ts';
import { checkSession as runCheckSession, loginWithKey, logout as runLogout, verifyCandidateKey } from './session.ts';
import {
  addProfile,
  dedupeProfiles,
  getConfig,
  listProfiles,
  patchConfig,
  removeProfile,
  renameProfile,
  setActiveProfile,
} from './store.ts';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const isDev = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;

// dev: BrowserWindow icon 在 macOS 被忽略，下面 whenReady 还会调 dock.setIcon。
// prod: macOS 走 .app bundle 的 icns，无需在这里设置。
const devIconPath = join(__dirname, '../../build/icon.png');

// -------------------- Single instance（Windows/Linux deep-link 必需） --------------------

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const link = argv.find((a) => typeof a === 'string' && a.startsWith('muicv://'));
    if (link) void handleDeepLink(link);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

app.on('open-url', (event, url) => {
  event.preventDefault();
  void handleDeepLink(url);
});

registerScheme();
setMainWindowGetter(() => mainWindow);

// muicv-pdf:// —— renderer 用 <iframe> 给本地 PDF 走 Chromium 内置 viewer 渲染。
// 必须在 app.ready 之前 registerSchemesAsPrivileged，handler 在 whenReady 里 register。
// stream: true 让大 PDF 可流式返回；standard: true 让 URL parser 走标准 host/path 解析。
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'muicv-pdf',
    privileges: {
      standard: true,
      secure: true,
      stream: true,
      supportFetchAPI: false,
    },
  },
]);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 880,
    minHeight: 560,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#fdfaf2',
    ...(isDev ? { icon: devIconPath } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      // Chromium 内置 PDF viewer 是个 plugin，Electron 默认 plugins=false 时
      // <iframe src="muicv-pdf://..."> 会静默白屏（response 200、内容也对，但
      // viewer 不接管）。开 plugins:true 让 PDF 直接在 iframe 渲染。
      plugins: true,
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

// -------------------- IPC: config --------------------

ipcMain.handle('config:get', (): AppConfig => getConfig());

ipcMain.handle('config:set', (_event, patch: Parameters<typeof patchConfig>[0]): AppConfig => patchConfig(patch));

// -------------------- IPC: profile --------------------

/** 防重名：如果某 dir 已经被某个 profile 占了，直接复用它而不是再加一份。 */
function findByDir(dir: string): Profile | null {
  return listProfiles().find((p) => p.dir === dir) ?? null;
}

/** 在 ~/Documents/Mui简历/<safeName>/ 下创建一个目录，确保唯一。 */
async function ensureUniqueDocumentsDir(name: string): Promise<string> {
  const safe = name.replace(/[\\/:*?"<>|]/g, '_').trim() || '简历';
  const root = join(homedir(), 'Documents', 'Mui简历');
  let candidate = join(root, safe);
  let i = 2;
  // 如果已经被另一个 profile 占了，加 (2) (3) ...
  while (findByDir(candidate)) {
    candidate = join(root, `${safe} (${i})`);
    i++;
  }
  await mkdir(candidate, { recursive: true });
  return candidate;
}

ipcMain.handle('profile:create', async (_e, opts: { name: string; dir?: string }) => {
  if (!opts?.name?.trim()) return { ok: false, message: '名字不能为空' };
  let dir = opts.dir;
  if (!dir) {
    if (!mainWindow) return { ok: false, message: '窗口未就绪' };
    const r = await dialog.showOpenDialog(mainWindow, {
      title: `选一个目录给"${opts.name}"`,
      properties: ['openDirectory', 'createDirectory'],
    });
    if (r.canceled || r.filePaths.length === 0) return { ok: false };
    dir = r.filePaths[0]!;
  }
  const existing = findByDir(dir);
  if (existing) {
    setActiveProfile(existing.id);
    return { ok: true, profile: existing };
  }
  const profile = addProfile(opts.name, dir);
  return { ok: true, profile };
});

ipcMain.handle('profile:createInDocuments', async (_e, name: string) => {
  if (!name?.trim()) return { ok: false, message: '名字不能为空' };
  try {
    const dir = await ensureUniqueDocumentsDir(name);
    const profile = addProfile(name, dir);
    return { ok: true, profile };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : '创建目录失败' };
  }
});

ipcMain.handle('profile:pickFolder', async (_e, name: string) => {
  if (!mainWindow) return { ok: false, message: '窗口未就绪' };
  const r = await dialog.showOpenDialog(mainWindow, {
    title: `选一个目录给"${name || '新档案'}"`,
    properties: ['openDirectory', 'createDirectory'],
  });
  if (r.canceled || r.filePaths.length === 0) return { ok: false };
  const dir = r.filePaths[0]!;
  const existing = findByDir(dir);
  if (existing) {
    setActiveProfile(existing.id);
    return { ok: true, profile: existing };
  }
  const profile = addProfile(name?.trim() || '新档案', dir);
  return { ok: true, profile };
});

ipcMain.handle('profile:switchTo', (_e, id: string) => setActiveProfile(id));

ipcMain.handle('profile:rename', (_e, id: string, name: string) => renameProfile(id, name));

ipcMain.handle('profile:remove', (_e, id: string) => removeProfile(id));

ipcMain.handle('profile:openInFinder', async (_e, id: string) => {
  const p = listProfiles().find((x) => x.id === id);
  if (p) await shell.openPath(p.dir);
});

// renderer 在 bootstrap + onAutoLogin 都会调 ensureDefault，二者可能并发；
// 用 in-flight promise 序列化，避免并发竞争产生重复 profile。
let ensureDefaultInFlight: Promise<AppConfig> | null = null;
ipcMain.handle('profile:ensureDefault', () => {
  if (ensureDefaultInFlight) return ensureDefaultInFlight;
  ensureDefaultInFlight = (async () => {
    try {
      if (listProfiles().length > 0) return getConfig();
      const dir = await ensureUniqueDocumentsDir('默认');
      addProfile('默认', dir);
    } catch (err) {
      console.error('[profile:ensureDefault] failed', err);
    }
    return getConfig();
  })().finally(() => {
    ensureDefaultInFlight = null;
  });
  return ensureDefaultInFlight;
});

// -------------------- IPC: session --------------------

ipcMain.handle('session:check', () => runCheckSession());
ipcMain.handle('session:verify', (_e, candidate: string) => verifyCandidateKey(candidate));
ipcMain.handle('session:login', (_e, candidate: string) => loginWithKey(candidate));
ipcMain.handle('session:logout', () => {
  runLogout();
});
ipcMain.handle('session:beginConnect', () => beginConnect());

// -------------------- IPC: shell --------------------

ipcMain.handle('shell:openExternal', async (_event, url: string) => {
  if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
    await shell.openExternal(url);
  }
});

ipcMain.handle('shell:openWorkspace', async () => {
  const cfg = getConfig();
  if (cfg.workspaceDir) await shell.openPath(cfg.workspaceDir);
});

// -------------------- IPC: agent --------------------

ipcMain.handle(
  'agent:chat',
  async (
    event,
    opts: {
      profileId: string;
      convId: string;
      type: ConversationType;
      messages: ChatMessage[];
    },
  ): Promise<{ channelId: string }> => {
    const channelId = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const cfg = getConfig();
    runAgent({
      channelId,
      profileId: opts.profileId,
      convId: opts.convId,
      type: opts.type,
      messages: opts.messages,
      config: cfg,
      sender: event.sender,
    }).catch((err) => {
      console.error('[agent:chat] runtime crashed', err);
    });
    return { channelId };
  },
);

ipcMain.handle('agent:abort', async (_event, channelId: string) => {
  abortRun(channelId);
});

// -------------------- IPC: conversation --------------------

ipcMain.handle('conversation:list', (_e, profileId: string) => listConversations(profileId));
ipcMain.handle('conversation:get', (_e, profileId: string, convId: string) => getConversation(profileId, convId));
ipcMain.handle('conversation:create', (_e, opts: { profileId: string; type: ConversationType; title?: string }) =>
  createConversation(opts),
);
ipcMain.handle('conversation:rename', (_e, profileId: string, convId: string, title: string) =>
  renameConversation(profileId, convId, title),
);
ipcMain.handle('conversation:remove', (_e, profileId: string, convId: string) => deleteConversation(profileId, convId));

// -------------------- IPC: fs (右栏文件预览) --------------------

ipcMain.handle('fs:read', async (_e, path: string): Promise<string | null> => {
  if (typeof path !== 'string' || !path) return null;
  // 安全：只允许读当前激活 profile 工作目录下的文件
  const cfg = getConfig();
  if (!cfg.workspaceDir) return null;
  const abs = path;
  // 简单校验：abs 必须以 workspaceDir 开头
  if (!abs.startsWith(cfg.workspaceDir)) return null;
  try {
    return await readFile(abs, 'utf8');
  } catch {
    return null;
  }
});

ipcMain.handle(
  'fs:listDir',
  async (_e, path: string): Promise<Array<{ name: string; path: string; isDirectory: boolean }> | null> => {
    if (typeof path !== 'string' || !path) return null;
    const cfg = getConfig();
    if (!cfg.workspaceDir) return null;
    if (!path.startsWith(cfg.workspaceDir)) return null;
    try {
      const entries = await readdir(path, { withFileTypes: true });
      return entries
        .filter((e) => !e.name.startsWith('.') || e.name === '.claude')
        .map((e) => ({
          name: e.name,
          path: join(path, e.name),
          isDirectory: e.isDirectory(),
        }))
        .sort((a, b) => {
          // 目录在前，名字字母序
          if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
          return a.name.localeCompare(b.name, 'zh');
        });
    } catch {
      return null;
    }
  },
);

ipcMain.handle('fs:showInFolder', async (_e, path: string) => {
  if (typeof path !== 'string') return;
  const cfg = getConfig();
  if (!cfg.workspaceDir || !path.startsWith(cfg.workspaceDir)) return;
  shell.showItemInFolder(path);
});

// -------------------- App lifecycle --------------------

app.whenReady().then(() => {
  // 历史脏数据清理：早期版本因并发 ensureDefault 可能产生重复 profile，
  // 启动时按 dir 合并一次。
  dedupeProfiles();

  // muicv-pdf://local/<absolute-path> → 本地 PDF 文件。
  // 安全：必须在当前激活 profile 的 workspaceDir 之内，且后缀 .pdf。
  protocol.handle('muicv-pdf', async (request) => {
    const url = new URL(request.url);
    if (url.hostname !== 'local') {
      return new Response('Bad host', { status: 400 });
    }
    const filePath = decodeURIComponent(url.pathname);
    const cfg = getConfig();
    if (!cfg.workspaceDir || !filePath.startsWith(cfg.workspaceDir)) {
      return new Response('Forbidden: out of workspace', { status: 403 });
    }
    if (!/\.pdf$/i.test(filePath)) {
      return new Response('Not a PDF', { status: 400 });
    }
    try {
      const [buf, meta] = await Promise.all([readFile(filePath), stat(filePath)]);
      // 转成普通 ArrayBuffer，避免 Buffer 在 Response 里被当 SharedArrayBuffer
      const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
      return new Response(ab, {
        status: 200,
        headers: {
          'content-type': 'application/pdf',
          'content-length': String(meta.size),
          'cache-control': 'no-store',
        },
      });
    } catch {
      return new Response('Not Found', { status: 404 });
    }
  });

  if (isDev && process.platform === 'darwin') {
    app.dock?.setIcon(devIconPath);
  }

  createWindow();

  const cold = process.argv.find((a) => typeof a === 'string' && a.startsWith('muicv://'));
  if (cold) {
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
