import type { Metadata } from 'next';
import { headers } from 'next/headers';

import { RESUME_SYNC_HISTORY_KEEP, RESUME_SYNC_MAX_SIZE_BYTES } from '@muicv/shared';

import { getAuth } from '@/lib/auth';
import { getResumeSyncStatus } from '@/lib/resume-sync';

import { HistoryRowActions, WipeButton } from './sync-actions';

export const metadata: Metadata = {
  title: '云同步',
};

export default async function ResumeSyncPage() {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;

  const status = await getResumeSyncStatus(session.user.id);

  return (
    <div className="space-y-8">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-yellow-deep">— 云同步</p>
        <h1 className="mt-3 text-[clamp(1.6rem,3.2vw,2.25rem)] font-extrabold leading-[1.15] tracking-tight text-ink">
          MuiCV 平台云同步
        </h1>
        <p className="mt-2 max-w-xl text-[14px] text-ink-soft">
          用 muicv-sync skill push 当前工作目录的所有 .md 文件到云端；新机器可以 pull 回来。云端只保留一份活动版 + 最近{' '}
          {RESUME_SYNC_HISTORY_KEEP} 份历史快照，单库上限 {(RESUME_SYNC_MAX_SIZE_BYTES / 1024).toLocaleString()} KB。
        </p>
      </header>

      <ActiveCard active={status.active} />

      <SkillHints />

      <HistoryList items={status.history} />
    </div>
  );
}

function ActiveCard({
  active,
}: {
  active: { hash: string; sizeBytes: number; fileCount: number; updatedAt: number } | null;
}) {
  if (!active) {
    return (
      <section className="rounded-2xl border-2 border-rule bg-paper p-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-mute">— 当前活动版</p>
        <h2 className="mt-2 text-[18px] font-extrabold text-ink">云端还没有任何快照</h2>
        <p className="mt-2 text-[13.5px] text-ink-soft">
          还没在 skill 里 push 过素材。先用 muicv-core 在工作目录里编辑好 profile / experience 等文件，再跟 muicv-sync
          说"同步到云端"。
        </p>
      </section>
    );
  }
  return (
    <section className="rounded-2xl border-2 border-ink bg-cream p-6 shadow-[0_4px_0_0_oklch(0.24_0.04_65)]">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-yellow-deep">— 当前活动版</p>
      <h2 className="mt-2 text-[18px] font-extrabold text-ink">
        云端 <span className="rounded-md bg-fluff px-2 py-0.5 font-mono tabular-nums">{active.fileCount}</span> 个文件 ·{' '}
        <span className="rounded-md bg-fluff px-2 py-0.5 font-mono tabular-nums">{formatSize(active.sizeBytes)}</span>
      </h2>
      <p className="mt-2 text-[13px] text-ink-soft">
        最后同步：<span className="font-mono">{formatTimestamp(active.updatedAt)}</span>
      </p>
      <p className="mt-1 break-all font-mono text-[11px] text-mute">hash {active.hash.slice(0, 16)}…</p>
      <div className="mt-5">
        <WipeButton />
      </div>
    </section>
  );
}

function SkillHints() {
  return (
    <section className="rounded-2xl border-2 border-ink bg-paper p-6">
      <h2 className="text-[16px] font-extrabold text-ink">在 muicv-sync skill 里怎么用</h2>
      <ol className="mt-3 space-y-2 text-[13.5px] leading-[1.7] text-ink-soft">
        <li>
          🐾 <span className="font-bold text-ink">推送到云端</span>：跟 muicv-sync 说"
          <span className="rounded bg-fluff px-1.5 py-0.5 font-mono text-[12px] text-yellow-deep">同步到云端</span>
          "，它会 Glob 工作目录的所有 .md，调用 <code className="font-mono">POST /resume/sync</code> 上传。
        </li>
        <li>
          🐾 <span className="font-bold text-ink">从云端拉取</span>：换一台新机器，告诉 muicv-sync"
          <span className="rounded bg-fluff px-1.5 py-0.5 font-mono text-[12px] text-yellow-deep">从云端恢复素材</span>
          "，它会调 <code className="font-mono">GET /resume/snapshot</code>，本地有冲突的文件先备份到{' '}
          <code className="font-mono">.muicv-pull-backup-*</code>，再写入云端版本。
        </li>
        <li>
          🐾 <span className="font-bold text-ink">前提</span>：本地要配好{' '}
          <code className="rounded bg-fluff px-1.5 py-0.5 font-mono text-[12px] text-yellow-deep">MUICV_API_KEY</code>
          （在 API Keys 页生成，写到 shell rc 里），skill 才能用 Bearer 鉴权。
        </li>
      </ol>
    </section>
  );
}

function HistoryList({
  items,
}: {
  items: Array<{ id: string; hash: string; sizeBytes: number; fileCount: number; archivedAt: number }>;
}) {
  return (
    <section className="rounded-2xl border-2 border-ink bg-cream p-6 shadow-[0_4px_0_0_oklch(0.24_0.04_65)]">
      <header>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-yellow-deep">— 历史快照</p>
        <h2 className="mt-2 text-[16px] font-extrabold text-ink">最近 {RESUME_SYNC_HISTORY_KEEP} 份归档</h2>
        <p className="mt-1 text-[12.5px] text-ink-soft">
          每次 push 之前，当前活动版会被搬到这里；超出保留份数的旧版会自动清理。
        </p>
      </header>

      {items.length === 0 ? (
        <p className="mt-5 text-[12.5px] text-mute">还没有历史快照。</p>
      ) : (
        <ul className="mt-5 divide-y divide-rule">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="text-[13.5px] font-bold text-ink">
                  {item.fileCount} 个文件 · {formatSize(item.sizeBytes)}
                </p>
                <p className="font-mono text-[11px] text-mute">
                  {formatTimestamp(item.archivedAt)} · hash {item.hash.slice(0, 12)}…
                </p>
              </div>
              <HistoryRowActions id={item.id} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
