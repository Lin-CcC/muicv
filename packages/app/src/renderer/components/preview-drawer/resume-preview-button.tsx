import { GlobeIcon } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';

import { type JsonTemplateId, parseResumeJsonForPreview } from './tools';

/**
 * 把当前 `*.resume.json` 文件 POST 到 muicv 后端 /preview，
 * 拿到 https://muicv.com/preview/<token> URL 后用 shell.openExternal 打开默认浏览器。
 *
 * 模板由父组件决定（footer 的 TemplateSelect 控制）；语言从 JSON 顶层 `_lang` / `lang` 读，
 * 否则 fallback zh。
 *
 * UX 哲学：失败 toast 限本组件内显示 6 秒，不影响用户继续读 JSON；成功直接打开浏览器并 toast 链接。
 */
export function ResumeJsonPreviewButton({ content, template }: { content: string; template: JsonTemplateId }) {
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
      const parsed = parseResumeJsonForPreview(content);
      if (!parsed.ok) {
        setMessage({ kind: 'err', text: parsed.error });
        return;
      }
      const res = await window.muicv.preview.create({ resumeJson: parsed.resume, template, lang: parsed.lang });
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
          className={`max-w-[40%] truncate text-[12px] ${message.kind === 'ok' ? 'text-yellow-deep' : 'text-tongue'}`}
          title={message.text}
        >
          {message.text}
        </span>
      )}
    </>
  );
}
