import { useEffect, useState } from 'react';

type Entry = { name: string; path: string; isDirectory: boolean };

/**
 * 简易递归文件树。点目录展开/收起；点文件触发 onPickFile（一般转 right panel preview 模式）。
 *
 * 根目录不再作为节点显示 —— FileTree 直接挂 DirChildren，平铺 rootPath 下的子项。
 * 目录第一次展开后即使再收起，子树仍以 display:none 隐藏，entries 状态保留，
 * 关掉再开不会重新拉（避免抖动）。
 */
export function FileTree({ rootPath, onPickFile }: { rootPath: string; onPickFile: (path: string) => void }) {
  return (
    <div className="font-mono text-[12.5px] leading-[1.6] text-ink-soft">
      <DirChildren path={rootPath} depth={0} onPickFile={onPickFile} />
    </div>
  );
}

/**
 * 加载并平铺渲染 path 下的子项。
 * 给 FileTree 根用（depth=0）也给 DirNode 展开后用（depth=parentDepth+1）。
 */
function DirChildren({ path, depth, onPickFile }: { path: string; depth: number; onPickFile: (path: string) => void }) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (entries !== null) return;
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
  }, [entries, path]);

  const padLeft = depth * 12 + 8;

  if (loading) {
    return (
      <div style={{ paddingLeft: padLeft }} className="py-0.5 text-[11.5px] text-mute">
        读取中…
      </div>
    );
  }
  if (error) {
    return (
      <div style={{ paddingLeft: padLeft }} className="py-0.5 text-[11.5px] text-tongue">
        {error}
      </div>
    );
  }
  if (entries && entries.length === 0) {
    return (
      <div style={{ paddingLeft: padLeft }} className="py-0.5 text-[11.5px] text-mute">
        (空)
      </div>
    );
  }
  return (
    <>
      {entries?.map((e) =>
        e.isDirectory ? (
          <DirNode key={e.path} path={e.path} name={e.name} depth={depth} onPickFile={onPickFile} />
        ) : (
          <FileNode key={e.path} path={e.path} name={e.name} depth={depth} onPickFile={onPickFile} />
        ),
      )}
    </>
  );
}

function DirNode({
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
  const [expanded, setExpanded] = useState(false);
  const [everExpanded, setEverExpanded] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setEverExpanded(true);
          setExpanded((v) => !v);
        }}
        style={{ paddingLeft: depth * 12 + 8 }}
        className="flex w-full items-center gap-1 rounded py-0.5 pr-2 text-left hover:bg-fluff"
      >
        <span className="w-3 text-[10px] text-mute">{expanded ? '▾' : '▸'}</span>
        <span className="text-[13px]">📁</span>
        <span className="truncate text-[12.5px] font-bold text-ink">{name}</span>
      </button>
      {everExpanded && (
        <div style={{ display: expanded ? undefined : 'none' }}>
          <DirChildren path={path} depth={depth + 1} onPickFile={onPickFile} />
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
