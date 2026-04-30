import type { MetadataRoute } from 'next';

const BASE = 'https://muicv.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const pages: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }[] =
    [
      { path: '/', priority: 1, changeFrequency: 'weekly' },
      { path: '/pricing', priority: 0.9, changeFrequency: 'monthly' },
      { path: '/about', priority: 0.6, changeFrequency: 'monthly' },
      { path: '/contact', priority: 0.5, changeFrequency: 'monthly' },
      { path: '/download', priority: 0.7, changeFrequency: 'weekly' },
      { path: '/privacy', priority: 0.3, changeFrequency: 'yearly' },
      { path: '/terms', priority: 0.3, changeFrequency: 'yearly' },
    ];
  return pages.map(({ path, priority, changeFrequency }) => ({
    url: `${BASE}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }));
}
