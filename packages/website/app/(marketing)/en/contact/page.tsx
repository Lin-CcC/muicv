import type { Metadata } from 'next';
import { pageMetadata } from '../../_page-meta';
import { ContactView, getContactMeta } from '../../contact/_view';

export const revalidate = 3600;

export const metadata: Metadata = pageMetadata({ locale: 'en', path: '/contact', ...getContactMeta('en') });

export default function EnContactPage() {
  return <ContactView locale="en" />;
}
