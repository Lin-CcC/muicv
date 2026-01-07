import type { ChatMessage, MemoryEntry, ResumeJson } from '@muicv/shared';

import type { AiProviderId } from './ai-service.ts';
import { getAiClient } from './ai-service.ts';
import { getResumeGenerateSystemPrompt } from './system-prompts.ts';

type JsonPrimitive = null | boolean | number | string;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type GenerateResumeParams = {
  nowIso: string;
  memoryEntries: MemoryEntry[];
  conversationId?: string;
  messages?: ChatMessage[];
  provider?: AiProviderId;
  model?: string;
  maxMemoryEntries?: number;
  maxMessages?: number;
};

export type GenerateResumeResult = {
  resume: ResumeJson;
  usedMemoryEntries: number;
  usedMessages: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeOptionalText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeStringArray(value: unknown, limit: number): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items.slice(0, limit) : undefined;
}

function normalizeJsonFromModelText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('AI 未返回内容');

  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fencedMatch?.[1]) return fencedMatch[1].trim();

  const firstBraceIndex = trimmed.indexOf('{');
  const lastBraceIndex = trimmed.lastIndexOf('}');
  if (firstBraceIndex >= 0 && lastBraceIndex > firstBraceIndex) {
    return trimmed.slice(firstBraceIndex, lastBraceIndex + 1).trim();
  }

  return trimmed;
}

function parseJsonValue(text: string): JsonValue {
  const normalized = normalizeJsonFromModelText(text);
  try {
    return JSON.parse(normalized) as JsonValue;
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    throw new Error(`无法解析 AI 返回的 JSON：${message}`);
  }
}

function normalizeLinks(value: unknown): Array<{ label: string; url: string }> | undefined {
  if (!Array.isArray(value)) return undefined;

  const links = value
    .map((item) => {
      if (!isRecord(item)) return undefined;
      const label = normalizeOptionalText(item.label);
      const url = normalizeOptionalText(item.url);
      if (!label || !url) return undefined;
      return { label: label.length > 50 ? label.slice(0, 50) : label, url: url.length > 300 ? url.slice(0, 300) : url };
    })
    .filter((item): item is { label: string; url: string } => Boolean(item));

  return links.length > 0 ? links.slice(0, 12) : undefined;
}

function normalizeSource(value: unknown): Array<{ messageId: string; quote?: string }> | undefined {
  if (!Array.isArray(value)) return undefined;

  const sources = value
    .map((item) => {
      if (!isRecord(item)) return undefined;
      const messageId = normalizeOptionalText(item.messageId);
      if (!messageId) return undefined;
      const quote = normalizeOptionalText(item.quote);
      return {
        messageId,
        ...(quote ? { quote: quote.length > 200 ? quote.slice(0, 200) : quote } : {}),
      };
    })
    .filter((item): item is { messageId: string; quote?: string } => Boolean(item));

  return sources.length > 0 ? sources.slice(0, 6) : undefined;
}

function normalizeExperienceItems(value: unknown): ResumeJson['experiences'] | undefined {
  if (!Array.isArray(value)) return undefined;

  const items = value
    .map((item) => {
      if (!isRecord(item)) return undefined;
      const company = normalizeOptionalText(item.company);
      const role = normalizeOptionalText(item.role);
      const location = normalizeOptionalText(item.location);
      const startDate = normalizeOptionalText(item.startDate);
      const endDate = normalizeOptionalText(item.endDate);
      const highlights = normalizeStringArray(item.highlights, 8);
      const source = normalizeSource(item.source);

      if (!company && !role && !highlights) return undefined;

      return {
        ...(company ? { company: company.length > 80 ? company.slice(0, 80) : company } : {}),
        ...(role ? { role: role.length > 80 ? role.slice(0, 80) : role } : {}),
        ...(location ? { location: location.length > 80 ? location.slice(0, 80) : location } : {}),
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {}),
        ...(highlights ? { highlights } : {}),
        ...(source ? { source } : {}),
      };
    })
    .filter((item): item is NonNullable<ResumeJson['experiences']>[number] => Boolean(item));

  return items.length > 0 ? items.slice(0, 12) : undefined;
}

function normalizeProjectItems(value: unknown): ResumeJson['projects'] | undefined {
  if (!Array.isArray(value)) return undefined;

  const items = value
    .map((item) => {
      if (!isRecord(item)) return undefined;
      const name = normalizeOptionalText(item.name);
      const role = normalizeOptionalText(item.role);
      const startDate = normalizeOptionalText(item.startDate);
      const endDate = normalizeOptionalText(item.endDate);
      const highlights = normalizeStringArray(item.highlights, 8);
      const links = normalizeLinks(item.links);
      const source = normalizeSource(item.source);

      if (!name && !highlights) return undefined;

      return {
        ...(name ? { name: name.length > 120 ? name.slice(0, 120) : name } : {}),
        ...(role ? { role: role.length > 80 ? role.slice(0, 80) : role } : {}),
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {}),
        ...(highlights ? { highlights } : {}),
        ...(links ? { links } : {}),
        ...(source ? { source } : {}),
      };
    })
    .filter((item): item is NonNullable<ResumeJson['projects']>[number] => Boolean(item));

  return items.length > 0 ? items.slice(0, 12) : undefined;
}

function normalizeEducationItems(value: unknown): ResumeJson['education'] | undefined {
  if (!Array.isArray(value)) return undefined;

  const items = value
    .map((item) => {
      if (!isRecord(item)) return undefined;
      const school = normalizeOptionalText(item.school);
      const major = normalizeOptionalText(item.major);
      const degree = normalizeOptionalText(item.degree);
      const startDate = normalizeOptionalText(item.startDate);
      const endDate = normalizeOptionalText(item.endDate);
      const highlights = normalizeStringArray(item.highlights, 6);
      const source = normalizeSource(item.source);

      if (!school && !major && !degree && !highlights) return undefined;

      return {
        ...(school ? { school: school.length > 120 ? school.slice(0, 120) : school } : {}),
        ...(major ? { major: major.length > 120 ? major.slice(0, 120) : major } : {}),
        ...(degree ? { degree: degree.length > 80 ? degree.slice(0, 80) : degree } : {}),
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {}),
        ...(highlights ? { highlights } : {}),
        ...(source ? { source } : {}),
      };
    })
    .filter((item): item is NonNullable<ResumeJson['education']>[number] => Boolean(item));

  return items.length > 0 ? items.slice(0, 8) : undefined;
}

function normalizeBasicInfo(value: unknown): ResumeJson['basicInfo'] {
  if (!isRecord(value)) return {};

  const fullName = normalizeOptionalText(value.fullName);
  const headline = normalizeOptionalText(value.headline);
  const location = normalizeOptionalText(value.location);
  const email = normalizeOptionalText(value.email);
  const phone = normalizeOptionalText(value.phone);
  const links = normalizeLinks(value.links);

  return {
    ...(fullName ? { fullName: fullName.length > 80 ? fullName.slice(0, 80) : fullName } : {}),
    ...(headline ? { headline: headline.length > 120 ? headline.slice(0, 120) : headline } : {}),
    ...(location ? { location: location.length > 120 ? location.slice(0, 120) : location } : {}),
    ...(email ? { email: email.length > 120 ? email.slice(0, 120) : email } : {}),
    ...(phone ? { phone: phone.length > 60 ? phone.slice(0, 60) : phone } : {}),
    ...(links ? { links } : {}),
  };
}

function normalizeResumeJson(value: unknown, nowIso: string): ResumeJson {
  if (!isRecord(value)) {
    throw new Error('AI 返回的 JSON 不是对象');
  }

  const version = value.version;
  if (version !== 1) {
    throw new Error('AI 返回的 ResumeJson.version 不为 1');
  }

  const basicInfo = normalizeBasicInfo(value.basicInfo);
  const summary = normalizeOptionalText(value.summary);
  const skills = normalizeStringArray(value.skills, 40);

  const experiences = normalizeExperienceItems(value.experiences);
  const projects = normalizeProjectItems(value.projects);
  const education = normalizeEducationItems(value.education);

  return {
    version: 1,
    basicInfo,
    ...(summary ? { summary: summary.length > 1000 ? summary.slice(0, 1000) : summary } : {}),
    ...(skills ? { skills } : {}),
    ...(experiences ? { experiences } : {}),
    ...(projects ? { projects } : {}),
    ...(education ? { education } : {}),
    lastUpdatedAt: nowIso,
  };
}

function formatMessagesForModel(messages: ChatMessage[], limit: number): string {
  const selected = messages.slice(-limit);
  return selected
    .map((message) => {
      const role = message.role === 'assistant' ? 'assistant' : message.role;
      const content = message.content.trim();
      return `[${role}] ${content}`;
    })
    .join('\n');
}

function formatMemoryEntriesForModel(entries: MemoryEntry[], limit: number) {
  const selected = entries.slice(0, limit);
  return selected.map((entry) => ({
    id: entry.id,
    kind: entry.kind,
    title: entry.title,
    detail: entry.detail ?? null,
    tags: entry.tags ?? [],
    occurredAt: entry.occurredAt ?? null,
    createdAt: entry.createdAt,
    conversationId: entry.conversationId ?? null,
    messageId: entry.messageId ?? null,
  }));
}

export async function generateResumeJson(params: GenerateResumeParams): Promise<GenerateResumeResult> {
  const memoryLimit = params.maxMemoryEntries ?? 80;
  const messagesLimit = params.maxMessages ?? 24;
  const memoryEntries = params.memoryEntries.slice(0, memoryLimit);
  const messages = params.messages ?? [];

  const client = getAiClient({
    ...(params.model?.trim() ? { model: params.model.trim() } : {}),
    ...(params.provider ? { provider: params.provider } : {}),
  });

  const userContent = [
    `当前时间（用于解析“这个月/最近”等相对时间）：${params.nowIso}`,
    params.conversationId ? `当前对话 ID（用于生成特定版本简历时聚焦）：${params.conversationId}` : '',
    '',
    '用户记忆条目（按 createdAt 倒序，最新在前）：',
    JSON.stringify(formatMemoryEntriesForModel(memoryEntries, memoryLimit)),
    '',
    messages.length > 0 ? '对话摘录（事实以 user 为准；不要把 assistant 的内容当事实）：' : '',
    messages.length > 0 ? formatMessagesForModel(messages, messagesLimit) : '',
    '',
    '请按 system 要求输出 JSON：',
  ]
    .filter(Boolean)
    .join('\n');

  const result = await client.provider.generateText({
    maxOutputTokens: 1400,
    messages: [
      { role: 'system', content: getResumeGenerateSystemPrompt() },
      { role: 'user', content: userContent },
    ],
    model: client.model,
    temperature: 0.2,
  });

  const json = parseJsonValue(result.text);
  const resume = normalizeResumeJson(json, params.nowIso);
  return {
    resume,
    usedMemoryEntries: memoryEntries.length,
    usedMessages: messages.slice(-messagesLimit).length,
  };
}

export type { JsonValue };
