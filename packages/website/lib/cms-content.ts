import {
  fetchCmsPostBySlug,
  fetchCmsPublishedChangelog,
  fetchCmsPublishedPosts,
  fetchCmsPublishedSkills,
  fetchCmsSkillBySlug,
  type PostSection,
} from '@muicv/shared';

const WEBSITE_CMS_CACHE = 'force-cache' as const;

function getCmsOptions() {
  const baseUrl = process.env.MUICV_CMS_URL;
  return baseUrl ? { baseUrl, cache: WEBSITE_CMS_CACHE } : { cache: WEBSITE_CMS_CACHE };
}

export function getWebsitePublishedPosts(section?: PostSection) {
  return fetchCmsPublishedPosts(section, getCmsOptions());
}

export function getWebsitePostBySlug(section: PostSection, slug: string) {
  return fetchCmsPostBySlug(section, slug, getCmsOptions());
}

export function getWebsitePublishedSkills() {
  return fetchCmsPublishedSkills(getCmsOptions());
}

export function getWebsiteSkillBySlug(slug: string) {
  return fetchCmsSkillBySlug(slug, getCmsOptions());
}

export function getWebsitePublishedChangelog() {
  return fetchCmsPublishedChangelog(getCmsOptions());
}
