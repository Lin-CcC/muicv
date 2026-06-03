import type { Metadata } from 'next';
import { pageMetadata } from '../../_page-meta';
import { getPricingContent } from '../../pricing/_content';
import { PricingView } from '../../pricing/_view';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = pageMetadata({ locale: 'en', path: '/pricing', ...getPricingContent('en').meta });

export default async function EnPricingPage(props: { searchParams: Promise<{ interval?: string }> }) {
  const params = await props.searchParams;
  return <PricingView locale="en" intervalParam={params.interval} />;
}
