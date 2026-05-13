import { FolderOpenIcon, GlobeIcon, PencilSimpleIcon, XIcon } from '@phosphor-icons/react';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import { assertTemplateResumeData, isJsonTemplateId, JSON_TEMPLATE_IDS, type TemplateResumeData } from '@muicv/shared';

import { pathToMuicvPdfUrl } from '../lib/muicv-pdf-url';
import { useAppStore } from '../lib/store';
import { EditDrawer } from './edit-drawer';
import { MarkdownView } from './markdown-view';

type JsonTemplateId = (typeof JSON_TEMPLATE_IDS)[number];

/**
 * 6 套模板的展示名 —— 与 packages/website /r/render/[token]/templates/registry.ts
 * 注册的 jsonTemplates 一一对应。把名字暴露在预览 drawer，让用户能看到"v0.3.0
 * 6 套新模板"在哪儿（TODO #10：用户反馈"没看到新模版"）。
 */
const TEMPLATE_LABELS: Record<JsonTemplateId, string> = {
  't1-classic': 't1 · 经典衬线',
  't2-minimal': 't2 · 极简瑞士',
  't3-sidebar': 't3 · 左暗色栏',
  't4-tech': 't4 · 技术向',
  't5-timeline': 't5 · 时间线',
  't6-academic': 't6 · 学术风',
};

function readTemplateFromJson(content: string | null): JsonTemplateId | null {
  if (!content) return null;
  try {
    const parsed = JSON.parse(content) as { _template?: unknown; template?: unknown };
    const raw = typeof parsed._template === 'string' ? parsed._template : parsed.template;
    return typeof raw === 'string' && isJsonTemplateId(raw) ? raw : null;
  } catch {
    return null;
  }
}

const TRANSITION_MS = 220;

/**
 * 文件预览 drawer。从右侧滑入，覆盖整个窗口（含 titlebar）；ESC / 点 backdrop 关闭。
 *
 * 跟文件树 (SidebarRight) 解耦：触发条件 = rightPanelPreviewPath 不空，
 * 关闭只清 previewPath。需要看文件树的话用左上角 toggle 按钮。
 *
 * 进 / 出场动画：
 *   - 进：mount 时立刻渲染 closed 状态（panel translate-x-full / backdrop
 *     opacity-0），下一帧切到 open 触发 CSS transition。
 *   - 出：先 set visible=false 走出场，TRANSITION_MS 后再 unmount，避免
 *     直接卸载看不到动画。
 */
export function PreviewDrawer() {
  const previewPath = useAppStore((s) => s.rightPanelPreviewPath);
  const closePreview = useAppStore((s) => s.closePreview);

  const [mountedPath, setMountedPath] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (previewPath) {
      setMountedPath(previewPath);
      // 双 rAF：第一帧 React 把 closed 状态 commit 并交给浏览器 paint，
      // 第二帧再 set visible=true 切 open，CSS transition 才有"前一帧"
      // 的样式快照可以跟当前帧 diff —— 单 rAF 时 React 18+ 偶尔会把两次
      // setState 合并到一次 commit，结果浏览器只看到 open 状态，没动画。
      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setVisible(true));
      });
      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
      };
    }
    setVisible(false);
    const t = setTimeout(() => setMountedPath(null), TRANSITION_MS);
    return () => clearTimeout(t);
  }, [previewPath]);

  useEffect(() => {
    if (!mountedPath) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closePreview();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mountedPath, closePreview]);

  if (!mountedPath) return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex justify-end">
      <div
        className={`absolute inset-0 bg-ink/30 backdrop-blur-[2px] transition-opacity duration-200 ease-out ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        aria-hidden
        onClick={closePreview}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="文件预览"
        style={{ transitionDuration: `${TRANSITION_MS}ms` }}
        className={`relative flex h-full w-full max-w-[1100px] flex-col border-l-2 border-ink bg-paper shadow-[-5px_0_0_0_var(--color-ink)] transition-transform ease-out sm:w-[80%] ${
          visible ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <PreviewContent path={mountedPath} onClose={closePreview} />
      </aside>
    </div>,
    document.body,
  );
}

function PreviewContent({ path, onClose }: { path: string; onClose: () => void }) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // 用户在 footer 切换的预览模板。null = 跟随 JSON 里的 _template 字段 / 兜底 t2-minimal。
  // path 变化时重置，避免上一份 .resume.json 的选择"穿透"到下一份。
  const [overrideTemplate, setOverrideTemplate] = useState<JsonTemplateId | null>(null);
  // EditDrawer 控制：null = 不显示；string = 编辑该 path
  const [editingPath, setEditingPath] = useState<string | null>(null);
  // EditDrawer 保存的时间戳，用于触发 PreviewContent 重新读取文件
  const editorLastSavedAt = useAppStore((s) => s.editorLastSavedAt);
  const editorOpenPath = useAppStore((s) => s.editorOpenPath);

  const fileName = path.split(/[/\\]/).pop() ?? path;
  const isPdf = /\.pdf$/i.test(path);
  const isResumeJson = /\.resume\.json$/i.test(path);
  const isMarkdown = /\.(md|markdown)$/i.test(path);
  const isEditable = isMarkdown || isResumeJson;

  const jsonTemplate = useMemo<JsonTemplateId>(() => {
    if (!isResumeJson) return 't2-minimal';
    return overrideTemplate ?? readTemplateFromJson(content) ?? 't2-minimal';
  }, [isResumeJson, overrideTemplate, content]);

  useEffect(() => {
    setOverrideTemplate(null);
  }, [path]);

  useEffect(() => {
    // PDF 走 muicv-pdf:// 让 Chromium 内置 viewer 自己 fetch，
    // 不需要在 renderer 这边 fs.read 二进制内容。
    if (isPdf) {
      setContent(null);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setContent(null);
    void window.muicv.fs.read(path).then((text) => {
      if (cancelled) return;
      setLoading(false);
      if (text === null) setError('读不到这个文件，可能已被删 / 路径越界');
      else setContent(text);
    });
    return () => {
      cancelled = true;
    };
    // editorLastSavedAt 变化（且当前文件正在被 EditDrawer 编辑）→ 重新 read 让预览同步。
  }, [path, isPdf, editorLastSavedAt, editorOpenPath]);

  return (
    <>
      <header className="flex shrink-0 items-center gap-2 border-b border-rule bg-cream px-4 py-2">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-wider text-mute">预览</p>
          <p className="truncate text-[13px] font-bold text-ink" title={path}>
            {fileName}
          </p>
        </div>
        {isEditable && (
          <button
            type="button"
            onClick={() => setEditingPath(path)}
            title="编辑（在叠加层打开 CodeMirror）"
            aria-label="编辑文件"
            className="flex shrink-0 items-center gap-1 rounded-md border-2 border-rule-strong bg-paper px-2 py-1 text-[11.5px] font-bold text-ink hover:bg-fluff"
          >
            <PencilSimpleIcon size={12} weight="bold" />
            编辑
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          title="关闭预览"
          aria-label="关闭预览"
          className="flex shrink-0 items-center justify-center rounded-md px-2 py-1 text-mute hover:bg-fluff hover:text-ink"
        >
          <XIcon size={14} weight="bold" />
        </button>
      </header>

      <div className={`flex-1 ${isPdf ? 'flex flex-col' : 'overflow-y-auto px-4 py-4'}`}>
        {loading && !isPdf && <div className="text-[12px] text-mute">读取中…</div>}
        {error && !isPdf && (
          <div className="rounded-lg border-2 border-tongue/60 bg-tongue/10 px-3 py-2 text-[12.5px] text-tongue">
            {error}
          </div>
        )}
        {content !== null && !error && !isPdf && /\.md$/i.test(path) && <MarkdownView source={content} />}
        {content !== null && !error && !isPdf && !/\.md$/i.test(path) && (
          <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[12px] leading-[1.55] text-ink-soft">
            {content}
          </pre>
        )}
        {isPdf && (
          // muicv-pdf:// 协议在 main 进程注册（src/main/index.ts），URL 编码细节见
          // ../lib/muicv-pdf-url：跨平台兼容 Windows 盘符。
          <iframe
            key={path}
            title={fileName}
            src={pathToMuicvPdfUrl(path)}
            className="border-0 bg-white"
            style={{ width: '100%', height: '100%', flex: 1 }}
          />
        )}
      </div>

      <footer className="flex shrink-0 items-center gap-2 border-t border-rule bg-cream px-4 py-2 text-[11.5px] text-mute">
        <button
          type="button"
          onClick={() => void window.muicv.fs.showInFolder(path)}
          className="inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-fluff hover:text-ink"
        >
          <FolderOpenIcon size={12} />
          <span>在文件管理器</span>
        </button>
        <button
          type="button"
          onClick={() => void navigator.clipboard.writeText(path)}
          className="rounded px-2 py-1 hover:bg-fluff hover:text-ink"
        >
          复制路径
        </button>
        {isResumeJson && content !== null && (
          <>
            <TemplateSelect value={jsonTemplate} onChange={setOverrideTemplate} />
            <ResumeJsonPreviewButton content={content} template={jsonTemplate} />
          </>
        )}
      </footer>

      <EditDrawer path={editingPath} onClose={() => setEditingPath(null)} />
    </>
  );
}

function TemplateSelect({ value, onChange }: { value: JsonTemplateId; onChange: (id: JsonTemplateId) => void }) {
  return (
    <label className="ml-auto inline-flex items-center gap-1.5 text-[11px]">
      <span className="text-mute">模板</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as JsonTemplateId)}
        className="rounded border border-rule bg-paper px-1.5 py-0.5 font-mono text-[11px] text-ink hover:bg-fluff focus:outline-none focus:ring-1 focus:ring-yellow-deep"
        title="切换在线预览使用的模板"
      >
        {JSON_TEMPLATE_IDS.map((id) => (
          <option key={id} value={id}>
            {TEMPLATE_LABELS[id]}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * 把当前 `*.resume.json` 文件 POST 到 muicv 后端 /preview，
 * 拿到 https://muicv.com/preview/<token> URL 后用 shell.openExternal 打开默认浏览器。
 *
 * 模板由父组件决定（footer 的 TemplateSelect 控制）；语言从 JSON 顶层 `_lang` / `lang` 读，
 * 否则 fallback zh。
 *
 * UX 哲学：失败 toast 限本组件内显示 6 秒，不影响用户继续读 JSON；成功直接打开浏览器并 toast 链接。
 */
function ResumeJsonPreviewButton({ content, template }: { content: string; template: JsonTemplateId }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 6_000);
    return () => clearTimeout(t);
  }, [message]);

  async function onClick() {
    if (pending) return;
    setPending(true);
    setMessage(null);
    try {
      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch (err) {
        setMessage({ kind: 'err', text: `JSON 解析失败：${err instanceof Error ? err.message : String(err)}` });
        return;
      }
      let resume: TemplateResumeData;
      try {
        assertTemplateResumeData(parsed);
        resume = parsed;
      } catch (err) {
        setMessage({
          kind: 'err',
          text: `不符合 TemplateResumeData schema：${err instanceof Error ? err.message : String(err)}`,
        });
        return;
      }

      // 模板由父组件传入；lang 仍按 JSON 顶层 `_lang` / `lang` 字段读，缺省 zh。
      const ext = parsed as { _lang?: unknown; lang?: unknown };
      const rawLang = typeof ext._lang === 'string' ? ext._lang : ext.lang;
      const lang: 'zh' | 'en' = rawLang === 'en' ? 'en' : 'zh';

      const res = await window.muicv.preview.create({ resumeJson: resume, template, lang });
      if (!res.ok) {
        setMessage({ kind: 'err', text: res.message });
        return;
      }
      await window.muicv.shell.openExternal(res.url);
      setMessage({ kind: 'ok', text: `已打开浏览器：${res.url}` });
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void onClick()}
        disabled={pending}
        className="ml-auto inline-flex items-center gap-1 rounded px-2 py-1 font-bold text-ink hover:bg-fluff disabled:opacity-60"
        title="POST /preview 拿可分享 URL，并打开默认浏览器"
      >
        <GlobeIcon size={12} />
        <span>{pending ? '生成中…' : '在线预览'}</span>
      </button>
      {message && (
        <span
          className={`max-w-[40%] truncate text-[10.5px] ${message.kind === 'ok' ? 'text-yellow-deep' : 'text-tongue'}`}
          title={message.text}
        >
          {message.text}
        </span>
      )}
    </>
  );
}
