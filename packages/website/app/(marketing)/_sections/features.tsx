import { KEY_FEATURES, type KeyFeature } from '../_data';
import { ChatIcon, CompassIcon, DocIcon, Highlight, TargetIcon } from '../_icons';

const ICON_BY_TITLE: Record<string, React.ComponentType<{ className?: string }>> = {
  整理职业素材: DocIcon,
  针对岗位生成: TargetIcon,
  评审与导出: ChatIcon,
  继续练习求职: CompassIcon,
};

export function KeyFeatures() {
  return (
    <section id="features" className="border-b border-rule">
      <div className="mx-auto max-w-6xl px-5 py-20 md:px-8 md:py-24">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-4">
            <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-yellow-deep">— 能做什么</p>
            <h2 className="mt-3 text-[clamp(2rem,4vw,3rem)] font-extrabold leading-[1.05] tracking-tight">
              先把素材理顺，
              <br />
              <Highlight>再处理投递</Highlight>。
            </h2>
            <p className="mt-5 max-w-sm text-[16px] leading-[1.7] text-ink-soft">
              Mui 的核心不是替你编故事，而是把真实经历整理成可复用素材，再根据不同岗位调整表达。
            </p>
          </div>

          <div className="lg:col-span-8">
            <div className="grid gap-5 sm:grid-cols-2">
              {KEY_FEATURES.map((feature) => (
                <FeatureCard key={feature.title} feature={feature} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FeatureCard({ feature }: { feature: KeyFeature }) {
  const Icon = ICON_BY_TITLE[feature.title] ?? DocIcon;
  const isLive = feature.status === 'live';
  return (
    <article className="group relative flex flex-col rounded-xl border-2 border-ink bg-cream p-5 transition-transform hover:-translate-y-1">
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-yellow text-ink shadow-[0_2px_0_0_var(--color-yellow-deep)]">
          <Icon className="h-5 w-5" />
        </span>
        <span
          className={
            isLive
              ? 'inline-flex items-center gap-1.5 rounded-full bg-fluff px-2.5 py-0.5 font-mono text-[12px] font-bold uppercase tracking-wider text-yellow-deep'
              : 'inline-flex items-center gap-1.5 rounded-full border border-rule-strong bg-paper px-2.5 py-0.5 font-mono text-[12px] font-bold uppercase tracking-wider text-mute'
          }
        >
          <span
            className={
              isLive
                ? 'inline-block h-1.5 w-1.5 rounded-full bg-yellow-deep'
                : 'inline-block h-1.5 w-1.5 rounded-full bg-mute/60'
            }
          />
          {isLive ? '已上线' : '即将推出'}
        </span>
      </div>
      <h3 className="mt-4 text-[18px] font-extrabold leading-snug text-ink">{feature.title}</h3>
      <p className="mt-2 text-[14px] leading-[1.65] text-ink-soft">{feature.desc}</p>
      <ul className="mt-4 flex flex-wrap gap-1.5">
        {feature.highlights.map((tag) => (
          <li
            key={tag}
            className="rounded-full border border-rule bg-paper/60 px-2.5 py-0.5 text-[12px] font-medium text-ink-soft"
          >
            {tag}
          </li>
        ))}
      </ul>
    </article>
  );
}
