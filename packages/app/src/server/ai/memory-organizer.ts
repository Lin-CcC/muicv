import type { MemoryEntry, MemoryEntryKind } from '@muicv/shared';

import type { AiProviderId } from './ai-service.ts';
import { getAiClient } from './ai-service.ts';
import { getMemoryOrganizeSystemPrompt } from './system-prompts.ts';

type JsonPrimitive = null | boolean | number | string;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type MemoryEntryDraft = {
  kind: MemoryEntryKind;
  title: string;
  detail?: string;
  tags?: string[];
  occurredAt?: string;
};

type MemoryOrganizePayload = {
  entries?: unknown;
};

export type OrganizeMemoryEntriesParams = {
  entries: MemoryEntry[];
  nowIso: string;
  provider?: AiProviderId;
  model?: string;
  maxInputEntries?: number;
};

export type OrganizeMemoryEntriesResult = {
  entries: MemoryEntryDraft[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeOptionalText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeTags(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const tags = value
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
  return tags.length > 0 ? tags.slice(0, 10) : undefined;
}

function isMemoryEntryKind(value: unknown): value is MemoryEntryKind {
  return (
    value === 'career_event' ||
    value === 'skill' ||
    value === 'project' ||
    value === 'education' ||
    value === 'preference' ||
    value === 'contact' ||
    value === 'other'
  );
}

function normalizeMemoryEntryDraft(value: unknown): MemoryEntryDraft | undefined {
  if (!isRecord(value)) return undefined;

  const kind = value.kind;
  if (!isMemoryEntryKind(kind)) return undefined;

  const title = normalizeOptionalText(value.title);
  if (!title) return undefined;

  const detail = normalizeOptionalText(value.detail);
  const occurredAt = normalizeOptionalText(value.occurredAt);
  const tags = normalizeTags(value.tags);

  return {
    kind,
    title: title.length > 200 ? title.slice(0, 200) : title,
    ...(detail ? { detail: detail.length > 800 ? detail.slice(0, 800) : detail } : {}),
    ...(tags ? { tags } : {}),
    ...(occurredAt ? { occurredAt } : {}),
  };
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

function formatEntriesForModel(entries: MemoryEntry[], limit: number) {
  const selected = entries.slice(0, limit);
  return selected.map((entry) => ({
    id: entry.id,
    kind: entry.kind,
    title: entry.title,
    detail: entry.detail ?? null,
    tags: entry.tags ?? [],
    occurredAt: entry.occurredAt ?? null,
    createdAt: entry.createdAt,
  }));
}

export async function organizeMemoryEntries(params: OrganizeMemoryEntriesParams): Promise<OrganizeMemoryEntriesResult> {
  const inputLimit = params.maxInputEntries ?? 30;
  const client = getAiClient({
    ...(params.model?.trim() ? { model: params.model.trim() } : {}),
    ...(params.provider ? { provider: params.provider } : {}),
  });

  const userContent = [
    `当前时间（用于解析“这个月/最近”等相对时间）：${params.nowIso}`,
    '',
    '以下是用户的记忆条目（已按 createdAt 倒序，最新在前）。这些内容都来自用户事实陈述：',
    JSON.stringify(formatEntriesForModel(params.entries, inputLimit)),
    '',
    '请按 system 要求输出 JSON：',
  ].join('\n');

  const result = await client.provider.generateText({
    maxOutputTokens: 900,
    messages: [
      { role: 'system', content: getMemoryOrganizeSystemPrompt() },
      { role: 'user', content: userContent },
    ],
    model: client.model,
    temperature: 0.2,
  });

  const json = parseJsonValue(result.text);
  if (!isRecord(json)) {
    throw new Error('AI 返回的 JSON 不是对象');
  }

  const payload = json as unknown as MemoryOrganizePayload;
  const entriesRaw = payload.entries;
  if (!Array.isArray(entriesRaw)) {
    return { entries: [] };
  }

  const entries = entriesRaw
    .map(normalizeMemoryEntryDraft)
    .filter((entry): entry is MemoryEntryDraft => Boolean(entry));

  return { entries };
}
