import { useEffect, useState } from 'react';

import { useAppStore } from './store';

/**
 * 编辑器左栏的"按业务分组"文件清单。
 *
 * 不做真正的 file tree——muicv 的简历素材库结构是固定 6 组，扁平展示比树
 * 更直观、不会让用户迷路在 .claude/ 之类的内部目录里。
 */

export type EditorFileEntry = {
  /** 绝对路径，传给 fs.read / fs.write。 */
  path: string;
  /** 用来在 UI 列里显示的相对名（如 "experience/acme-2023.md"）。 */
  label: string;
  /** 文件名（不含目录），方便单独高亮。 */
  name: string;
};

export type EditorGroup = {
  label: string;
  /**
   * `flat`：一组固定的顶层文件（profile.md / education.md 等）。
   * `dir`：列出某个目录下所有 .md 文件。
   */
  kind: 'flat' | 'dir';
  /** 'flat' 时使用：相对 workspace 的固定文件名列表。 */
  files?: string[];
  /** 'dir' 时使用：相对 workspace 的目录名。 */
  dir?: string;
  /** 实际拉到的文件项（hook 内部填充）。 */
  entries: EditorFileEntry[];
  /** 加载状态，用来给空目录显示"暂无"或"加载中"。 */
  loaded: boolean;
};

const GROUP_DEFINITIONS: Omit<EditorGroup, 'entries' | 'loaded'>[] = [
  {
    label: '个人信息',
    kind: 'flat',
    files: ['profile.md', 'skills.md', 'education.md', 'achievements.md'],
  },
  { label: '工作经历', kind: 'dir', dir: 'experience' },
  { label: '项目', kind: 'dir', dir: 'projects' },
  { label: '目标 JD', kind: 'dir', dir: 'targets' },
  { label: '简历版本', kind: 'dir', dir: 'versions' },
  { label: '求职申请', kind: 'dir', dir: 'applications' },
];

function joinPath(base: string, name: string): string {
  return base.endsWith('/') ? `${base}${name}` : `${base}/${name}`;
}

/** 拉一个目录下的 .md 文件，过滤掉子目录和非 markdown。 */
async function listMarkdownFiles(dirPath: string, displayPrefix: string): Promise<EditorFileEntry[]> {
  const entries = await window.muicv.fs.listDir(dirPath);
  if (!entries) return [];
  return entries
    .filter((e) => !e.isDirectory && (e.name.endsWith('.md') || e.name.endsWith('.markdown')))
    .map((e) => ({
      path: e.path,
      label: `${displayPrefix}/${e.name}`,
      name: e.name,
    }));
}

/** 检查一组固定文件中哪些真实存在（用 read 试探，存在才入列表）。 */
async function probeFlatFiles(workspaceDir: string, files: string[]): Promise<EditorFileEntry[]> {
  const out: EditorFileEntry[] = [];
  for (const name of files) {
    const path = joinPath(workspaceDir, name);
    const content = await window.muicv.fs.read(path);
    if (content !== null) {
      out.push({ path, label: name, name });
    }
  }
  return out;
}

export function useEditorGroups(): { groups: EditorGroup[]; reload: () => void } {
  const workspaceDir = useAppStore((s) => s.activeProfile?.dir ?? null);
  const [tick, setTick] = useState(0);
  const [groups, setGroups] = useState<EditorGroup[]>(() =>
    GROUP_DEFINITIONS.map((g) => ({ ...g, entries: [], loaded: false })),
  );

  useEffect(() => {
    if (!workspaceDir) {
      setGroups(GROUP_DEFINITIONS.map((g) => ({ ...g, entries: [], loaded: true })));
      return;
    }

    let cancelled = false;
    (async () => {
      const next = await Promise.all(
        GROUP_DEFINITIONS.map(async (g) => {
          if (g.kind === 'flat') {
            const entries = await probeFlatFiles(workspaceDir, g.files ?? []);
            return { ...g, entries, loaded: true };
          }
          const dirAbs = joinPath(workspaceDir, g.dir ?? '');
          const entries = await listMarkdownFiles(dirAbs, g.dir ?? '');
          return { ...g, entries, loaded: true };
        }),
      );
      if (!cancelled) setGroups(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [workspaceDir, tick]);

  return { groups, reload: () => setTick((n) => n + 1) };
}
