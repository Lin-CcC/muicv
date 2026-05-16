import type { Metadata } from 'next';
import { getPublishedSkills } from '@muicv/shared';

import { ContentCard } from '../_content/content-card';
import { MarketingShell } from '../_content/marketing-shell';
import { Highlight } from '../_icons';

export const metadata: Metadata = {
  title: 'Skill 目录',
  description: 'Mui 简历收集的求职相关 skill：自有内置能力、第三方官方来源和后续可安装扩展。',
  alternates: { canonical: '/skills' },
};

export const dynamic = 'force-dynamic';

export default async function SkillsPage() {
  const skills = getPublishedSkills();

  return (
    <MarketingShell>
      <section className="relative overflow-hidden border-b border-rule">
        <div className="absolute inset-0 bg-sun" aria-hidden />
        <div className="absolute inset-0 bg-grid opacity-50" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-20">
          <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-yellow-deep">Skill catalog</p>
          <h1 className="mt-3 max-w-4xl text-[clamp(2.25rem,5vw,3.75rem)] font-extrabold leading-[1.05] tracking-tight text-ink">
            把求职相关 skill 收进一个 <Highlight>目录</Highlight>。
          </h1>
          <p className="mt-6 max-w-2xl text-[16px] leading-[1.7] text-ink-soft">
            这里既有 Mui app 内置 skill，也有第三方官方来源。第三方内容默认只链官方源，不复制、不托管。
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-14 md:px-8 md:py-16">
        <div className="grid gap-5 md:grid-cols-2">
          {skills.map((skill) => (
            <ContentCard
              key={skill.slug}
              href={`/skills/${skill.slug}`}
              eyebrow={skill.publisher}
              title={skill.title}
              summary={skill.summary}
              tags={skill.tags}
            />
          ))}
        </div>
      </section>
    </MarketingShell>
  );
}
