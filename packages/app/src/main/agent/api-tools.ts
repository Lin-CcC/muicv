import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, relative, resolve, sep } from 'node:path';

import { tool } from '@openai/agents';
import { z } from 'zod';

import type { AppConfig } from '../../shared/types.ts';
import type { ArtifactEmitter } from './tools.ts';

/**
 * muicv 后端 API 工具：让 agent 能渲染简历 PDF + 抓取 JD。
 *
 * - render_resume_pdf：读本地 versions/xxx.md → POST /render →
 *   把 PDF bytes 写到同名 .pdf
 * - fetch_jd：用户给一个招聘 URL → POST /jobs/fetch → 拼 frontmatter
 *   写到 targets/<slug>.md
 *
 * 不带 muicv API key 时也能调（走匿名 IP 速率），失败会清晰报错让 agent
 * 告诉用户去 dashboard 配 key。
 */

function resolveInWorkspace(workspaceDir: string, relPath: string): string {
  const normalized = relPath.replace(/^[/\\]+/, '');
  const abs = resolve(workspaceDir, normalized);
  const root = workspaceDir.endsWith(sep) ? workspaceDir : workspaceDir + sep;
  if (abs !== workspaceDir && !abs.startsWith(root)) {
    throw new Error(`路径越界（必须在工作目录内）：${relPath}`);
  }
  return abs;
}

function shortRel(workspaceDir: string, abs: string): string {
  return relative(workspaceDir, abs) || '.';
}

function authHeader(config: AppConfig): Record<string, string> {
  return config.muicvApiKey ? { authorization: `Bearer ${config.muicvApiKey}` } : {};
}

export function buildApiTools(config: AppConfig, emitArtifact?: ArtifactEmitter) {
  const renderResumePdf = tool({
    name: 'render_resume_pdf',
    description:
      '把工作目录下的简历 markdown（通常是 versions/xxx.md）渲染成 A4 PDF，写到同名 .pdf 文件。返回 PDF 路径。',
    parameters: z.object({
      path: z.string().describe('source markdown 路径（含 frontmatter），相对工作目录'),
      template: z.string().nullable().describe('模板名，目前固定 default；null 时用 default'),
    }),
    execute: async ({ path, template: templateRaw }) => {
      const template = templateRaw ?? 'default';
      if (!config.workspaceDir) return '工作目录未配置';
      const sourceAbs = resolveInWorkspace(config.workspaceDir, path);
      let markdown: string;
      try {
        markdown = await readFile(sourceAbs, 'utf8');
      } catch {
        return `读不到源文件：${path}`;
      }

      let res: Response;
      try {
        res = await fetch(`${config.muicvApiBase}/render`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            accept: 'application/pdf',
            ...authHeader(config),
          },
          body: JSON.stringify({ markdown, template }),
        });
      } catch (err) {
        return `调 muicv API 失败（网络错）：${err instanceof Error ? err.message : String(err)}`;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return `muicv /render 返回 ${res.status}：${text.slice(0, 300) || '未知错误'}`;
      }

      const pdfBytes = new Uint8Array(await res.arrayBuffer());
      const targetRel = path.replace(/\.md$/i, '.pdf');
      const targetAbs = resolveInWorkspace(config.workspaceDir, targetRel);
      await mkdir(dirname(targetAbs), { recursive: true });
      await writeFile(targetAbs, pdfBytes);
      emitArtifact?.({ kind: 'resume-version', path: targetAbs, title: basename(targetAbs) });
      return `PDF 已生成：${shortRel(config.workspaceDir, targetAbs)}（${(pdfBytes.length / 1024).toFixed(1)} KB）`;
    },
  });

  const fetchJd = tool({
    name: 'fetch_jd',
    description:
      '抓取一个招聘页面 URL 的 JD 正文，清洗成 markdown 写到 targets/<slug>.md，含 frontmatter（company / title / source_url / fetched_at）。',
    parameters: z.object({
      url: z.string().describe('招聘页面公开可访问 URL'),
      savePath: z.string().nullable().describe('目标路径，相对工作目录。null = 按 company-title 自动 slug 到 targets/'),
    }),
    execute: async ({ url, savePath }) => {
      if (!config.workspaceDir) return '工作目录未配置';
      if (!/^https?:\/\//i.test(url)) return 'url 必须是 http/https';

      let res: Response;
      try {
        res = await fetch(`${config.muicvApiBase}/jobs/fetch`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            accept: 'application/json',
            ...authHeader(config),
          },
          body: JSON.stringify({ url }),
        });
      } catch (err) {
        return `调 muicv API 失败（网络错）：${err instanceof Error ? err.message : String(err)}`;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return `muicv /jobs/fetch 返回 ${res.status}：${text.slice(0, 300) || '未知错误'}`;
      }

      let body: {
        markdown?: string;
        meta?: {
          title?: string | null;
          company?: string | null;
          source_url?: string | null;
          fetched_at?: string | null;
          description?: string | null;
        };
      };
      try {
        body = await res.json();
      } catch {
        return 'muicv /jobs/fetch 响应不是合法 JSON';
      }

      if (typeof body.markdown !== 'string' || body.markdown.length === 0) {
        return 'muicv 没拿到 JD 正文（可能登录墙 / SPA 渲染失败），请用户复制粘贴 JD 文本到 targets/<slug>.md';
      }

      const meta = body.meta ?? {};
      const slug = savePath ? null : slugify(`${meta.company ?? 'company'}-${meta.title ?? 'role'}`);
      const targetRel = savePath ?? `targets/${slug}.md`;
      const targetAbs = resolveInWorkspace(config.workspaceDir, targetRel);

      const frontmatter = [
        '---',
        'type: target',
        meta.company ? `company: ${escapeYaml(meta.company)}` : null,
        meta.title ? `title: ${escapeYaml(meta.title)}` : null,
        meta.source_url ? `source_url: ${escapeYaml(meta.source_url)}` : null,
        `fetched_at: ${meta.fetched_at ?? new Date().toISOString()}`,
        '---',
      ]
        .filter(Boolean)
        .join('\n');

      const content = `${frontmatter}\n\n## JD 正文\n\n${body.markdown.trim()}\n`;
      await mkdir(dirname(targetAbs), { recursive: true });
      await writeFile(targetAbs, content, 'utf8');
      emitArtifact?.({ kind: 'jd-target', path: targetAbs, title: basename(targetAbs) });
      return `JD 已保存到 ${shortRel(config.workspaceDir, targetAbs)}${
        meta.company ? `（${meta.company} / ${meta.title}）` : ''
      }`;
    },
  });

  return [renderResumePdf, fetchJd];
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9一-龥-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'target'
  );
}

function escapeYaml(s: string): string {
  // 简单加引号兜底特殊字符
  if (/[:#\[\]{}|>*!&%@`,]/.test(s) || /^\s|\s$/.test(s)) {
    return `"${s.replace(/"/g, '\\"')}"`;
  }
  return s;
}
