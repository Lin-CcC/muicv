import {
  ArrowRightIcon,
  BriefcaseIcon,
  EnvelopeIcon,
  FileTextIcon,
  type Icon,
  IdentificationCardIcon,
  LinkSimpleIcon,
  MagnifyingGlassIcon,
  PaperclipIcon,
  TargetIcon,
  WrenchIcon,
} from '@phosphor-icons/react';

import type { ArtifactKind, ArtifactRef } from '../../shared/types.ts';

const KIND_META: Record<ArtifactKind, { Icon: Icon; label: string; hint: string }> = {
  profile: { Icon: IdentificationCardIcon, label: '个人资料', hint: '点击在右栏预览' },
  experience: { Icon: BriefcaseIcon, label: '工作经历', hint: '点击在右栏预览' },
  project: { Icon: WrenchIcon, label: '项目', hint: '点击在右栏预览' },
  'jd-target': { Icon: TargetIcon, label: '岗位 JD', hint: '点击在右栏预览' },
  'resume-version': { Icon: FileTextIcon, label: '简历版本', hint: '点击在右栏预览' },
  'resume-preview': { Icon: LinkSimpleIcon, label: '在线预览', hint: '点击在浏览器打开 · 选模板 / 下载 PDF' },
  'critique-report': { Icon: MagnifyingGlassIcon, label: '评审报告', hint: '点击在右栏预览' },
  'cover-letter': { Icon: EnvelopeIcon, label: 'Cover Letter', hint: '点击在右栏预览' },
  other: { Icon: PaperclipIcon, label: '文件', hint: '点击在右栏预览' },
};

/**
 * 在对话流里渲染的工件卡片：agent 写 / 读了某个文件后，main 推一个 artifact
 * chunk 给 renderer，渲染层把它插到当前 assistant 消息下方。点击 → 右栏打开预览。
 */
export function ArtifactCard({ artifact, onOpen }: { artifact: ArtifactRef; onOpen: () => void }) {
  const meta = KIND_META[artifact.kind];
  const KindIcon = meta.Icon;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full items-center gap-3 rounded-xl border-2 border-rule-strong bg-cream px-3 py-2.5 text-left transition hover:border-ink hover:bg-fluff"
    >
      <KindIcon size={20} className="shrink-0 text-yellow-deep" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-bold text-ink">{artifact.title}</span>
        <span className="block text-[12px] text-mute">
          {meta.label} · {meta.hint}
        </span>
      </span>
      <ArrowRightIcon size={12} className="shrink-0 text-mute group-hover:text-ink" />
    </button>
  );
}
