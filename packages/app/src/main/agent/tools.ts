import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { glob } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';

import { tool } from '@openai/agents';
import { z } from 'zod';

/**
 * 文件 / 系统工具集合。所有路径都相对于"工作目录"（用户在 Settings 里
 * 选的根，传给每个 buildXxxTool 的工厂函数）。严格防越界：resolve 后
 * 必须落在 workspaceDir 内。
 *
 * Phase 2 实现：read / write / edit / glob / grep / list。bash 暂不开。
 * Phase 3 会再加 muicv API 工具（render PDF / fetch JD）。
 */

function resolveInWorkspace(workspaceDir: string, relPath: string): string {
  const normalized = relPath.replace(/^[/\\]+/, ''); // 去掉前导 / 防 absolute
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

export function buildFileTools(workspaceDir: string) {
  const readFileTool = tool({
    name: 'read_file',
    description: '读取工作目录下某个文件的全部文本内容。对 .claude/muicv/ 下的 markdown 等都可用。',
    parameters: z.object({
      path: z.string().describe('相对工作目录的路径，如 ".claude/muicv/profile.md"'),
    }),
    execute: async ({ path }) => {
      const abs = resolveInWorkspace(workspaceDir, path);
      try {
        const content = await readFile(abs, 'utf8');
        return content;
      } catch (err) {
        return `读取失败: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });

  const writeFileTool = tool({
    name: 'write_file',
    description:
      '写入文件（会覆盖现有内容；目录不存在会自动创建）。**修改已有文件应优先用 edit_file**，只在新建文件时用 write_file。',
    parameters: z.object({
      path: z.string().describe('相对路径'),
      content: z.string().describe('完整文件内容'),
    }),
    execute: async ({ path, content }) => {
      const abs = resolveInWorkspace(workspaceDir, path);
      try {
        await mkdir(dirname(abs), { recursive: true });
        await writeFile(abs, content, 'utf8');
        return `已写入 ${shortRel(workspaceDir, abs)}（${content.length} 字符）`;
      } catch (err) {
        return `写入失败: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });

  const editFileTool = tool({
    name: 'edit_file',
    description:
      '在文件里精确替换字符串。oldString 必须在文件里唯一出现一次，否则报错；要替换多处用 replaceAll=true。',
    parameters: z.object({
      path: z.string(),
      oldString: z.string().describe('要被替换的字符串（要精确匹配，包括缩进）'),
      newString: z.string().describe('替换后的字符串'),
      replaceAll: z.boolean().optional().default(false),
    }),
    execute: async ({ path, oldString, newString, replaceAll }) => {
      const abs = resolveInWorkspace(workspaceDir, path);
      try {
        const original = await readFile(abs, 'utf8');
        if (!original.includes(oldString)) {
          return `编辑失败：oldString 没在文件里出现`;
        }
        if (!replaceAll) {
          const occurrences = original.split(oldString).length - 1;
          if (occurrences > 1) {
            return `编辑失败：oldString 在文件里出现 ${occurrences} 次，要么传更长上下文让它唯一，要么 replaceAll=true`;
          }
        }
        const next = replaceAll
          ? original.split(oldString).join(newString)
          : original.replace(oldString, newString);
        await writeFile(abs, next, 'utf8');
        const delta = next.length - original.length;
        return `已编辑 ${shortRel(workspaceDir, abs)}（${delta >= 0 ? '+' : ''}${delta} 字符）`;
      } catch (err) {
        return `编辑失败: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });

  const globFilesTool = tool({
    name: 'glob_files',
    description: '按 glob pattern 匹配文件路径。支持 ** 多层通配。返回最多 200 条结果。',
    parameters: z.object({
      pattern: z.string().describe('如 ".claude/muicv/**/*.md"'),
    }),
    execute: async ({ pattern }) => {
      try {
        const out: string[] = [];
        for await (const entry of glob(pattern, { cwd: workspaceDir })) {
          out.push(entry);
          if (out.length >= 200) break;
        }
        if (out.length === 0) return '没有匹配的文件';
        return out.join('\n');
      } catch (err) {
        return `glob 失败: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });

  const grepTool = tool({
    name: 'grep',
    description: '在工作目录下用正则在文件里搜命中行。可用 path 限定子树，pattern 是 JS regex（不带 //）。',
    parameters: z.object({
      pattern: z.string().describe('JS regex 字符串，例：targets.*google'),
      path: z.string().optional().describe('限定子目录或单个文件；缺省整个工作目录'),
      flags: z.string().optional().default('i').describe('regex flags，默认 i'),
      maxResults: z.number().optional().default(60),
    }),
    execute: async ({ pattern, path, flags, maxResults }) => {
      try {
        const re = new RegExp(pattern, flags);
        const startPath = path ? resolveInWorkspace(workspaceDir, path) : workspaceDir;
        const startStat = await stat(startPath).catch(() => null);
        if (!startStat) return `路径不存在：${path ?? '.'}`;

        const hits: string[] = [];
        const queue: string[] = startStat.isDirectory() ? [startPath] : [];
        if (!startStat.isDirectory()) {
          await scanFile(startPath);
        }
        while (queue.length > 0 && hits.length < maxResults) {
          const dir = queue.shift();
          if (!dir) break;
          const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
          for (const e of entries) {
            if (e.name.startsWith('.') && e.name !== '.claude') continue; // 跳过隐藏，但 .claude 进
            const childAbs = join(dir, e.name);
            if (e.isDirectory()) {
              queue.push(childAbs);
            } else if (e.isFile()) {
              await scanFile(childAbs);
              if (hits.length >= maxResults) break;
            }
          }
        }
        async function scanFile(abs: string) {
          if (!/\.(md|txt|json|ya?ml|tsx?|jsx?|css|sql)$/i.test(abs)) return;
          try {
            const content = await readFile(abs, 'utf8');
            const lines = content.split('\n');
            const rel = shortRel(workspaceDir, abs);
            lines.forEach((line, idx) => {
              if (re.test(line) && hits.length < maxResults) {
                hits.push(`${rel}:${idx + 1}: ${line.trim().slice(0, 200)}`);
              }
            });
          } catch {
            /* skip unreadable */
          }
        }
        return hits.length > 0 ? hits.join('\n') : '没有匹配';
      } catch (err) {
        return `grep 失败: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });

  const listDirTool = tool({
    name: 'list_dir',
    description: '列出某目录下的文件 / 子目录（一层深）。',
    parameters: z.object({
      path: z.string().optional().default('.'),
    }),
    execute: async ({ path }) => {
      try {
        const abs = resolveInWorkspace(workspaceDir, path);
        const entries = await readdir(abs, { withFileTypes: true });
        if (entries.length === 0) return '(空目录)';
        return entries
          .filter((e) => !e.name.startsWith('.') || e.name === '.claude' || e.name === '.gitignore')
          .map((e) => `${e.isDirectory() ? '📁' : '📄'} ${e.name}`)
          .join('\n');
      } catch (err) {
        return `list 失败: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });

  return [readFileTool, writeFileTool, editFileTool, globFilesTool, grepTool, listDirTool];
}
