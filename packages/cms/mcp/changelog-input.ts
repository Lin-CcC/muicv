import * as z from 'zod/v4';

import { contentStatusSchema, slugifyTitle } from './post-input.ts';

const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(96)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug 只能使用小写字母、数字和连字符');

export const changelogFieldsSchema = z.object({
  title: z.string().trim().min(1).max(120),
  slug: slugSchema.optional(),
  status: contentStatusSchema.default('draft'),
  version: z.string().trim().min(1).max(40).optional(),
  summary: z.string().trim().min(1).max(320),
  bodyMarkdown: z.string().trim().min(1),
  publishedAt: z.string().trim().min(1).optional(),
});

export const createChangelogInputSchema = changelogFieldsSchema.extend({
  dryRun: z.boolean().default(false),
});

export const upsertChangelogInputSchema = createChangelogInputSchema.extend({
  onConflict: z.enum(['error', 'update']).default('update'),
});

export const getChangelogInputSchema = z.object({
  slug: slugSchema,
});

export type CreateChangelogInput = z.output<typeof createChangelogInputSchema>;
export type UpsertChangelogInput = z.output<typeof upsertChangelogInputSchema>;
export type GetChangelogInput = z.output<typeof getChangelogInputSchema>;

export type CmsChangelogPayload = {
  title: string;
  slug: string;
  status: CreateChangelogInput['status'];
  _status: CreateChangelogInput['status'];
  version?: string;
  summary: string;
  bodyMarkdown: string;
  publishedAt: string;
};

export type NormalizedCreateChangelogInput = {
  dryRun: boolean;
  payload: CmsChangelogPayload;
};

export type NormalizedUpsertChangelogInput = NormalizedCreateChangelogInput & {
  onConflict: UpsertChangelogInput['onConflict'];
};

export function normalizeCreateChangelogInput(input: unknown, now = new Date()): NormalizedCreateChangelogInput {
  const parsed = createChangelogInputSchema.parse(input);
  return {
    dryRun: parsed.dryRun,
    payload: buildChangelogPayload(parsed, now),
  };
}

export function normalizeUpsertChangelogInput(input: unknown, now = new Date()): NormalizedUpsertChangelogInput {
  const parsed = upsertChangelogInputSchema.parse(input);
  return {
    dryRun: parsed.dryRun,
    onConflict: parsed.onConflict,
    payload: buildChangelogPayload(parsed, now),
  };
}

export function normalizeGetChangelogInput(input: unknown): GetChangelogInput {
  return getChangelogInputSchema.parse(input);
}

function buildChangelogPayload(input: CreateChangelogInput, now: Date): CmsChangelogPayload {
  const slug = input.slug ?? slugifyTitle(input.title, now);
  return {
    title: input.title,
    slug,
    status: input.status,
    _status: input.status,
    ...optionalString('version', input.version),
    summary: input.summary,
    bodyMarkdown: input.bodyMarkdown,
    publishedAt: input.publishedAt ?? formatDate(now),
  };
}

function optionalString<Key extends 'version'>(key: Key, value: string | undefined): Partial<Record<Key, string>> {
  return value ? ({ [key]: value } as Record<Key, string>) : {};
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
