import matter from 'gray-matter';
import { marked } from 'marked';

export type ResumeFrontmatter = {
  title?: string;
  target?: string;
  [key: string]: unknown;
};

export type ParsedResume = {
  /** 显示用标题：frontmatter.title > frontmatter.target > "Resume" */
  title: string;
  frontmatter: ResumeFrontmatter;
  /** marked 转好的 HTML，由模板用 dangerouslySetInnerHTML 注入 */
  contentHtml: string;
};

/**
 * YAML 严格不允许 tab 缩进，但 muicv-generate skill 历史产物里有用 tab 写
 * frontmatter 的情况，js-yaml 会直接抛错。这里手动把 `---...---` 块剥掉、
 * frontmatter 当空对象处理，确保正文仍能正常渲染，简历不至于整页崩。
 */
const FRONTMATTER_BLOCK_RE = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;

export async function parseResume(markdown: string): Promise<ParsedResume> {
  let fm: ResumeFrontmatter = {};
  let body = markdown;
  try {
    const parsed = matter(markdown);
    fm = parsed.data as ResumeFrontmatter;
    body = parsed.content;
  } catch {
    // gray-matter / js-yaml 抛错（最常见：tab 缩进的 frontmatter）。
    // 降级：去掉 frontmatter 块，正文照常 markdown → HTML。
    body = markdown.replace(FRONTMATTER_BLOCK_RE, '');
  }
  const title =
    typeof fm.title === 'string' && fm.title.trim()
      ? fm.title.trim()
      : typeof fm.target === 'string' && fm.target.trim()
        ? `Resume — ${fm.target.trim()}`
        : 'Resume';
  const contentHtml = await marked.parse(body, { async: true });
  return { title, frontmatter: fm, contentHtml };
}
