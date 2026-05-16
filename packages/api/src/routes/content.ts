import {
  getPostBySlug,
  getPublishedChangelog,
  getPublishedPosts,
  getPublishedSkills,
  getSkillBySlug,
  type PostSection,
} from '@muicv/shared';
import type { Context } from 'hono';

function isPostSection(value: string): value is PostSection {
  return value === 'jobs' || value === 'product' || value === 'guide';
}

export function handleSkillsCatalog(c: Context) {
  const skills = getPublishedSkills().map((skill) => ({
    slug: skill.slug,
    title: skill.title,
    publisher: skill.publisher,
    publisherType: skill.publisherType,
    sourceUrl: skill.sourceUrl ?? null,
    sourceLabel: skill.sourceLabel ?? null,
    sourceNote: skill.sourceNote ?? null,
    distributionMode: skill.distributionMode,
    appAvailability: skill.appAvailability,
    summary: skill.summary,
    useCases: skill.useCases,
    tags: skill.tags,
    updatedAt: skill.updatedAt,
    detailUrl: `https://muicv.com/skills/${skill.slug}`,
    disclaimer: skill.disclaimer ?? null,
  }));

  return c.json({
    manifestVersion: 1,
    generatedAt: new Date().toISOString(),
    skills,
  });
}

export function handleSkillDetail(c: Context) {
  const slug = c.req.param('slug');
  const skill = getSkillBySlug(slug);
  if (!skill) return c.json({ error: 'skill-not-found' }, 404);

  return c.json({
    ...skill,
    detailUrl: `https://muicv.com/skills/${skill.slug}`,
    installPackage: null,
  });
}

export function handlePostsList(c: Context) {
  const sectionRaw = c.req.query('section');
  if (sectionRaw && !isPostSection(sectionRaw)) {
    return c.json({ error: 'invalid-section' }, 400);
  }
  const posts = getPublishedPosts(sectionRaw).map((post) => ({
    slug: post.slug,
    section: post.section,
    title: post.title,
    summary: post.summary,
    tags: post.tags,
    publishedAt: post.publishedAt,
    updatedAt: post.updatedAt,
    url: `https://muicv.com/posts/${post.section}/${post.slug}`,
  }));
  return c.json({ posts });
}

export function handlePostDetail(c: Context) {
  const section = c.req.param('section');
  const slug = c.req.param('slug');
  if (!isPostSection(section)) return c.json({ error: 'invalid-section' }, 400);

  const post = getPostBySlug(section, slug);
  if (!post) return c.json({ error: 'post-not-found' }, 404);
  return c.json({ ...post, url: `https://muicv.com/posts/${post.section}/${post.slug}` });
}

export function handleChangelog(c: Context) {
  return c.json({ items: getPublishedChangelog() });
}
