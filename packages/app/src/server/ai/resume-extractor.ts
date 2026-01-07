import type { ChatMessage, ResumeJson } from '@muicv/shared';

import type { AiProviderId } from './ai-service.ts';
import { getAiClient } from './ai-service.ts';
import { getResumeExtractionSystemPrompt } from './system-prompts.ts';
import { createMonotonicIsoTimestamp } from '../monotonic-time.ts';

type JsonPrimitive = null | boolean | number | string;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

type ResumeExtractionPayload = {
  shouldUpdateResume?: unknown;
  updatedResume?: unknown;
  changeSummary?: unknown;
};

export type ExtractResumeUpdateParams = {
  currentResume: ResumeJson | null;
  messages: ChatMessage[];
  provider?: AiProviderId;
  model?: string;
  maxHistoryMessages?: number;
};

export type ExtractResumeUpdateResult = {
  shouldUpdateResume: boolean;
  updatedResume: ResumeJson | null;
  changeSummary: string[];
};

function createEmptyResumeJson(): ResumeJson {
  return {
    basicInfo: {},
    lastUpdatedAt: createMonotonicIsoTimestamp(),
    version: 1,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isResumeJson(value: unknown): value is ResumeJson {
  if (!isRecord(value)) return false;
  return value.version === 1 && typeof value.lastUpdatedAt === 'string' && isRecord(value.basicInfo);
}

function coerceResumeJson(value: unknown, fallback: ResumeJson): ResumeJson {
  if (isResumeJson(value)) return value;
  if (!isRecord(value)) {
    throw new Error('AI 返回的 updatedResume 不是对象');
  }

  const version = 1;
  const basicInfo = isRecord(value.basicInfo) ? (value.basicInfo as ResumeJson['basicInfo']) : {};
  const lastUpdatedAt = typeof value.lastUpdatedAt === 'string' ? value.lastUpdatedAt : fallback.lastUpdatedAt;

  const coerced: ResumeJson = {
    version,
    basicInfo,
    lastUpdatedAt,
  };

  if (typeof value.summary === 'string') {
    coerced.summary = value.summary;
  }

  if (Array.isArray(value.skills) && value.skills.every((item) => typeof item === 'string')) {
    coerced.skills = value.skills as string[];
  }

  if (Array.isArray(value.experiences)) {
    coerced.experiences = value.experiences as NonNullable<ResumeJson['experiences']>;
  }

  if (Array.isArray(value.projects)) {
    coerced.projects = value.projects as NonNullable<ResumeJson['projects']>;
  }

  if (Array.isArray(value.education)) {
    coerced.education = value.education as NonNullable<ResumeJson['education']>;
  }

  if (!isResumeJson(coerced)) {
    throw new Error('AI 返回的 updatedResume 无法转成合法 ResumeJson');
  }

  return coerced;
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

function normalizeChangeSummary(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatMessagesForExtraction(messages: ChatMessage[], limit: number): string {
  const selected = messages.slice(-limit);
  return selected
    .map((message) => {
      const role = message.role === 'assistant' ? 'assistant' : message.role;
      return `[${role}] ${message.content}`;
    })
    .join('\n');
}

export async function extractResumeUpdate(params: ExtractResumeUpdateParams): Promise<ExtractResumeUpdateResult> {
  const baseResume = params.currentResume ?? createEmptyResumeJson();
  const historyLimit = params.maxHistoryMessages ?? 12;

  const client = getAiClient({
    ...(params.model?.trim() ? { model: params.model.trim() } : {}),
    ...(params.provider ? { provider: params.provider } : {}),
  });

  const userContent = [
    '当前 ResumeJson（仅供对比与增量更新）：',
    JSON.stringify(baseResume),
    '',
    '对话摘录（用于理解上下文；事实以用户消息为准，不要把 assistant 的建议当成事实）：',
    formatMessagesForExtraction(params.messages, historyLimit),
    '',
    '请按 system 要求输出 JSON：',
  ].join('\n');

  const result = await client.provider.generateText({
    maxOutputTokens: 1200,
    messages: [
      { role: 'system', content: getResumeExtractionSystemPrompt() },
      { role: 'user', content: userContent },
    ],
    model: client.model,
    temperature: 0.1,
  });

  const json = parseJsonValue(result.text);
  if (!isRecord(json)) {
    throw new Error('AI 返回的 JSON 不是对象');
  }

  const payload = json as unknown as ResumeExtractionPayload;
  const shouldUpdateResume = payload.shouldUpdateResume === true;

  if (!shouldUpdateResume) {
    return {
      changeSummary: [],
      shouldUpdateResume: false,
      updatedResume: null,
    };
  }

  const updatedResume = coerceResumeJson(payload.updatedResume, baseResume);
  return {
    changeSummary: normalizeChangeSummary(payload.changeSummary),
    shouldUpdateResume: true,
    updatedResume,
  };
}
