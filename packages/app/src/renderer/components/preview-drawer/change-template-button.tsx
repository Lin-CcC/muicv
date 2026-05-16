import { ArrowsClockwiseIcon } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';

import { type JsonTemplateId, parseResumeJsonForPreview, readTemplateFromJson } from './tools';

const SIBLING_RESUME_RE = /\.pdf$/i;

function pdfToSiblingResumeJson(path: string): string {
  return path.replace(SIBLING_RESUME_RE, '.resume.json');
}

function basename(path: string): string {
  return path.split(/[/\\]/).pop() ?? path;
}

type Props =
  | {
      kind: 'resume-json';
      /** 已经加载好的 .resume.json 文本（父组件的 content）。 */
      content: string;
      /** 父组件根据 footer TemplateSelect + JSON 推导出的当前模板。 */
      template: JsonTemplateId;
    }
  | {
      kind: 'pdf';
      /** 预览的 PDF 绝对路径，组件自己读同名 .resume.json 兜底。 */
      pdfPath: string;
    };

/**
 * 预览 header 右上角的「更换模板」按钮：把当前简历 POST 给 muicv 拿一个一次性
 * preview token URL，再 shell.openExternal 打开默认浏览器，让用户在 website
 * 预览页的模板下拉框里慢慢挑（不在桌面 app 内做模板穿梭，避免多端 UI 重叠）。
 *
 * 数据来源：
 *   - .resume.json：直接用父组件 content + jsonTemplate
 *   - PDF：探测同目录同前缀的 `<name>.resume.json`，找不到就置灰 + tooltip 说明
 *
 * 其他文件类型（图片 / markdown 等）父组件不挂载本按钮。
 */
export function ChangeTemplateButton(props: Props) {
  const [pending, setPending] = useState(false);
  const [siblingProbe, setSiblingProbe] = useState<{
    status: 'loading' | 'ok' | 'missing';
    content: string | null;
  }>({ status: 'loading', content: null });
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const siblingPath = props.kind === 'pdf' ? pdfToSiblingResumeJson(props.pdfPath) : null;

  useEffect(() => {
    if (!siblingPath) {
      setSiblingProbe({ status: 'ok', content: null });
      return;
    }
    let cancelled = false;
    setSiblingProbe({ status: 'loading', content: null });
    void window.muicv.fs.read(siblingPath).then((text) => {
      if (cancelled) return;
      setSiblingProbe(text === null ? { status: 'missing', content: null } : { status: 'ok', content: text });
    });
    return () => {
      cancelled = true;
    };
  }, [siblingPath]);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 6_000);
    return () => clearTimeout(t);
  }, [message]);

  const effectiveContent = props.kind === 'resume-json' ? props.content : siblingProbe.content;
  const effectiveTemplate: JsonTemplateId | null =
    props.kind === 'resume-json' ? props.template : (readTemplateFromJson(siblingProbe.content) ?? 't2-minimal');

  const probing = props.kind === 'pdf' && siblingProbe.status === 'loading';
  const missing = props.kind === 'pdf' && siblingProbe.status === 'missing';
  const disabled = pending || probing || missing || !effectiveContent || !effectiveTemplate;

  const title = missing
    ? `找不到同名简历源（${basename(siblingPath ?? '')}）。先用 AI 重新生成 .resume.json，再来换模板。`
    : '生成线上预览页，在浏览器里挑模板';

  async function onClick() {
    if (disabled || !effectiveContent || !effectiveTemplate) return;
    setPending(true);
    setMessage(null);
    try {
      const parsed = parseResumeJsonForPreview(effectiveContent);
      if (!parsed.ok) {
        setMessage({ kind: 'err', text: parsed.error });
        return;
      }
      const res = await window.muicv.preview.create({
        resumeJson: parsed.resume,
        template: effectiveTemplate,
        lang: parsed.lang,
      });
      if (!res.ok) {
        setMessage({ kind: 'err', text: res.message });
        return;
      }
      await window.muicv.shell.openExternal(res.url);
      setMessage({ kind: 'ok', text: '已在浏览器打开预览，去那里换模板吧' });
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void onClick()}
        disabled={disabled}
        title={title}
        aria-label="更换模板"
        className="flex shrink-0 items-center gap-1 rounded-md border-2 border-rule-strong bg-paper px-2 py-1 text-[12px] font-bold text-ink hover:bg-fluff disabled:cursor-not-allowed disabled:opacity-50"
      >
        <ArrowsClockwiseIcon size={12} weight="bold" />
        {pending ? '生成中…' : '更换模板'}
      </button>
      {message && (
        <span
          className={`hidden max-w-[280px] truncate text-[12px] sm:inline ${message.kind === 'ok' ? 'text-yellow-deep' : 'text-tongue'}`}
          title={message.text}
        >
          {message.text}
        </span>
      )}
    </>
  );
}
