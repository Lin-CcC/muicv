import { useEffect, useRef, useState } from 'react';

import type { Profile } from '../../shared/types.ts';
import { useAppStore } from '../lib/store';
import { ConfirmDialog } from './confirm-dialog';
import { ConversationList } from './conversation-list';
import { CorgiMascot } from './corgi-mascot';

const PLAN_LABEL: Record<string, string> = {
  free: '免费版',
  pro: 'Pro 会员',
  max: 'Max 会员',
};

/**
 * 左栏：profile 切换器（顶部）+ 对话列表（中部）+ 用户菜单（底部）。
 *
 * 整个侧栏整合 IDE 风格的"navigator"功能。原顶栏的 profile 切换 / 用户状态都搬到这。
 */
export function SidebarLeft() {
  return (
    <aside className="flex h-full w-full flex-col border-r-2 border-ink bg-cream/95">
      <ProfileSection />
      <div className="h-px bg-rule" />
      <ConversationList />
      <div className="h-px bg-rule" />
      <UserSection />
    </aside>
  );
}

// -------------------- Profile section --------------------

function ProfileSection() {
  const profiles = useAppStore((s) => s.config.profiles);
  const activeProfile = useAppStore((s) => s.activeProfile);
  const switchProfile = useAppStore((s) => s.switchProfile);
  const renameProfile = useAppStore((s) => s.renameProfile);
  const removeProfile = useAppStore((s) => s.removeProfile);
  const openInFinder = useAppStore((s) => s.openProfileInFinder);
  const createPick = useAppStore((s) => s.createProfilePickFolder);

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[role="dialog"]')) return;
      if (ref.current && !ref.current.contains(target)) setOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-3 text-left hover:bg-fluff/60"
      >
        <CorgiMascot className="h-7 w-7 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-yellow-deep" />
            <span className="truncate text-[13px] font-bold text-ink">{activeProfile?.name ?? 'Mui简历'}</span>
          </span>
          {activeProfile && (
            <span className="block truncate font-mono text-[10.5px] text-mute" title={activeProfile.dir}>
              {activeProfile.dir}
            </span>
          )}
        </span>
        <span className="text-[11px] text-mute">▾</span>
      </button>

      {open && (
        <div className="absolute left-2 right-2 top-full z-50 mt-1 rounded-xl border-2 border-ink bg-cream p-1.5 shadow-[0_5px_0_0_var(--color-ink)]">
          <div className="max-h-[40vh] overflow-y-auto">
            {profiles.map((p) => (
              <ProfileItem
                key={p.id}
                profile={p}
                isActive={p.id === activeProfile?.id}
                canDelete={profiles.length > 1}
                onSwitch={() => {
                  if (p.id !== activeProfile?.id) void switchProfile(p.id);
                  setOpen(false);
                }}
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
      className={`group flex items-center gap-1 rounded-md px-2 py-1.5 ${isActive ? 'bg-fluff' : 'hover:bg-fluff/60'}`}
    >
      <button type="button" onClick={onSwitch} className="flex min-w-0 flex-1 flex-col items-start text-left">
        <div className="flex items-center gap-1.5">
          {isActive && <span className="text-[10px] text-yellow-deep">●</span>}
          <span className="truncate text-[13px] font-bold text-ink">{profile.name}</span>
        </div>
        <p className="truncate font-mono text-[10.5px] text-mute" title={profile.dir}>
          {profile.dir}
        </p>
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

// -------------------- User section（底部） --------------------

function UserSection() {
  const session = useAppStore((s) => s.session);
  const setView = useAppStore((s) => s.setView);
  const logout = useAppStore((s) => s.logout);

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (ref.current && !ref.current.contains(target)) setOpen(false);
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  if (!session) return null;
  const planLabel = PLAN_LABEL[session.plan] ?? session.plan;

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-fluff/60"
      >
        <Avatar session={session} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12px] font-bold text-ink">{session.email}</span>
          <span className="block text-[10.5px] text-mute">{planLabel}</span>
        </span>
        <span className="text-[11px] text-mute">{open ? '▾' : '▴'}</span>
      </button>

      {open && (
        <div className="absolute bottom-full left-2 right-2 mb-1 rounded-xl border-2 border-ink bg-cream p-1 shadow-[0_5px_0_0_var(--color-ink)]">
          <button
            type="button"
            onClick={() => {
              setView('settings');
              setOpen(false);
            }}
            className="block w-full rounded-md px-3 py-2 text-left text-[12.5px] font-medium text-ink hover:bg-fluff"
          >
            ⚙ 设置
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              void logout();
            }}
            className="block w-full rounded-md px-3 py-2 text-left text-[12.5px] font-medium text-tongue hover:bg-tongue/10"
          >
            退出登录
          </button>
        </div>
      )}
    </div>
  );
}

function Avatar({ session }: { session: { name: string; image: string | null } }) {
  if (session.image) {
    return (
      <img src={session.image} alt="" className="h-7 w-7 shrink-0 rounded-full border-2 border-ink object-cover" />
    );
  }
  const initial = session.name?.[0]?.toUpperCase() || 'M';
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-yellow text-[12px] font-extrabold text-ink">
      {initial}
    </div>
  );
}
