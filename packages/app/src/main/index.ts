import { mkdir, readFile, readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { BrowserWindow, Menu, app, dialog, ipcMain, protocol, shell } from 'electron';

import type {
  AppConfig,
  AttachmentSaveResult,
  AttachmentUploadInput,
  ChatMessage,
  ChatMessageFeedback,
  ConversationType,
  Profile,
} from '../shared/types.ts';
import {
  type CreatePreviewInput,
  type CreatePreviewResult,
  createPreview,
  listPhotos,
  type PhotoHistoryResult,
  type PhotoUploadInput,
  type PhotoUploadResult,
  uploadPhoto,
} from './api-preview.ts';
import { abortRun, runAgent } from './agent/runtime.ts';
import { saveAttachment } from './attachments.ts';
import { type WriteResult, writeFileToWorkspace } from './fs-edit.ts';
import {
  MicPermissionDenied,
  RecordingCancelled,
  isLocalReady,
  recordWav,
  transcribeWav,
  type TranscribeResult,
} from './audio.ts';
import { setupUpdater, triggerInitialCheck } from './updater.ts';
import { registerWhisperEngineIpc } from './whisper-engine/index.ts';
import {
  createConversation,
  deleteConversation,
  getConversation,
  listConversations,
  renameConversation,
  setMessageFeedback,
} from './conversations.ts';
import { beginConnect, beginLinkMuirouter, handleDeepLink, registerScheme, setMainWindowGetter } from './deep-link.ts';
import { commentFeedback, rateFeedback, type CommentArgs, type RateArgs } from './feedback.ts';
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
ipcMain.handle('session:beginLinkMuirouter', () => beginLinkMuirouter());

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

// -------------------- IPC: app meta --------------------

ipcMain.handle('app:getVersion', () => app.getVersion());

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
ipcMain.handle(
  'conversation:setMessageFeedback',
  (_e, profileId: string, convId: string, messageId: string, patch: Partial<ChatMessageFeedback>) =>
    setMessageFeedback(profileId, convId, messageId, patch),
);

// -------------------- IPC: feedback（赞 / 踩 / 聊聊 → packages/api） --------------------

ipcMain.handle('feedback:rate', (_e, args: RateArgs) => rateFeedback(args));
ipcMain.handle('feedback:comment', (_e, args: CommentArgs) => commentFeedback(args));

// -------------------- IPC: fs (右栏文件预览 + 编辑器) --------------------

/**
 * 路径白名单：先 `path.resolve` 折叠 `..`，再做 `startsWith(dir + sep)` 比较。
 * 比裸 `startsWith` 严：(a) 防 `..` 越界；(b) 避免 `/x/y` 误判 `/x/y2` 同根。
 */
function inWorkspace(workspaceDir: string, abs: string): boolean {
  const root = workspaceDir.endsWith(sep) ? workspaceDir : workspaceDir + sep;
  return abs === workspaceDir || abs.startsWith(root);
}

ipcMain.handle('fs:read', async (_e, path: string): Promise<string | null> => {
  if (typeof path !== 'string' || !path) return null;
  const cfg = getConfig();
  if (!cfg.workspaceDir) return null;
  const abs = resolve(path);
  if (!inWorkspace(cfg.workspaceDir, abs)) return null;
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
    const abs = resolve(path);
    if (!inWorkspace(cfg.workspaceDir, abs)) return null;
    try {
      const entries = await readdir(abs, { withFileTypes: true });
      return entries
        .filter((e) => !e.name.startsWith('.') || e.name === '.claude')
        .map((e) => ({
          name: e.name,
          path: join(abs, e.name),
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
  if (!cfg.workspaceDir) return;
  const abs = resolve(path);
  if (!inWorkspace(cfg.workspaceDir, abs)) return;
  shell.showItemInFolder(abs);
});

// 二进制文件 → data URL，给 renderer 在 attachment-preview-dialog 里 <img> 直接显示。
// 走 IPC 而不是再注册一个 muicv-asset:// 协议：调用频次低 + 一份 data URL 用完就完，
// 不用考虑流式 / cache-control。同样限定在 workspaceDir 内。
const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
};
// 右键菜单。renderer onContextMenu 拦下原生菜单，走这条路弹一个 role-based 的
// 原生编辑菜单——所有 role 自动跟焦点状态联动（没选区时 copy/cut 自动 disabled），
// 不用 renderer 维护可点性。
//
// editable=true：textarea 等可编辑控件，给完整编辑组（剪/复/粘/删/撤销/重做/全选）
// editable=false：消息气泡等只读区域，只给"复制 / 全选"两项
//
// 仅在 chat textarea + 消息气泡区域接此 IPC，其它任何位置维持默认（空菜单 / 不弹）。
ipcMain.on('chatInput:showContextMenu', (event, opts: { editable?: boolean } = {}) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  const editable = opts.editable !== false;
  const template: Electron.MenuItemConstructorOptions[] = editable
    ? [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'pasteAndMatchStyle', label: '粘贴并匹配样式' },
        { role: 'delete', label: '删除' },
        { type: 'separator' },
        { role: 'selectAll', label: '全选' },
      ]
    : [
        { role: 'copy', label: '复制' },
        { role: 'selectAll', label: '全选' },
      ];
  const menu = Menu.buildFromTemplate(template);
  menu.popup({ window: win });
});

ipcMain.handle('fs:readAsDataUrl', async (_e, path: string): Promise<string | null> => {
  if (typeof path !== 'string' || !path) return null;
  const cfg = getConfig();
  if (!cfg.workspaceDir) return null;
  const abs = resolve(path);
  if (!inWorkspace(cfg.workspaceDir, abs)) return null;
  const ext = abs.split('.').pop()?.toLowerCase() ?? '';
  const mime = MIME_BY_EXT[ext];
  if (!mime) return null; // 只允许图像类，避免 renderer 拿到任意二进制文件
  try {
    const buf = await readFile(abs);
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
});

ipcMain.handle('fs:write', async (_e, path: string, content: string): Promise<WriteResult> => {
  const cfg = getConfig();
  return writeFileToWorkspace(cfg.workspaceDir, path, content);
});

// -------------------- IPC: attachments (chat box 上传) --------------------

ipcMain.handle(
  'attachments:save',
  async (_e, profileId: string, file: AttachmentUploadInput): Promise<AttachmentSaveResult> => {
    const cfg = getConfig();
    // profile 必须跟激活态对得上：renderer 切 profile 时未及时清空附件 → 这里挡住
    if (!profileId || profileId !== cfg.activeProfileId) {
      return { ok: false, reason: 'profile-mismatch', message: '请先选中职业档案' };
    }
    return saveAttachment(cfg.workspaceDir, file);
  },
);

// -------------------- IPC: audio --------------------

type RecordAndTranscribeOutcome =
  | { ok: true; result: TranscribeResult }
  | { ok: false; reason: 'mic-denied' | 'cancel'; message: string }
  | {
      ok: false;
      reason: 'error';
      message: string;
      lastAudio?: { wav: Uint8Array; mimeType: string; durationMs: number; pauses: Array<[number, number]> };
      localReady?: boolean;
    };

/**
 * 让 renderer chatbox 也能主动触发录音 → 转写（issue #1 M2 增补）。
 *
 * issue #6：拆成 recordWav + transcribeWav 两阶段，转写阶段失败时把已录好的 wav 一起带回 renderer，
 * 让 UI 提供「重试转写 / 下载录音 / 安装本地模型」三条后路。agent tool 路径仍走 recordAndTranscribe。
 */
ipcMain.handle(
  'audio:recordAndTranscribe',
  async (e, opts: { durationLimitSec?: number }): Promise<RecordAndTranscribeOutcome> => {
    let payload: Awaited<ReturnType<typeof recordWav>>;
    try {
      payload = await recordWav({ durationLimitSec: opts?.durationLimitSec ?? 180, sender: e.sender });
    } catch (err) {
      if (err instanceof MicPermissionDenied) return { ok: false, reason: 'mic-denied', message: err.message };
      if (err instanceof RecordingCancelled) return { ok: false, reason: 'cancel', message: err.message };
      // 录音阶段未拿到音频；不算 issue #6 的"转写失败"，没 lastAudio 可保留
      return { ok: false, reason: 'error', message: err instanceof Error ? err.message : String(err) };
    }
    return transcribeWavPayloadToOutcome(payload, getConfig());
  },
);

/** issue #6：手动重试。复用同一份 wav 走完整的 transcribe 流程（含 3 次重试 + 本地兜底）。 */
ipcMain.handle(
  'audio:retranscribe',
  async (
    _e,
    audio: { wav: Uint8Array; mimeType: string; durationMs: number; pauses: Array<[number, number]> },
  ): Promise<RecordAndTranscribeOutcome> => {
    const payload = {
      audioBase64: Buffer.from(audio.wav).toString('base64'),
      mimeType: audio.mimeType,
      durationMs: audio.durationMs,
      pauses: audio.pauses,
    };
    return transcribeWavPayloadToOutcome(payload, getConfig());
  },
);

async function transcribeWavPayloadToOutcome(
  payload: { audioBase64: string; mimeType: string; durationMs: number; pauses: Array<[number, number]> },
  config: AppConfig,
): Promise<RecordAndTranscribeOutcome> {
  try {
    const result = await transcribeWav(payload, config);
    return { ok: true, result };
  } catch (err) {
    const localReady = await isLocalReady().catch(() => false);
    return {
      ok: false,
      reason: 'error',
      message: err instanceof Error ? err.message : String(err),
      lastAudio: {
        wav: new Uint8Array(Buffer.from(payload.audioBase64, 'base64')),
        mimeType: payload.mimeType,
        durationMs: payload.durationMs,
        pauses: payload.pauses,
      },
      localReady,
    };
  }
}

// -------------------- IPC: 在线预览 + 证件照（muicv 后端 API 封装）--------------------

ipcMain.handle('preview:uploadPhoto', async (_e, input: PhotoUploadInput): Promise<PhotoUploadResult> => {
  return uploadPhoto(getConfig(), input);
});

ipcMain.handle('preview:listPhotos', async (_e, limit?: number): Promise<PhotoHistoryResult> => {
  return listPhotos(getConfig(), typeof limit === 'number' ? limit : 20);
});

ipcMain.handle('preview:create', async (_e, input: CreatePreviewInput): Promise<CreatePreviewResult> => {
  return createPreview(getConfig(), input);
});

// 本地 whisper.cpp 引擎插件（issue #1 M3）。进度事件用 mainWindow.webContents 推送。
registerWhisperEngineIpc(() => mainWindow?.webContents ?? null);

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
    let raw = decodeURIComponent(url.pathname);
    // Windows: '/C:/Users/...' → 'C:/Users/...'，让 path.resolve 正确识别盘符。
    // 渲染端编码细节见 src/renderer/lib/muicv-pdf-url.ts。
    if (/^\/[A-Za-z]:/.test(raw)) raw = raw.slice(1);
    const filePath = resolve(raw);
    const cfg = getConfig();
    if (!cfg.workspaceDir || !inWorkspace(cfg.workspaceDir, filePath)) {
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

  // 自动更新：注册 IPC + 事件监听；延迟 10s 触发首次检查，让登录 / OAuth /
  // workspace 加载先跑完。dev 模式下 setupUpdater 内部直接 short-circuit。
  setupUpdater(() => mainWindow);
  setTimeout(triggerInitialCheck, 10_000);

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
