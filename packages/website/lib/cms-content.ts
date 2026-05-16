import {
  fetchCmsPostBySlug,
  fetchCmsPublishedPosts,
  fetchCmsPublishedSkills,
  fetchCmsSkillBySlug,
  type PostSection,
} from '@muicv/shared';

function getCmsOptions() {
  const baseUrl = process.env.MUICV_CMS_URL;
  return baseUrl ? { baseUrl } : {};
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
