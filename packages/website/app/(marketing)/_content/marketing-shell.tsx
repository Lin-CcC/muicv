import { headers } from 'next/headers';

import { getAuth } from '@/lib/auth';

import { Footer } from '../_sections/footer';
import { Header } from '../_sections/header';

export async function MarketingShell({ children }: { children: React.ReactNode }) {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });

  return (
    <div className="relative min-h-screen">
      <Header isLoggedIn={!!session?.user} />
      {children}
      <Footer />
    </div>
  );
}
