import { CircleIcon, FloppyDiskIcon, FolderOpenIcon, WarningIcon } from '@phosphor-icons/react';
import { useCallback, useEffect, useState } from 'react';

import { useAppStore } from '../lib/store';
import { type EditorFileEntry, useEditorGroups } from '../lib/use-editor-groups';
import { CodeMirrorEditor } from './editor/codemirror-editor';
import { FileGroupList } from './editor/file-group-list';
import { ConfirmDialog } from './confirm-dialog';

/**
 * 简历素材编辑器视图（issue #3）。
 *
 * 自带左侧文件清单 + 中间 CodeMirror + 顶部工具栏，作为整个 main view 而不是
 * 嵌在 chat 内——简历素材编辑跟对话是平行的工作模式，不应该共享 chat 的
 * conversation 上下文。
 *
 * 第一版只做"读 + 改 + 存"。新建 / 删除 / 重命名 / 预览 全部不做，由用户走
 * Finder 或 muicv-core skill。
 */

function formatHHMMSS(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function EditorView() {
  const activeProfile = useAppStore((s) => s.activeProfile);
  const editorOpenPath = useAppStore((s) => s.editorOpenPath);
  const editorBuffer = useAppStore((s) => s.editorBuffer);
  const editorOriginal = useAppStore((s) => s.editorOriginal);
  const editorSaving = useAppStore((s) => s.editorSaving);
  const editorLastSavedAt = useAppStore((s) => s.editorLastSavedAt);
  const editorError = useAppStore((s) => s.editorError);
  const openEditorFile = useAppStore((s) => s.openEditorFile);
  const setEditorBuffer = useAppStore((s) => s.setEditorBuffer);
  const saveEditor = useAppStore((s) => s.saveEditor);
  const closeEditorFile = useAppStore((s) => s.closeEditorFile);

  const { groups } = useEditorGroups();

  const dirty = editorBuffer !== editorOriginal;
  const [savedJustNow, setSavedJustNow] = useState(false);
  const [pendingSelect, setPendingSelect] = useState<EditorFileEntry | null>(null);

  const handleSave = useCallback(async () => {
    const r = await saveEditor();
    if (r.ok) {
      setSavedJustNow(true);
    }
  }, [saveEditor]);

  // 保存成功后 2s 内显示"已保存 hh:mm:ss"，之后回常态
  useEffect(() => {
    if (!savedJustNow) return;
    const t = setTimeout(() => setSavedJustNow(false), 2000);
    return () => clearTimeout(t);
  }, [savedJustNow]);

  // 离开 editor view 时关掉当前文件，避免下次回来还停留在旧文件
  useEffect(() => {
    return () => {
      closeEditorFile();
    };
  }, [closeEditorFile]);

  function handleSelect(entry: EditorFileEntry) {
    if (dirty && editorOpenPath !== entry.path) {
      setPendingSelect(entry);
      return;
    }
    void openEditorFile(entry.path);
  }

  function handleDiscardAndSwitch() {
    const target = pendingSelect;
    setPendingSelect(null);
    if (target) void openEditorFile(target.path);
  }

  if (!activeProfile) {
    return (
      <div className="flex h-full items-center justify-center bg-cream p-8 text-center text-[13px] text-mute">
        请先选择 / 创建一个职业档案再编辑简历素材。
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 bg-cream">
      <aside className="flex w-[240px] shrink-0 flex-col border-r-2 border-rule bg-cream">
        <FileGroupList groups={groups} activePath={editorOpenPath} onSelect={handleSelect} />
      </aside>
      <section className="flex min-w-0 flex-1 flex-col">
        <Toolbar
          path={editorOpenPath}
          dirty={dirty}
          saving={editorSaving}
          savedJustNow={savedJustNow}
          lastSavedAt={editorLastSavedAt}
          error={editorError}
          onSave={handleSave}
          canSave={Boolean(editorOpenPath) && dirty && !editorSaving}
        />
        <div className="min-h-0 flex-1">
          {editorOpenPath ? (
            editorError && !editorBuffer ? (
              <EmptyState message={editorError} />
            ) : (
              <CodeMirrorEditor value={editorBuffer} onChange={setEditorBuffer} onSave={handleSave} />
            )
          ) : (
            <EmptyHint />
          )}
        </div>
      </section>

      <ConfirmDialog
        open={pendingSelect !== null}
        title="丢弃未保存的修改？"
        description={
          <>
            当前文件还有未保存的修改。
            <br />
            <span className="text-mute">取消可以先按 ⌘S 保存再切换。</span>
          </>
        }
        confirmLabel="丢弃并切换"
        destructive
        onConfirm={handleDiscardAndSwitch}
        onCancel={() => setPendingSelect(null)}
      />
    </div>
  );
}

function Toolbar(props: {
  path: string | null;
  dirty: boolean;
  saving: boolean;
  savedJustNow: boolean;
  lastSavedAt: number | null;
  error: string | null;
  canSave: boolean;
  onSave: () => void;
}) {
  const showInFolder = useCallback(() => {
    if (props.path) void window.muicv.fs.showInFolder(props.path);
  }, [props.path]);

  return (
    <div className="flex shrink-0 items-center gap-3 border-b-2 border-rule bg-cream px-4 py-2">
      <div className="min-w-0 flex-1 truncate text-[12.5px] font-bold text-ink">
        {props.path ? props.path.split('/').pop() : '未打开文件'}
      </div>
      <div className="flex shrink-0 items-center gap-3 text-[11.5px]">
        {props.error ? (
          <span className="flex items-center gap-1 text-tongue">
            <WarningIcon size={12} weight="bold" />
            {props.error}
          </span>
        ) : props.saving ? (
          <span className="text-mute">保存中…</span>
        ) : props.savedJustNow && props.lastSavedAt ? (
          <span className="text-yellow-deep">已保存 {formatHHMMSS(props.lastSavedAt)}</span>
        ) : props.dirty ? (
          <span className="flex items-center gap-1 text-yellow-deep">
            <CircleIcon size={8} weight="fill" />
            未保存
          </span>
        ) : props.path ? (
          <span className="text-mute">已同步</span>
        ) : null}
        {props.path && (
          <button
            type="button"
            onClick={showInFolder}
            title="在 Finder 里打开"
            className="rounded-md px-1.5 py-1 text-mute hover:bg-fluff hover:text-ink"
          >
            <FolderOpenIcon size={14} />
          </button>
        )}
        <button
          type="button"
          onClick={props.onSave}
          disabled={!props.canSave}
          title="保存（⌘S）"
          className="press inline-flex items-center gap-1 rounded-md bg-yellow px-2.5 py-1 text-[11.5px] font-bold text-ink disabled:opacity-50"
        >
          <FloppyDiskIcon size={12} weight="bold" />
          保存
        </button>
      </div>
    </div>
  );
}

function EmptyHint() {
  return (
    <div className="flex h-full items-center justify-center bg-paper p-8 text-center text-[13px] text-mute">
      左侧选一个文件开始编辑。
      <br />
      新建 / 删除 / 重命名请在 Finder 或 chat 里让 muicv-core 处理。
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center bg-paper p-8 text-center text-[13px] text-tongue">
      {message}
    </div>
  );
}
