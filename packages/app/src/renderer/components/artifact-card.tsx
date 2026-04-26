import type { ArtifactKind, ArtifactRef } from '../../shared/types.ts';

const KIND_META: Record<ArtifactKind, { emoji: string; label: string }> = {
  profile: { emoji: '🪪', label: '个人资料' },
  experience: { emoji: '💼', label: '工作经历' },
  project: { emoji: '🛠️', label: '项目' },
  'jd-target': { emoji: '🎯', label: '岗位 JD' },
  'resume-version': { emoji: '📄', label: '简历版本' },
  'critique-report': { emoji: '🔍', label: '评审报告' },
  'cover-letter': { emoji: '✉️', label: 'Cover Letter' },
  other: { emoji: '📎', label: '文件' },
};

/**
 * 在对话流里渲染的工件卡片：agent 写 / 读了某个文件后，main 推一个 artifact
 * chunk 给 renderer，渲染层把它插到当前 assistant 消息下方。点击 → 右栏打开预览。
 */
export function ArtifactCard({ artifact, onOpen }: { artifact: ArtifactRef; onOpen: () => void }) {
  const meta = KIND_META[artifact.kind];
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full items-center gap-3 rounded-xl border-2 border-rule-strong bg-cream px-3 py-2.5 text-left transition hover:border-ink hover:bg-fluff"
    >
      <span className="text-[20px]">{meta.emoji}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-bold text-ink">{artifact.title}</span>
        <span className="block text-[11px] text-mute">{meta.label} · 点击在右栏预览</span>
      </span>
      <span className="text-[12px] text-mute group-hover:text-ink">→</span>
    </button>
  );
}
