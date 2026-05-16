import type { MetadataRoute } from 'next';
import { getPublishedPosts, getPublishedSkills, POST_SECTION_META } from '@muicv/shared';

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
      { path: '/posts', priority: 0.7, changeFrequency: 'weekly' },
      { path: '/posts/jobs', priority: 0.8, changeFrequency: 'weekly' },
      { path: '/skills', priority: 0.8, changeFrequency: 'weekly' },
      { path: '/changelog', priority: 0.5, changeFrequency: 'weekly' },
      { path: '/privacy', priority: 0.3, changeFrequency: 'yearly' },
      { path: '/terms', priority: 0.3, changeFrequency: 'yearly' },
    ];
  const contentPages = [
    ...getPublishedPosts().map((post) => ({
      path: `${POST_SECTION_META[post.section].path}/${post.slug}`,
      priority: post.section === 'jobs' ? 0.75 : 0.6,
      changeFrequency: 'monthly' as const,
      lastModified: new Date(post.updatedAt),
    })),
    ...getPublishedSkills().map((skill) => ({
      path: `/skills/${skill.slug}`,
      priority: 0.7,
      changeFrequency: 'weekly' as const,
      lastModified: new Date(skill.updatedAt),
    })),
  ];
  return [...pages.map((page) => ({ ...page, lastModified })), ...contentPages].map(
    ({ path, priority, changeFrequency, lastModified }) => ({
      url: `${BASE}${path}`,
      lastModified,
      changeFrequency,
      priority,
    }),
  );
}
