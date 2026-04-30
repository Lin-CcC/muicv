import { KEY_FEATURES, type KeyFeature } from '../_data';
import { ChatIcon, CompassIcon, DocIcon, Highlight, RocketIcon, TargetIcon } from '../_icons';

const ICON_BY_TITLE: Record<string, React.ComponentType<{ className?: string }>> = {
  智能简历: DocIcon,
  岗位发现: TargetIcon,
  模拟面试: ChatIcon,
  就业辅导: CompassIcon,
  持续进化: RocketIcon,
};

export function KeyFeatures() {
  return (
    <section id="features" className="border-b border-rule">
      <div className="mx-auto max-w-6xl px-5 py-20 md:px-8 md:py-24">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-yellow-deep">— 重点特性</p>
            <h2 className="mt-3 text-[clamp(2rem,4vw,3rem)] font-extrabold leading-[1.05] tracking-tight">
              不只是简历，
              <br />
              <Highlight>整个求职链路</Highlight>。
            </h2>
            <p className="mt-5 max-w-sm text-[15px] leading-[1.7] text-ink-soft">
              我们要帮你拿到更好的 offer——简历只是其中一步。从找岗位到面试演练，能力还在持续扩。
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
    <article className="group relative flex flex-col rounded-2xl border-2 border-ink bg-cream p-5 transition-transform hover:-translate-y-1">
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-yellow text-ink shadow-[0_2px_0_0_var(--color-yellow-deep)]">
          <Icon className="h-5 w-5" />
        </span>
        <span
          className={
            isLive
              ? 'inline-flex items-center gap-1.5 rounded-full bg-fluff px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-yellow-deep'
              : 'inline-flex items-center gap-1.5 rounded-full border border-rule-strong bg-paper px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-mute'
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
            className="rounded-full border border-rule bg-paper/60 px-2.5 py-0.5 text-[11.5px] font-medium text-ink-soft"
          >
            {tag}
          </li>
        ))}
      </ul>
    </article>
  );
}
