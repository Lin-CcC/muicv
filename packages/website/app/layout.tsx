import type { Metadata } from 'next';
import { Fraunces, JetBrains_Mono, Nunito } from 'next/font/google';

import './globals.css';

const SITE_URL = 'https://muicv.com';
const TITLE = 'Mui简历 — 在你熟悉的 AI agent 里管理简历';
const DESCRIPTION =
  'Claude Code / Codex / Cursor 通用的简历 skill 套件：素材存本地 Markdown，配 Cloudflare API 做 PDF 渲染和 JD 抓取。';

// Display serif: Fraunces 是 variable font，opsz/SOFT 轴帮我们实现优雅 italic
const fontDisplay = Fraunces({
  subsets: ['latin'],
  axes: ['SOFT', 'opsz'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
});

// Body sans: Nunito，圆润 friendly，配柯基卡通气质
const fontSans = Nunito({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

// Mono：仅终端 / 代码块用
const fontMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: '%s · Mui简历',
  },
  description: DESCRIPTION,
  applicationName: 'Mui简历',
  keywords: [
    'resume',
    'cv',
    '简历',
    'AI agent',
    'Claude Code',
    'Codex',
    'Cursor',
    'OpenAI',
    'job search',
    '求职',
    'cover letter',
  ],
  authors: [{ name: 'meathill', url: 'https://github.com/meathill' }],
  creator: 'meathill',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'Mui简历',
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    locale: 'zh_CN',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    creator: '@meathill',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={`${fontDisplay.variable} ${fontSans.variable} ${fontMono.variable}`}>
      <body className="bg-cream text-ink antialiased">{children}</body>
    </html>
  );
}
