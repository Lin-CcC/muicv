import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mui简历 - 通过对话生成简历',
  description: '通过 AI 就业辅导对话，快速生成高质量简历。',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-background text-foreground">{children}</body>
    </html>
  );
}
