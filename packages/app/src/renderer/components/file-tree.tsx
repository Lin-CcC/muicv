import { useEffect, useState } from 'react';

type Entry = { name: string; path: string; isDirectory: boolean };

/**
 * 简易递归文件树。点目录展开/收起；点文件触发 onPickFile（一般转 right panel preview 模式）。
 *
 * 目录展开靠 expanded set 维护（路径作 key）。每个目录第一次展开时拉子项缓存；
 * 关掉再开不会重新拉（避免抖动）。
 */
export function FileTree({ rootPath, onPickFile }: { rootPath: string; onPickFile: (path: string) => void }) {
  return (
    <div className="font-mono text-[12.5px] leading-[1.6] text-ink-soft">
      <DirNode path={rootPath} name={shortName(rootPath)} depth={0} startExpanded onPickFile={onPickFile} />
    </div>
  );
}

function DirNode({
  path,
  name,
  depth,
  startExpanded = false,
  onPickFile,
}: {
  path: string;
  name: string;
  depth: number;
  startExpanded?: boolean;
  onPickFile: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(startExpanded);
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!expanded || entries !== null || loading) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void window.muicv.fs.listDir(path).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (res === null) setError('读不到');
      else setEntries(res);
    });
    return () => {
      cancelled = true;
    };
  }, [expanded, entries, loading, path]);

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        style={{ paddingLeft: depth * 12 + 8 }}
        className="flex w-full items-center gap-1 rounded py-0.5 pr-2 text-left hover:bg-fluff"
      >
        <span className="w-3 text-[10px] text-mute">{expanded ? '▾' : '▸'}</span>
        <span className="text-[13px]">📁</span>
        <span className="truncate text-[12.5px] font-bold text-ink">{name}</span>
      </button>
      {expanded && (
        <div>
          {loading && (
            <div style={{ paddingLeft: (depth + 1) * 12 + 8 }} className="py-0.5 text-[11.5px] text-mute">
              读取中…
            </div>
          )}
          {error && (
            <div style={{ paddingLeft: (depth + 1) * 12 + 8 }} className="py-0.5 text-[11.5px] text-tongue">
              {error}
            </div>
          )}
          {entries && entries.length === 0 && (
            <div style={{ paddingLeft: (depth + 1) * 12 + 8 }} className="py-0.5 text-[11.5px] text-mute">
              (空)
            </div>
          )}
          {entries?.map((e) =>
            e.isDirectory ? (
              <DirNode key={e.path} path={e.path} name={e.name} depth={depth + 1} onPickFile={onPickFile} />
            ) : (
              <FileNode key={e.path} path={e.path} name={e.name} depth={depth + 1} onPickFile={onPickFile} />
            ),
          )}
        </div>
      )}
    </div>
  );
}

function FileNode({
  path,
  name,
  depth,
  onPickFile,
}: {
  path: string;
  name: string;
  depth: number;
  onPickFile: (path: string) => void;
}) {
  const icon = fileIcon(name);
  return (
    <button
      type="button"
      onClick={() => onPickFile(path)}
      style={{ paddingLeft: depth * 12 + 8 + 16 /* 跟目录的展开图标对齐 */ }}
      className="flex w-full items-center gap-1 rounded py-0.5 pr-2 text-left hover:bg-fluff"
      title={path}
    >
      <span className="text-[13px]">{icon}</span>
      <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink-soft">{name}</span>
    </button>
  );
}

function fileIcon(name: string): string {
  if (/\.md$/i.test(name)) return '📄';
  if (/\.pdf$/i.test(name)) return '📕';
  if (/\.json$/i.test(name)) return '🔧';
  if (/\.(png|jpe?g|gif|webp|svg)$/i.test(name)) return '🖼';
  return '📃';
}

function shortName(path: string): string {
  return path.split(/[/\\]/).pop() || path;
}
