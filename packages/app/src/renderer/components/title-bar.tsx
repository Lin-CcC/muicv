import { useEffect, useRef, useState } from 'react';

import type { Profile } from '../../shared/types.ts';
import { useAppStore } from '../lib/store';
import { ConfirmDialog } from './confirm-dialog';
import { CorgiMascot } from './corgi-mascot';

const PLAN_LABEL: Record<string, string> = {
  free: '免费版',
  pro: 'Pro',
  max: 'Max',
};

/**
 * macOS hidden titlebar 顶栏：
 * - 整条可拖动（titlebar-drag），子元素可点（titlebar-no-drag）
 * - 已登录时显示 profile 切换器 + 会员档位 chip
 *
 * Profile 管理（切换 / 重命名 / 在 finder 打开 / 删除 / 新建）全部在这里完成，
 * 不进入 settings —— 这是日常操作。
 */
export function TitleBar() {
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);
  const session = useAppStore((s) => s.session);
  const activeChannel = useAppStore((s) => s.activeChannel);
  const busy = activeChannel !== null;

  const showTabs = !!session && (view === 'chat' || view === 'settings');

  return (
    <header className="titlebar-drag flex h-11 shrink-0 items-center justify-between border-b border-rule bg-cream/85 pl-[80px] pr-3 backdrop-blur-sm">
      <div className="titlebar-no-drag flex items-center gap-2.5">
        <CorgiMascot className="h-6 w-6" />
        <span className="text-[14px] font-bold tracking-tight">Mui简历</span>

        {session && <ProfileSwitcher />}

        {session && (
          <button
            type="button"
            onClick={() => setView('settings')}
            title={`会员档位：${PLAN_LABEL[session.plan] ?? session.plan}（点击查看）`}
            className="hidden items-center gap-1 rounded-full border border-rule bg-paper px-2 py-0.5 font-mono text-[10px] font-semibold text-ink-soft hover:bg-fluff hover:text-ink sm:inline-flex"
          >
            {PLAN_LABEL[session.plan] ?? session.plan}
          </button>
        )}

        {busy && (
          <span className="ml-1 inline-flex items-center gap-1.5 rounded-full bg-fluff px-2 py-0.5 font-mono text-[10px] font-semibold text-yellow-deep">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-yellow" />
            思考中
          </span>
        )}
      </div>

      {showTabs && (
        <nav className="titlebar-no-drag flex items-center gap-1 text-[12px]">
          <NavTab active={view === 'chat'} onClick={() => setView('chat')}>
            对话
          </NavTab>
          <NavTab active={view === 'settings'} onClick={() => setView('settings')}>
            设置
          </NavTab>
        </nav>
      )}
    </header>
  );
}

/**
 * Profile 切换器（自洽）：列出所有简历 + 切换 + 行内重命名/finder/删除 + 内联新建。
 * 不跳 settings —— 简历管理是高频操作，全部在这里做。
 *
 * 关闭策略：document-level mousedown 监听（点 dropdown 外面关）。不能用
 * fixed-inset-0 overlay，因为 titlebar 的 -webkit-app-region: drag 会把
 * 点击事件交给 OS 当作拖动窗口，overlay 抓不住。
 */
function ProfileSwitcher() {
  const profiles = useAppStore((s) => s.config.profiles);
  const activeProfile = useAppStore((s) => s.activeProfile);
  const switchProfile = useAppStore((s) => s.switchProfile);
  const renameProfile = useAppStore((s) => s.renameProfile);
  const removeProfile = useAppStore((s) => s.removeProfile);
  const openInFinder = useAppStore((s) => s.openProfileInFinder);
  const createPick = useAppStore((s) => s.createProfilePickFolder);
  const resetMessages = useAppStore((s) => s.resetMessages);

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      // 点击 ConfirmDialog（被 portal 到 body 的）不算"点 dropdown 外面"——
      // 否则 dropdown 会关掉，dialog 也跟着卸载，按钮点击丢失。
      if (target.closest('[role="dialog"]')) return;
      if (ref.current && !ref.current.contains(target)) {
        setOpen(false);
      }
    };
    // 用 mousedown 而不是 click，避免 click 事件被 titlebar drag 区域吃掉
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  if (profiles.length === 0) return null;

  async function onSwitch(id: string) {
    if (id !== activeProfile?.id) {
      resetMessages();
      await switchProfile(id);
    }
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="切换简历"
        className="inline-flex items-center gap-1.5 rounded-full border border-rule bg-paper px-2.5 py-0.5 text-[11.5px] font-bold text-ink hover:bg-fluff"
      >
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-yellow-deep" />
        <span className="max-w-[140px] truncate">{activeProfile?.name ?? '未选择'}</span>
        <span className="text-mute">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-80 rounded-xl border-2 border-ink bg-cream p-1.5 shadow-[0_5px_0_0_var(--color-ink)]">
          <div className="max-h-[60vh] overflow-y-auto">
            {profiles.map((p) => (
              <ProfileItem
                key={p.id}
                profile={p}
                isActive={p.id === activeProfile?.id}
                canDelete={profiles.length > 1}
                onSwitch={() => void onSwitch(p.id)}
                onRename={(name) => void renameProfile(p.id, name)}
                onRemove={() => void removeProfile(p.id)}
                onOpenInFinder={() => void openInFinder(p.id)}
              />
            ))}
          </div>
          <div className="my-1 h-px bg-rule" />
          <CreateInline
            onCreate={async (name) => {
              const r = await createPick(name);
              if (r.ok) setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

function ProfileItem({
  profile,
  isActive,
  canDelete,
  onSwitch,
  onRename,
  onRemove,
  onOpenInFinder,
}: {
  profile: Profile;
  isActive: boolean;
  canDelete: boolean;
  onSwitch: () => void;
  onRename: (name: string) => void;
  onRemove: () => void;
  onOpenInFinder: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(profile.name);
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => setName(profile.name), [profile.name]);

  function commit() {
    if (name.trim() && name !== profile.name) onRename(name.trim());
    setRenaming(false);
  }

  if (renaming) {
    return (
      <div className="rounded-md border-2 border-ink bg-fluff px-2 py-1.5">
        <input
          type="text"
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') {
              setName(profile.name);
              setRenaming(false);
            }
          }}
          className="block w-full rounded-md bg-cream px-2 py-1 text-[13px] font-bold text-ink focus:outline-none"
        />
      </div>
    );
  }

  return (
    <div
      className={`group flex items-center gap-1.5 rounded-md px-2 py-1.5 ${
        isActive ? 'bg-fluff' : 'hover:bg-fluff/60'
      }`}
    >
      <button
        type="button"
        onClick={onSwitch}
        className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left"
        title={isActive ? '当前在用' : '切到这个'}
      >
        <div className="flex items-center gap-1.5">
          {isActive && <span className="text-[10px] text-yellow-deep">●</span>}
          <span className="truncate text-[13px] font-bold text-ink">{profile.name}</span>
        </div>
        <div className="truncate font-mono text-[10.5px] text-mute">{profile.dir}</div>
      </button>

      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
        <IconBtn title="重命名" onClick={() => setRenaming(true)}>
          ✎
        </IconBtn>
        <IconBtn title="在文件管理器里打开" onClick={onOpenInFinder}>
          📁
        </IconBtn>
        {canDelete && (
          <IconBtn title="从列表里移除（不删文件）" onClick={() => setConfirmRemove(true)} danger>
            ✕
          </IconBtn>
        )}
      </div>

      <ConfirmDialog
        open={confirmRemove}
        title={`从 app 里移除「${profile.name}」？`}
        description={
          <>
            只是从列表去掉，磁盘上的文件不会删。
            <br />
            <span className="font-mono text-[11px] text-mute">{profile.dir}</span>
          </>
        }
        confirmLabel="移除"
        destructive
        onConfirm={() => {
          setConfirmRemove(false);
          onRemove();
        }}
        onCancel={() => setConfirmRemove(false)}
      />
    </div>
  );
}

function IconBtn({
  title,
  onClick,
  children,
  danger,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`rounded px-1.5 py-0.5 text-[11px] ${
        danger ? 'text-mute hover:bg-tongue/10 hover:text-tongue' : 'text-mute hover:bg-paper hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}

function CreateInline({ onCreate }: { onCreate: (name: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="block w-full rounded-md px-2 py-1.5 text-left text-[12.5px] text-yellow-deep hover:bg-fluff"
      >
        + 新建一份简历
      </button>
    );
  }

  return (
    <div className="space-y-1.5 rounded-md border-2 border-ink bg-fluff p-2">
      <input
        type="text"
        value={name}
        autoFocus
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void onCreate(name.trim());
          if (e.key === 'Escape') {
            setEditing(false);
            setName('');
          }
        }}
        placeholder="例如：求职 2026 / 老婆的"
        className="block w-full rounded-md border-2 border-rule-strong bg-cream px-2 py-1 text-[12.5px] text-ink placeholder:text-mute focus:border-ink focus:outline-none"
      />
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => name.trim() && void onCreate(name.trim())}
          disabled={!name.trim()}
          className="press inline-flex flex-1 items-center justify-center rounded-md bg-yellow px-2 py-1 text-[11.5px] font-bold text-ink disabled:opacity-50"
        >
          选择目录
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setName('');
          }}
          className="rounded-md px-2 py-1 text-[11.5px] text-mute hover:text-ink"
        >
          取消
        </button>
      </div>
    </div>
  );
}

function NavTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1 font-semibold transition ${
        active ? 'bg-yellow text-ink' : 'text-ink-soft hover:bg-fluff hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}
