import type { MetadataRoute } from 'next';
import { POST_SECTION_META } from '@muicv/shared';
import { getWebsitePublishedChangelog, getWebsitePublishedPosts, getWebsitePublishedSkills } from '@/lib/cms-content';

const BASE = 'https://muicv.com';

// sitemap 走 ISR：1 小时刷一次。爬虫不会每秒访问，不需要 force-dynamic 让 D1 每次硬扛。
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const generatedAt = new Date();
  const [posts, skills, changelog] = await Promise.all([
    getWebsitePublishedPosts(),
    getWebsitePublishedSkills(),
    getWebsitePublishedChangelog(),
  ]);
  const changelogLastModified = changelog.reduce<Date>(
    (latest, item) => maxDate(latest, toDate(item.updatedAt)),
    new Date(0),
  );
  const pages: StaticSitemapPage[] = [
    { path: '/', priority: 1, changeFrequency: 'weekly' },
    { path: '/pricing', priority: 0.9, changeFrequency: 'monthly' },
    { path: '/about', priority: 0.6, changeFrequency: 'monthly' },
    { path: '/contact', priority: 0.5, changeFrequency: 'monthly' },
    { path: '/download', priority: 0.7, changeFrequency: 'weekly' },
    { path: '/posts', priority: 0.7, changeFrequency: 'weekly' },
    ...Object.values(POST_SECTION_META).map((section) => ({
      path: section.path,
      priority: section.path === '/posts/jobs' ? 0.8 : 0.55,
      changeFrequency: 'weekly' as const,
    })),
    { path: '/skills', priority: 0.8, changeFrequency: 'weekly' },
    { path: '/changelog', priority: 0.5, changeFrequency: 'weekly' },
    { path: '/privacy', priority: 0.3, changeFrequency: 'yearly' },
    { path: '/terms', priority: 0.3, changeFrequency: 'yearly' },
  ];
  const contentPages = [
    ...posts.map((post) => ({
      path: `${POST_SECTION_META[post.section].path}/${post.slug}`,
      priority: post.section === 'jobs' ? 0.75 : 0.6,
      changeFrequency: 'monthly' as const,
      lastModified: toDate(post.updatedAt),
    })),
    ...skills.map((skill) => ({
      path: `/skills/${skill.slug}`,
      priority: 0.7,
      changeFrequency: 'weekly' as const,
      lastModified: toDate(skill.updatedAt),
    })),
  ];
  const staticPages = pages.map((page) => ({
    ...page,
    lastModified: page.path === '/changelog' ? nonEpoch(changelogLastModified, generatedAt) : generatedAt,
  }));

  return [...staticPages, ...contentPages].map(({ path, priority, changeFrequency, lastModified }) => ({
    url: `${BASE}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }));
}

type StaticSitemapPage = {
  path: string;
  priority: number;
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
};

function toDate(value: string): Date {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function maxDate(a: Date, b: Date): Date {
  return a.getTime() >= b.getTime() ? a : b;
}

function nonEpoch(value: Date, fallback: Date): Date {
  return value.getTime() === 0 ? fallback : value;
}
