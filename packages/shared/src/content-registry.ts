export type ContentStatus = 'draft' | 'published';

export type PostSection = 'jobs' | 'product' | 'guide';

export type ContentPost = {
  slug: string;
  section: PostSection;
  status: ContentStatus;
  title: string;
  summary: string;
  bodyMarkdown: string;
  tags: string[];
  keywords: string[];
  author: string;
  publishedAt: string;
  updatedAt: string;
  seoTitle: string;
  seoDescription: string;
};

export type SkillPublisherType = 'muicv' | 'official' | 'community';
export type SkillDistributionMode = 'built_in' | 'link_only' | 'hosted' | 'external_direct';
export type SkillAppAvailability = 'built_in' | 'link_only' | 'installable' | 'coming_soon';

export type SkillCatalogItem = {
  slug: string;
  status: ContentStatus;
  title: string;
  publisher: string;
  publisherType: SkillPublisherType;
  sourceUrl?: string;
  sourceLabel?: string;
  sourceNote?: string;
  distributionMode: SkillDistributionMode;
  appAvailability: SkillAppAvailability;
  summary: string;
  bodyMarkdown: string;
  useCases: string[];
  tags: string[];
  keywords: string[];
  disclaimer?: string;
  publishedAt: string;
  updatedAt: string;
  seoTitle: string;
  seoDescription: string;
};

export type ChangelogItem = {
  slug: string;
  status: ContentStatus;
  title: string;
  summary: string;
  bodyMarkdown: string;
  version?: string;
  publishedAt: string;
  updatedAt: string;
};

export const POST_SECTION_META: Record<PostSection, { label: string; path: string; description: string }> = {
  jobs: {
    label: '求职博文',
    path: '/posts/jobs',
    description: '围绕校招、社招、简历、面试、offer 决策的实用文章。',
  },
  product: {
    label: '产品文章',
    path: '/posts/product',
    description: 'Mui 简历的产品思考、能力说明和使用方式。',
  },
  guide: {
    label: '使用教程',
    path: '/posts/guide',
    description: '从下载安装到素材整理、简历生成、面试复盘的操作指南。',
  },
};

export const CONTENT_POSTS: ContentPost[] = [];

export const SKILL_CATALOG: SkillCatalogItem[] = [];

export const CHANGELOG_ITEMS: ChangelogItem[] = [];

function byPublishedAtDesc<T extends { publishedAt: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export function getPublishedPosts(section?: PostSection): ContentPost[] {
  const posts = CONTENT_POSTS.filter((post) => post.status === 'published' && (!section || post.section === section));
  return byPublishedAtDesc(posts);
}

export function getPostBySlug(section: PostSection, slug: string): ContentPost | null {
  return (
    CONTENT_POSTS.find((post) => post.status === 'published' && post.section === section && post.slug === slug) ?? null
  );
}

export function getPublishedSkills(): SkillCatalogItem[] {
  return byPublishedAtDesc(SKILL_CATALOG.filter((skill) => skill.status === 'published'));
}

export function getSkillBySlug(slug: string): SkillCatalogItem | null {
  return SKILL_CATALOG.find((skill) => skill.status === 'published' && skill.slug === slug) ?? null;
}

export function getPublishedChangelog(): ChangelogItem[] {
  return byPublishedAtDesc(CHANGELOG_ITEMS.filter((item) => item.status === 'published'));
}
