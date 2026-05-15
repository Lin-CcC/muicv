import { ArrowRightIcon, FileTextIcon, NotePencilIcon, SparkleIcon } from '@phosphor-icons/react';
import { useState } from 'react';

import type { OnboardingStart } from '../lib/store';
import { useAppStore } from '../lib/store';
import { CorgiMascot } from './corgi-mascot';

const START_OPTIONS: Array<{
  id: OnboardingStart;
  title: string;
  desc: string;
  action: string;
  Icon: typeof FileTextIcon;
}> = [
  {
    id: 'resume',
    title: '我有一份现成简历',
    desc: '进入对话后先上传 PDF / DOCX / Markdown，Mui 会帮你拆成素材。',
    action: '导入简历开始',
    Icon: FileTextIcon,
  },
  {
    id: 'experience',
    title: '我先讲一段经历',
    desc: '适合还没有完整简历的人。Mui 会追问背景、动作和结果。',
    action: '记录经历开始',
    Icon: NotePencilIcon,
  },
  {
    id: 'blank',
    title: '我想从零整理',
    desc: '从基本信息、工作经历、项目和技能开始，一步一步补齐。',
    action: '从零开始',
    Icon: SparkleIcon,
  },
];

export function OnboardingView() {
  const activeProfile = useAppStore((s) => s.activeProfile);
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);
  const skipOnboarding = useAppStore((s) => s.skipOnboarding);
  const [busy, setBusy] = useState<OnboardingStart | 'skip' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start(kind: OnboardingStart): Promise<void> {
    setError(null);
    setBusy(kind);
    try {
      await completeOnboarding(kind);
    } catch (err) {
      setError(err instanceof Error ? err.message : '首次引导启动失败');
      setBusy(null);
    }
  }

  async function skip(): Promise<void> {
    setError(null);
    setBusy('skip');
    try {
      await skipOnboarding();
    } catch (err) {
      setError(err instanceof Error ? err.message : '跳过失败');
      setBusy(null);
    }
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-cream">
      <main className="mx-auto flex min-h-full w-full max-w-4xl flex-col justify-center px-6 py-10">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border-2 border-rule bg-fluff px-3 py-1 text-[12px] font-bold text-yellow-deep">
            <CorgiMascot className="h-5 w-5" />
            第一次打开，先完成一份职业素材
          </div>
          <h1 className="mt-5 text-[34px] font-extrabold leading-tight tracking-tight text-ink">
            从你已经有的材料开始，不用先学功能。
          </h1>
          <p className="mt-3 max-w-xl text-[14px] leading-[1.7] text-ink-soft">
            Mui 会创建一段“记录职业生涯”对话。你可以上传简历、粘贴经历，或让它从零开始提问。
            资料会保存在当前职业档案里。
          </p>
        </div>

        <section className="mt-8 grid gap-3 md:grid-cols-3">
          {START_OPTIONS.map(({ id, title, desc, action, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => void start(id)}
              disabled={busy !== null}
              className="group flex min-h-[210px] flex-col items-start rounded-xl border-2 border-ink bg-cream p-5 text-left shadow-[0_4px_0_0_var(--color-ink)] transition hover:-translate-y-0.5 hover:bg-fluff disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-yellow text-ink shadow-[0_2px_0_0_var(--color-yellow-deep)]">
                <Icon size={20} weight="bold" />
              </span>
              <span className="mt-4 text-[16px] font-extrabold text-ink">{title}</span>
              <span className="mt-2 flex-1 text-[13px] leading-[1.65] text-ink-soft">{desc}</span>
              <span className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-bold text-yellow-deep">
                {busy === id ? '准备中…' : action}
                <ArrowRightIcon size={14} weight="bold" />
              </span>
            </button>
          ))}
        </section>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-5">
          <p className="max-w-lg text-[12.5px] leading-[1.6] text-mute">
            当前职业档案：<span className="font-bold text-ink">{activeProfile?.name ?? '默认'}</span>
            {activeProfile?.dir ? <span className="ml-1 font-mono text-[11px]">{activeProfile.dir}</span> : null}
          </p>
          <button
            type="button"
            onClick={() => void skip()}
            disabled={busy !== null}
            className="rounded-lg px-3 py-2 text-[12.5px] font-medium text-mute hover:bg-fluff hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy === 'skip' ? '跳过中…' : '先跳过，自己探索'}
          </button>
        </div>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-lg border-2 border-tongue/60 bg-tongue/10 px-3 py-2 text-[13px] text-tongue"
          >
            {error}
          </p>
        )}
      </main>
    </div>
  );
}
