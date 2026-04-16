import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mui简历',
  description: '在你熟悉的 AI agent 里管理简历。Skills + 本地 Markdown。',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-background text-foreground">
        <header className="h-14 border-b border-border bg-background">
          <nav className="mx-auto flex h-full max-w-6xl items-center justify-between px-6">
            <Link href="/" className="text-sm font-semibold">
              Mui简历
            </Link>
          </nav>
        </header>

        {children}
      </body>
    </html>
  );
}
