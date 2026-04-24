import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mui简历 — 在你熟悉的 AI agent 里管理简历',
  description:
    'Claude Code / Codex / Cursor 通用的简历 skill 套件：素材存本地 Markdown，配 Cloudflare API 做 PDF 渲染和 JD 抓取。',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-background text-foreground">{children}</body>
    </html>
  );
}
