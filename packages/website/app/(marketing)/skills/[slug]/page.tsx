import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPublishedSkills, getSkillBySlug } from '@muicv/shared';

import { MarketingShell } from '../../_content/marketing-shell';
import { MarkdownBody } from '../../_content/markdown';
import { ArrowUpRight, Highlight } from '../../_icons';

export const dynamic = 'force-dynamic';

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const resolvedParams = await params;
  const skill = getSkillBySlug(resolvedParams.slug);
  if (!skill) return {};
  return {
    title: skill.seoTitle,
    description: skill.seoDescription,
    keywords: skill.keywords,
    alternates: { canonical: `/skills/${skill.slug}` },
    openGraph: {
      title: skill.seoTitle,
      description: skill.seoDescription,
      type: 'article',
      publishedTime: skill.publishedAt,
      modifiedTime: skill.updatedAt,
    },
  };
}

export function generateStaticParams() {
  return getPublishedSkills().map((skill) => ({ slug: skill.slug }));
}

function actionLabel(distributionMode: string): string {
  if (distributionMode === 'built_in') return '下载 Mui app 使用';
  if (distributionMode === 'link_only') return '查看官方来源';
  return '查看安装方式';
}

export default async function SkillDetailPage({ params }: { params: Promise<Params> }) {
  const resolvedParams = await params;
  const skill = getSkillBySlug(resolvedParams.slug);
  if (!skill) notFound();

  const primaryHref = skill.distributionMode === 'built_in' ? '/download' : (skill.sourceUrl ?? '/skills');

  return (
    <MarketingShell>
      <article>
        <header className="relative overflow-hidden border-b border-rule">
          <div className="absolute inset-0 bg-sun" aria-hidden />
          <div className="absolute inset-0 bg-grid opacity-50" aria-hidden />
          <div className="relative mx-auto grid max-w-6xl gap-8 px-5 py-16 md:px-8 md:py-20 lg:grid-cols-[1fr_320px]">
            <div>
              <Link href="/skills" className="text-[13px] font-bold text-yellow-deep hover:text-ink">
                ← Skill 目录
              </Link>
              <p className="mt-5 font-mono text-[12px] uppercase tracking-[0.18em] text-yellow-deep">
                {skill.publisher} · {skill.appAvailability.replace('_', ' ')}
              </p>
              <h1 className="mt-3 max-w-3xl text-[clamp(2.25rem,5vw,3.75rem)] font-extrabold leading-[1.05] tracking-tight text-ink">
                {skill.title.includes('腾讯') ? (
                  <>
                    腾讯校招，放进你的 <Highlight>AI agent</Highlight>。
                  </>
                ) : (
                  skill.title
                )}
              </h1>
              <p className="mt-6 max-w-2xl text-[16px] leading-[1.75] text-ink-soft">{skill.summary}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href={primaryHref}
                  target={primaryHref.startsWith('http') ? '_blank' : undefined}
                  rel={primaryHref.startsWith('http') ? 'noreferrer' : undefined}
                  className="press inline-flex items-center gap-2 rounded-xl bg-yellow px-5 py-3 text-[15px] font-bold text-ink"
                >
                  {actionLabel(skill.distributionMode)}
                  <ArrowUpRight />
                </a>
                <Link
                  href="/posts/jobs/tencent-campus-recruiting-skill"
                  className="press-ink inline-flex items-center gap-2 rounded-xl border-2 border-ink bg-cream px-5 py-3 text-[15px] font-bold text-ink"
                >
                  看使用建议
                  <ArrowUpRight />
                </Link>
              </div>
            </div>

            <aside className="rounded-xl border-2 border-ink bg-cream p-5 shadow-[0_4px_0_0_var(--color-ink-line)]">
              <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-yellow-deep">来源</p>
              <dl className="mt-4 space-y-4 text-[13px]">
                <div>
                  <dt className="font-bold text-ink">发布方</dt>
                  <dd className="mt-1 text-ink-soft">{skill.publisher}</dd>
                </div>
                <div>
                  <dt className="font-bold text-ink">分发方式</dt>
                  <dd className="mt-1 text-ink-soft">
                    {skill.distributionMode === 'link_only' ? '只链官方源' : skill.distributionMode}
                  </dd>
                </div>
                {skill.sourceUrl ? (
                  <div>
                    <dt className="font-bold text-ink">官方来源</dt>
                    <dd className="mt-1">
                      <a
                        href={skill.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-yellow-deep hover:text-ink"
                      >
                        {skill.sourceLabel ?? '打开来源'}
                      </a>
                    </dd>
                  </div>
                ) : null}
              </dl>
              {skill.disclaimer ? (
                <p className="mt-5 rounded-lg border border-rule bg-paper p-3 text-[12px] leading-[1.6] text-ink-soft">
                  {skill.disclaimer}
                </p>
              ) : null}
            </aside>
          </div>
        </header>

        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 md:px-8 md:py-14 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div>
            <MarkdownBody markdown={skill.bodyMarkdown} />
          </div>
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-xl border border-rule bg-paper p-5">
              <h2 className="text-[16px] font-extrabold text-ink">适合场景</h2>
              <ul className="mt-3 space-y-2 text-[13px] leading-[1.6] text-ink-soft">
                {skill.useCases.map((item) => (
                  <li key={item}>· {item}</li>
                ))}
              </ul>
              <div className="mt-5 flex flex-wrap gap-2">
                {skill.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-rule bg-cream px-2.5 py-1 text-[12px] text-mute"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </article>
    </MarketingShell>
  );
}
