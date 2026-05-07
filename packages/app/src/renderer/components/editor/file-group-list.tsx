import { FileTextIcon } from '@phosphor-icons/react';

import type { EditorFileEntry, EditorGroup } from '../../lib/use-editor-groups';

/**
 * 编辑器左栏文件清单：按业务分组（个人信息 / 工作经历 / 项目 / ...）
 * 扁平展示。每组一个标题 + 文件列表；点击文件触发 onSelect。
 */
export function FileGroupList({
  groups,
  activePath,
  onSelect,
}: {
  groups: EditorGroup[];
  activePath: string | null;
  onSelect: (entry: EditorFileEntry) => void;
}) {
  return (
    <nav className="flex h-full min-h-0 flex-col overflow-y-auto px-2 py-3">
      {groups.map((g) => (
        <Group key={g.label} group={g} activePath={activePath} onSelect={onSelect} />
      ))}
    </nav>
  );
}

function Group({
  group,
  activePath,
  onSelect,
}: {
  group: EditorGroup;
  activePath: string | null;
  onSelect: (entry: EditorFileEntry) => void;
}) {
  return (
    <div className="mb-3">
      <div className="px-2 py-1 text-[10.5px] font-bold uppercase tracking-wider text-mute">{group.label}</div>
      {!group.loaded && <div className="px-2 py-1 text-[12px] text-mute">…</div>}
      {group.loaded && group.entries.length === 0 && <div className="px-2 py-1 text-[12px] text-mute">暂无</div>}
      <ul className="space-y-0.5">
        {group.entries.map((entry) => {
          const active = entry.path === activePath;
          return (
            <li key={entry.path}>
              <button
                type="button"
                onClick={() => onSelect(entry)}
                title={entry.path}
                className={`flex w-full min-w-0 items-center gap-1.5 rounded-md px-2 py-1 text-left text-[12.5px] ${
                  active ? 'bg-fluff font-bold text-ink' : 'text-ink-soft hover:bg-fluff/60 hover:text-ink'
                }`}
              >
                <FileTextIcon size={12} className="shrink-0 text-mute" />
                <span className="min-w-0 flex-1 truncate">{entry.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
