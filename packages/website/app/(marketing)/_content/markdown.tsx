import { marked } from 'marked';

export function MarkdownBody({ markdown }: { markdown: string }) {
  const html = marked.parse(markdown, { async: false }) as string;

  return (
    <div
      className="prose-mui max-w-none text-[16px] leading-[1.8] text-ink-soft"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
