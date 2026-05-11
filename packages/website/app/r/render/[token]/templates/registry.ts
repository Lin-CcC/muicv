import type { ComponentType } from 'react';

import { isTemplateId, type TemplateId, type TemplateLang, type TemplateResumeData } from '@muicv/shared';

import type { ParsedResume } from '@/lib/render/parse-resume';

import DefaultTemplate from './default';
import T1Classic from './t1-classic';
import T2Minimal from './t2-minimal';
import T3Sidebar from './t3-sidebar';
import T4Tech from './t4-tech';
import T5Timeline from './t5-timeline';
import T6Academic from './t6-academic';

/** 老路径：markdown 字符串 → marked → HTML 注入。 */
export type MarkdownTemplateProps = { resume: ParsedResume };
/** 新路径：结构化双语 JSON → 6 套设计模板任意挑。 */
export type JsonTemplateProps = { resume: TemplateResumeData; lang: TemplateLang; accent?: string };

export type TemplateName = TemplateId;
export { isTemplateId as isTemplateName };

export const markdownTemplates: Record<'default', ComponentType<MarkdownTemplateProps>> = {
  default: DefaultTemplate,
};

export const jsonTemplates: Record<Exclude<TemplateId, 'default'>, ComponentType<JsonTemplateProps>> = {
  't1-classic': T1Classic,
  't2-minimal': T2Minimal,
  't3-sidebar': T3Sidebar,
  't4-tech': T4Tech,
  't5-timeline': T5Timeline,
  't6-academic': T6Academic,
};
