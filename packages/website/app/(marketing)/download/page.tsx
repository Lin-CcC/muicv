import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '下载桌面 app',
  description: 'Mui简历桌面端：让不用 AI agent 的求职者也能跑完整简历工作流。macOS Apple Silicon / Intel 双版本。',
};

// 5 分钟 ISR 缓存 GitHub releases API（user-agent 防 60/h 限流）
export const revalidate = 300;

const REPO = 'meathill/muicv';

type GhAsset = {
  id: number;
  name: string;
  browser_download_url: string;
  size: number;
  content_type: string;
};

type GhRelease = {
  tag_name: string;
  name: string;
  published_at: string;
  html_url: string;
  body: string;
  prerelease: boolean;
  assets: GhAsset[];
};

async function fetchLatestRelease(): Promise<GhRelease | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: {
        accept: 'application/vnd.github+json',
        'user-agent': 'muicv-website',
      },
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return (await res.json()) as GhRelease;
  } catch {
    return null;
  }
}

type ParsedAsset = {
  url: string;
  name: string;
  size: number;
  platform: 'mac' | 'win' | 'linux' | 'other';
  arch: 'arm64' | 'x64' | 'universal' | 'unknown';
  format: 'dmg' | 'zip' | 'exe' | 'AppImage' | 'deb' | 'other';
};

function classifyAsset(asset: GhAsset): ParsedAsset {
  const n = asset.name.toLowerCase();
  let platform: ParsedAsset['platform'] = 'other';
  if (/(mac|darwin|osx)/.test(n) || /\.dmg$/.test(n)) platform = 'mac';
  else if (/win|setup|\.exe$/.test(n)) platform = 'win';
  else if (/(linux|appimage|deb)/.test(n)) platform = 'linux';

  let arch: ParsedAsset['arch'] = 'unknown';
  if (/arm64|aarch64|apple-silicon/.test(n)) arch = 'arm64';
  // electron-builder 给 Linux x64 用 `x86_64` 命名（glibc ABI 约定），
  // 与 `x64` 都需要识别成同一种 64-bit Intel/AMD 架构。
  else if (/x64|x86[_-]?64|intel|amd64/.test(n)) arch = 'x64';
  else if (/universal/.test(n)) arch = 'universal';
  // electron-builder 默认命名约定：mac 同时打 arm64+x64 时，arm64 带 -arm64 后缀，
  // x64 默认无 arch 后缀。所以 mac + 未识别 arch 兜底成 x64，不要丢弃。
  else if (platform === 'mac') arch = 'x64';

  let format: ParsedAsset['format'] = 'other';
  if (n.endsWith('.dmg')) format = 'dmg';
  else if (n.endsWith('.zip')) format = 'zip';
  else if (n.endsWith('.exe')) format = 'exe';
  else if (n.endsWith('.appimage')) format = 'AppImage';
  else if (n.endsWith('.deb')) format = 'deb';

  return {
    url: asset.browser_download_url,
    name: asset.name,
    size: asset.size,
    platform,
    arch,
    format,
  };
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default async function DownloadPage() {
  const release = await fetchLatestRelease();

  return (
    <div className="relative">
      <header className="sticky top-0 z-30 border-b border-rule bg-cream/85 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3 md:px-8">
          <Link href="/" className="flex items-center gap-2.5 text-ink no-underline">
            <span className="text-[17px] font-bold tracking-tight">← 回首页</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-14 md:px-8 md:py-20">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-yellow-deep">— 桌面 app</p>
        <h1 className="mt-3 text-[clamp(2.2rem,5vw,3.4rem)] font-extrabold leading-[1.05] tracking-tight">
          下载 Mui简历
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-[1.7] text-ink-soft">
          让你不用装 Claude Code 也能跑完整简历工作流：选目录、贴 muirouter key， 打开 app 直接对话。Skills、API、UI
          都内置，开箱即用。
        </p>

        {!release ? <NoRelease /> : <ReleasePanel release={release} />}

        <FirstRunHelp />

        <Footer />
      </main>
    </div>
  );
}

function ReleasePanel({ release }: { release: GhRelease }) {
  const macAssets = release.assets
    .map(classifyAsset)
    .filter((a) => a.platform === 'mac' && (a.format === 'dmg' || a.format === 'zip'))
    .sort((a, b) => a.format.localeCompare(b.format));

  const arm64 = macAssets.filter((a) => a.arch === 'arm64' || a.arch === 'universal');
  const x64 = macAssets.filter((a) => a.arch === 'x64' || a.arch === 'universal');

  return (
    <section className="mt-12 space-y-6">
      <div className="flex flex-wrap items-baseline gap-3 rounded-2xl border-2 border-ink bg-cream px-5 py-3 shadow-[0_4px_0_0_var(--color-ink)]">
        <span className="font-mono text-[12px] font-bold tabular-nums text-yellow-deep">{release.tag_name}</span>
        <span className="text-[12px] text-mute">发布于 {formatDate(release.published_at)}</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Platform title="macOS · Apple Silicon" subtitle="M1 / M2 / M3 / M4" assets={arm64} />
        <Platform title="macOS · Intel" subtitle="x64 旧机型" assets={x64} />
      </div>

      <div className="rounded-xl border border-rule bg-paper px-4 py-3 text-[12.5px] text-mute">
        Linux / Windows 版本还在排期，先用 macOS 测着；其他平台发布会通过 Waitlist 通知。
      </div>
    </section>
  );
}

function Platform({ title, subtitle, assets }: { title: string; subtitle: string; assets: ParsedAsset[] }) {
  return (
    <div className="rounded-2xl border-2 border-ink bg-cream p-5 shadow-[0_4px_0_0_var(--color-ink)]">
      <div>
        <h3 className="text-[15px] font-extrabold text-ink">{title}</h3>
        <p className="mt-0.5 text-[12px] text-mute">{subtitle}</p>
      </div>

      <div className="mt-4 space-y-2">
        {assets.length === 0 ? (
          <p className="text-[12px] text-mute">本版本未提供该架构产物</p>
        ) : (
          assets.map((a) => (
            <a
              key={a.url}
              href={a.url}
              className="press flex items-center justify-between rounded-lg bg-yellow px-3.5 py-2 text-[13px] font-bold text-ink transition"
            >
              <span className="inline-flex items-center gap-2">
                <span className="font-mono uppercase">{a.format}</span>
                <span className="text-mute">·</span>
                <span className="text-ink">下载</span>
              </span>
              <span className="font-mono text-[11px] text-ink-soft">{formatBytes(a.size)}</span>
            </a>
          ))
        )}
      </div>
    </div>
  );
}

function NoRelease() {
  return (
    <section className="mt-12 rounded-2xl border-2 border-rule bg-paper p-6 text-[14px] text-ink-soft">
      <p>🐾 桌面 app 还没有正式发布版本。在那之前你可以：</p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-[13px]">
        <li>
          在首页{' '}
          <Link
            href="/#waitlist"
            className="underline decoration-corgi decoration-2 underline-offset-4 hover:text-yellow-deep"
          >
            留下邮箱
          </Link>{' '}
          加入 Waitlist，发布时第一时间通知你
        </li>
        <li>已经在用 Claude Code、Codex、Cursor 等 AI agent 的话，回首页看 skill 安装命令，5 秒就能接入</li>
      </ul>
    </section>
  );
}

function FirstRunHelp() {
  return (
    <section className="mt-12 space-y-4 rounded-2xl border-2 border-ink bg-fluff p-6">
      <h2 className="text-[16px] font-extrabold text-ink">⚠️ 首次打开需要解除限制</h2>
      <p className="text-[13.5px] leading-[1.7] text-ink-soft">
        当前版本未做苹果开发者签名（Apple Developer ID）。macOS 第一次打开会提示 "无法验证开发者"。需要：
      </p>
      <ol className="list-decimal space-y-1 pl-5 text-[13.5px] text-ink-soft">
        <li>下载 .dmg 拖到 /Applications</li>
        <li>
          <strong>右键</strong>（或 control-click）该 app → <strong>打开</strong>
        </li>
        <li>弹窗提示后再次点 "打开"，之后双击就能直接用</li>
      </ol>
      <p className="text-[12px] text-mute">
        命令行版（无需 GUI 操作）：
        <code className="ml-1 rounded bg-cream px-1.5 py-0.5 font-mono text-[11.5px] text-ink">
          xattr -d com.apple.quarantine /Applications/Mui简历.app
        </code>
      </p>
    </section>
  );
}

function Footer() {
  return (
    <footer className="mt-16 flex flex-wrap items-center gap-4 border-t border-rule pt-6 text-[12.5px] text-mute">
      <span>下载即代表你接受未来的服务条款（占位）。</span>
      <span className="ml-auto">
        <Link href="/" className="underline decoration-corgi decoration-2 underline-offset-4 hover:text-yellow-deep">
          回首页
        </Link>
      </span>
    </footer>
  );
}
