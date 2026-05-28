import { Footer } from '../_sections/footer';
import { Header } from '../_sections/header';

/**
 * 通用营销页外壳。Header 现在走客户端 useSession，不再需要服务端拿 session，
 * 容器组件保持纯 server component，配合上层页面的 revalidate 走 ISR。
 */
export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen">
      <Header />
      {children}
      <Footer />
    </div>
  );
}
