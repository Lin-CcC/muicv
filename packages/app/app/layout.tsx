import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mui简历',
  description: '通过 AI 就业辅导对话，生成高质量简历。',
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
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Link href="/" className="rounded-md px-2 py-1 hover:bg-accent hover:text-accent-foreground">
                对话
              </Link>
              <Link href="/resume" className="rounded-md px-2 py-1 hover:bg-accent hover:text-accent-foreground">
                简历
              </Link>
            </div>
          </nav>
        </header>

        {children}
      </body>
    </html>
  );
}
