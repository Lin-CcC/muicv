import type { ComponentType } from 'react';

import type { ParsedResume } from '@/lib/render/parse-resume';

import DefaultTemplate from './default';

export type TemplateName = 'default';

export type TemplateProps = { resume: ParsedResume };

export const templates: Record<TemplateName, ComponentType<TemplateProps>> = {
  default: DefaultTemplate,
};

export function isTemplateName(value: unknown): value is TemplateName {
  return typeof value === 'string' && value in templates;
}
