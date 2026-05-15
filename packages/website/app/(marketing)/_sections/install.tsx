import { Highlight } from '../_icons';
import { InstallCard } from '../_install-card';

export function Install() {
  return (
    <section id="install" className="relative overflow-hidden border-b border-rule">
      <div
        className="absolute inset-0"
        aria-hidden
        style={{
          background:
            'radial-gradient(ellipse 90% 60% at 50% 0%, color-mix(in srgb, var(--color-corgi) 65%, transparent) 0%, color-mix(in srgb, var(--color-fluff) 50%, transparent) 35%, transparent 75%)',
        }}
      />
      <div className="absolute inset-0 bg-grid opacity-40" aria-hidden />

      <div className="relative mx-auto max-w-6xl px-5 py-20 md:px-8 md:py-24">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <span className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-cream px-3.5 py-1 text-[12px] font-bold text-ink">
              <span className="inline-block h-2 w-2 rounded-full bg-yellow-deep" />
              高级入口 · 给熟悉 AI 工具的人
            </span>
            <h2 className="mt-5 text-[clamp(1.9rem,3.5vw,2.75rem)] font-extrabold leading-[1.1] tracking-tight">
              已经在用 Claude Code / Codex？
              <br />
              <Highlight>直接装 skill</Highlight>。
            </h2>
            <p className="mt-5 max-w-md text-[16px] leading-[1.7] text-ink-soft">
              这是高级路径，适合已经习惯在 AI agent 里工作的用户。普通求职者直接下载桌面 app 会更顺。
            </p>
            <p className="mt-4 max-w-md text-[14px] leading-[1.7] text-mute">
              不熟悉 AI agent？{' '}
              <a
                href="/download"
                className="font-semibold text-yellow-deep underline decoration-corgi decoration-2 underline-offset-4 hover:decoration-yellow"
              >
                下载桌面 app
              </a>{' '}
              直接开始，macOS / Windows / Linux 全平台可用。
            </p>
          </div>

          <div className="grid gap-4 lg:col-span-7">
            <InstallCard title="npx skills" meta="多 agent 通用 / 40+ 兼容" code={`npx skills add meathill/muicv -g`} />
          </div>
        </div>
      </div>
    </section>
  );
}
