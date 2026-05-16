import type { CollectionConfig } from 'payload';

export const Changelog: CollectionConfig = {
  slug: 'changelog',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'version', 'status', 'publishedAt'],
  },
  versions: {
    drafts: true,
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: [
        { label: '草稿', value: 'draft' },
        { label: '已发布', value: 'published' },
      ],
    },
    { name: 'version', type: 'text' },
    { name: 'summary', type: 'textarea', required: true },
    { name: 'bodyMarkdown', type: 'textarea', required: true },
    { name: 'publishedAt', type: 'date', required: true },
  ],
};
