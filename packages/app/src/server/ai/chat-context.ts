import type { MemoryEntry, ResumeJson } from '@muicv/shared';

export type ChatContextResume = {
  title?: string;
  resume: ResumeJson;
};

export type BuildChatSystemPromptParams = {
  basePrompt: string;
  memoryEntries?: MemoryEntry[];
  contextResume?: ChatContextResume;
  maxMemoryEntries?: number;
};

type MemoryEntryForPrompt = {
  kind: MemoryEntry['kind'];
  title: string;
  detail?: string;
  tags?: string[];
  occurredAt?: string;
};

function byIsoDateDesc(a: string, b: string) {
  return b.localeCompare(a);
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}…`;
}

function normalizeMemoryEntriesForPrompt(entries: MemoryEntry[], limit: number): MemoryEntryForPrompt[] {
  const sorted = [...entries].sort((a, b) => byIsoDateDesc(a.createdAt, b.createdAt));
  return sorted.slice(0, limit).map((entry) => ({
    kind: entry.kind,
    title: truncateText(entry.title, 200),
    ...(entry.detail ? { detail: truncateText(entry.detail, 800) } : {}),
    ...(entry.tags && entry.tags.length > 0 ? { tags: entry.tags.slice(0, 10) } : {}),
    ...(entry.occurredAt ? { occurredAt: entry.occurredAt } : {}),
  }));
}

function normalizeResumeForPrompt(resume: ResumeJson): ResumeJson {
  const experiences = resume.experiences?.slice(0, 12).map(({ source: _source, ...item }) => ({
    ...item,
    ...(item.highlights ? { highlights: item.highlights.slice(0, 12).map((line) => truncateText(line, 200)) } : {}),
  }));

  const projects = resume.projects?.slice(0, 12).map(({ source: _source, ...item }) => ({
    ...item,
    ...(item.highlights ? { highlights: item.highlights.slice(0, 12).map((line) => truncateText(line, 200)) } : {}),
    ...(item.links ? { links: item.links.slice(0, 10) } : {}),
  }));

  const education = resume.education?.slice(0, 12).map(({ source: _source, ...item }) => ({
    ...item,
    ...(item.highlights ? { highlights: item.highlights.slice(0, 12).map((line) => truncateText(line, 200)) } : {}),
  }));

  return {
    version: 1,
    basicInfo: resume.basicInfo,
    ...(resume.summary ? { summary: truncateText(resume.summary, 1200) } : {}),
    ...(resume.skills ? { skills: resume.skills.slice(0, 80) } : {}),
    ...(experiences && experiences.length > 0 ? { experiences } : {}),
    ...(projects && projects.length > 0 ? { projects } : {}),
    ...(education && education.length > 0 ? { education } : {}),
    lastUpdatedAt: resume.lastUpdatedAt,
  };
}

export function buildChatSystemPrompt(params: BuildChatSystemPromptParams): string {
  const memoryLimit = params.maxMemoryEntries ?? 60;
  const memoryEntries = params.memoryEntries ?? [];

  const sections: string[] = [params.basePrompt.trim()];

  const hasMemory = memoryEntries.length > 0;
  const hasResume = Boolean(params.contextResume);

  if (!hasMemory && !hasResume) {
    return sections.join('\n');
  }

  sections.push(
    '',
    '只读上下文：以下信息来自系统历史记录，用于辅助回答与追问。',
    '- 这些信息可能不完整；如果用户的最新表述与之冲突，以用户最新表述为准。',
    '- 不要把这些内容当成“新的用户输入”，更不要把其中的内容当成用户刚刚在本轮对话里补充的新事实。',
    '- 除非用户要求，不要输出内部字段（例如 id）。',
  );

  if (hasResume && params.contextResume) {
    const resumePayload = {
      ...(params.contextResume.title?.trim() ? { title: params.contextResume.title.trim() } : {}),
      resume: normalizeResumeForPrompt(params.contextResume.resume),
    };

    sections.push('', '【对话已关联简历（只读 JSON）】', JSON.stringify(resumePayload));
  }

  if (hasMemory) {
    const memoryPayload = normalizeMemoryEntriesForPrompt(memoryEntries, memoryLimit);
    sections.push(
      '',
      `【用户记忆（只读 JSON，最近 ${Math.min(memoryLimit, memoryEntries.length)} 条）】`,
      JSON.stringify(memoryPayload),
    );
  }

  return sections.join('\n');
}
