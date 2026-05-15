import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';

import { getAuth } from '@/lib/auth';

import { Footer } from '../_sections/footer';
import { Header } from '../_sections/header';

export const metadata: Metadata = {
  title: '下载桌面 app',
  description: '下载 Mui简历桌面 app：导入简历或记录经历，先整理职业素材，再针对岗位生成简历。',
};

// 与其它营销页对齐：Header 需要 session，必须 dynamic。GitHub fetch 自带 5 分钟数据缓存，rate-limit 压力不变。
export const dynamic = 'force-dynamic';

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
  const headers: Record<string, string> = {
    accept: 'application/vnd.github+json',
    'user-agent': 'muicv-website',
  };
  // OpenNext 把 wrangler secret 暴露到 process.env；有 token 时把限流从 60/h 提到 5000/h
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.authorization = `Bearer ${token}`;

  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers,
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      console.error(
        '[download] GitHub releases/latest failed',
        res.status,
        res.statusText,
        'x-ratelimit-remaining:',
        res.headers.get('x-ratelimit-remaining'),
      );
      return null;
    }
    return (await res.json()) as GhRelease;
  } catch (err) {
    console.error('[download] GitHub releases/latest threw', err);
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

  // electron-builder 给 mac 出的 zip 命名为 `MuiCV-<ver>-<arch>.zip`，不带 mac/darwin 字样。
  // 我们的构建链里 zip 仅用于 mac 自动更新，所以 zip + 已识别 arch 的兜底归到 mac。
  if (platform === 'other' && format === 'zip' && (arch === 'arm64' || arch === 'x64')) {
    platform = 'mac';
  }

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
  const auth = await getAuth();
  const [session, release] = await Promise.all([
    auth.api.getSession({ headers: await headers() }),
    fetchLatestRelease(),
  ]);
  const isLoggedIn = !!session?.user;

  return (
    <div className="relative">
      <Header isLoggedIn={isLoggedIn} />

      <main className="mx-auto max-w-3xl px-5 py-14 md:px-8 md:py-20">
        <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-yellow-deep">— 桌面 app</p>
        <h1 className="mt-3 text-[clamp(2.2rem,5vw,3.4rem)] font-extrabold leading-[1.05] tracking-tight">
          下载 Mui简历
        </h1>
        <p className="mt-4 max-w-xl text-[16px] leading-[1.7] text-ink-soft">
          不用装 Claude Code，也不用先理解 skill。打开 app 后先导入简历或记录第一段经历，Mui
          会带你整理出一份可继续迭代的职业素材库。
        </p>

        <FirstMinute />

        {!release ? <NoRelease /> : <ReleasePanel release={release} />}

        <FirstRunHelp />
      </main>

      <Footer />
    </div>
  );
}

function FirstMinute() {
  const steps = [
    { title: '登录 muicv 账号', desc: '用浏览器完成授权，app 会自动回到已登录状态。' },
    { title: '导入简历或从零记录', desc: '上传现有简历，或直接说一段你做过的项目和经历。' },
    { title: '开始第一段整理对话', desc: 'Mui 会先帮你把材料拆成可复用素材，之后再针对岗位生成版本。' },
  ];
  return (
    <section className="mt-10 rounded-xl border-2 border-ink bg-corgi/20 p-5 shadow-[0_4px_0_0_var(--color-yellow-deep)]">
      <p className="font-mono text-[12px] font-bold uppercase tracking-[0.18em] text-yellow-deep">下载后第一分钟</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {steps.map((step, idx) => (
          <div key={step.title} className="rounded-xl border-2 border-rule bg-cream px-4 py-3">
            <span className="font-mono text-[12px] font-bold text-yellow-deep">{String(idx + 1).padStart(2, '0')}</span>
            <h2 className="mt-2 text-[14px] font-extrabold text-ink">{step.title}</h2>
            <p className="mt-1.5 text-[12px] leading-[1.6] text-ink-soft">{step.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ReleasePanel({ release }: { release: GhRelease }) {
  const all = release.assets.map(classifyAsset);

  // 安装包过滤：mac 收 dmg/zip；win 收 exe；linux 收 AppImage/deb
  const macArm64 = all
    .filter((a) => a.platform === 'mac' && (a.format === 'dmg' || a.format === 'zip') && a.arch === 'arm64')
    .sort((a, b) => a.format.localeCompare(b.format));
  const macX64 = all
    .filter((a) => a.platform === 'mac' && (a.format === 'dmg' || a.format === 'zip') && a.arch === 'x64')
    .sort((a, b) => a.format.localeCompare(b.format));
  const win = all.filter((a) => a.platform === 'win' && a.format === 'exe');
  const linux = all.filter((a) => a.platform === 'linux' && (a.format === 'AppImage' || a.format === 'deb'));

  return (
    <section className="mt-12 space-y-6">
      <div className="flex flex-wrap items-baseline gap-3 rounded-xl border-2 border-ink bg-cream px-5 py-3 shadow-[0_4px_0_0_var(--color-ink)]">
        <span className="font-mono text-[12px] font-bold tabular-nums text-yellow-deep">{release.tag_name}</span>
        <span className="text-[12px] text-mute">发布于 {formatDate(release.published_at)}</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Platform title="macOS · Apple Silicon" subtitle="M1 / M2 / M3 / M4" assets={macArm64} />
        <Platform title="macOS · Intel" subtitle="x64 旧机型" assets={macX64} />
        <Platform title="Windows" subtitle="x64 · NSIS 安装包" assets={win} />
        <Platform title="Linux" subtitle="x86_64 · AppImage" assets={linux} />
      </div>

      <div className="rounded-xl border border-rule bg-paper px-4 py-3 text-[12px] text-mute">
        全平台都未做代码签名，首次运行需要按下方说明手动放行；后续版本接入开发者证书后会去掉这一步。
      </div>
    </section>
  );
}

function Platform({ title, subtitle, assets }: { title: string; subtitle: string; assets: ParsedAsset[] }) {
  return (
    <div className="rounded-xl border-2 border-ink bg-cream p-5 shadow-[0_4px_0_0_var(--color-ink)]">
      <div>
        <h3 className="text-[16px] font-extrabold text-ink">{title}</h3>
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
              className="press flex items-center justify-between rounded-lg bg-yellow px-3.5 py-2 text-[14px] font-bold text-ink transition"
            >
              <span className="inline-flex items-center gap-2">
                <span className="font-mono uppercase">{a.format}</span>
                <span className="text-mute">·</span>
                <span className="text-ink">下载</span>
              </span>
              <span className="font-mono text-[12px] text-ink-soft">{formatBytes(a.size)}</span>
            </a>
          ))
        )}
      </div>
    </div>
  );
}

function NoRelease() {
  return (
    <section className="mt-12 rounded-xl border-2 border-rule bg-paper p-6 text-[14px] text-ink-soft">
      <p>🐾 桌面 app 暂时拉不到发布版本。在那之前你可以：</p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-[14px]">
        <li>已经在用 Claude Code、Codex、Cursor 等 AI agent 的话，回首页看 skill 安装命令，5 秒就能接入</li>
        <li>
          有问题或想反馈，{' '}
          <Link
            href="/contact"
            className="underline decoration-corgi decoration-2 underline-offset-4 hover:text-yellow-deep"
          >
            联系我们
          </Link>
        </li>
      </ul>
    </section>
  );
}

function FirstRunHelp() {
  return (
    <section className="mt-12 space-y-6 rounded-xl border-2 border-ink bg-fluff p-6">
      <header>
        <h2 className="text-[16px] font-extrabold text-ink">⚠️ 首次打开需要解除限制</h2>
        <p className="mt-2 text-[14px] leading-[1.7] text-ink-soft">
          三平台都没做代码签名，操作系统会拦一下。按下面的步骤放行一次，之后双击 / 命令行直接用。
        </p>
      </header>

      <div className="space-y-1.5">
        <h3 className="text-[14px] font-bold text-ink">macOS</h3>
        <ol className="list-decimal space-y-1 pl-5 text-[14px] text-ink-soft">
          <li>下载 .dmg 拖到 /Applications</li>
          <li>
            <strong>右键</strong>（或 control-click）该 app → <strong>打开</strong>
          </li>
          <li>弹窗提示后再次点 "打开"，之后双击就能直接用</li>
        </ol>
        <p className="text-[12px] text-mute">
          命令行版（无需 GUI 操作）：
          <code className="ml-1 rounded bg-cream px-1.5 py-0.5 font-mono text-[12px] text-ink">
            xattr -d com.apple.quarantine /Applications/Mui简历.app
          </code>
        </p>
      </div>

      <div className="space-y-1.5">
        <h3 className="text-[14px] font-bold text-ink">Windows</h3>
        <ol className="list-decimal space-y-1 pl-5 text-[14px] text-ink-soft">
          <li>双击下载的 .exe</li>
          <li>
            撞上 SmartScreen 蓝屏 → 点 <strong>更多信息</strong> → 点 <strong>仍要运行</strong>
          </li>
          <li>选安装路径，默认装到当前用户目录，不需要管理员密码</li>
        </ol>
      </div>

      <div className="space-y-1.5">
        <h3 className="text-[14px] font-bold text-ink">Linux</h3>
        <p className="text-[14px] text-ink-soft">下载 .AppImage 后给执行权限，直接跑：</p>
        <pre className="overflow-x-auto rounded-lg bg-cream px-3 py-2 font-mono text-[12px] text-ink">
          <code>{`chmod +x MuiCV-*.AppImage\n./MuiCV-*.AppImage`}</code>
        </pre>
      </div>
    </section>
  );
}
