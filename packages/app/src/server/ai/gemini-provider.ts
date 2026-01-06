import type { AiGenerateTextParams, AiGenerateTextResult, AiProvider, AiStreamTextEvent } from '@muicv/shared';

type GeminiContentRole = 'user' | 'model';

type GeminiPart = {
  text: string;
};

type GeminiContent = {
  role: GeminiContentRole;
  parts: GeminiPart[];
};

type GeminiGenerateContentRequest = {
  contents: GeminiContent[];
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
  };
};

type GeminiUsageMetadata = {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
};

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  usageMetadata?: GeminiUsageMetadata;
  error?: {
    message?: string;
  };
};

export type CreateGeminiProviderParams = {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
};

function toGeminiRole(role: AiGenerateTextParams['messages'][number]['role']): GeminiContentRole {
  if (role === 'assistant') return 'model';
  return 'user';
}

function buildGeminiContents(messages: AiGenerateTextParams['messages']): GeminiContent[] {
  const contents: GeminiContent[] = [];
  for (const message of messages) {
    contents.push({
      role: toGeminiRole(message.role),
      parts: [{ text: message.content }],
    });
  }
  return contents;
}

function formatGeminiErrorMessage(status: number, payload: GeminiGenerateContentResponse | undefined) {
  const message = payload?.error?.message?.trim();
  return message ? `Gemini 请求失败（status=${status}）：${message}` : `Gemini 请求失败（status=${status}）`;
}

function buildUsage(usage: GeminiUsageMetadata | undefined) {
  if (!usage) return undefined;

  const hasPrompt = usage.promptTokenCount !== undefined;
  const hasCandidates = usage.candidatesTokenCount !== undefined;
  const hasTotal = usage.totalTokenCount !== undefined;
  if (!hasPrompt && !hasCandidates && !hasTotal) return undefined;

  return {
    ...(hasPrompt ? { inputTokens: usage.promptTokenCount } : {}),
    ...(hasCandidates ? { outputTokens: usage.candidatesTokenCount } : {}),
    ...(hasTotal ? { totalTokens: usage.totalTokenCount } : {}),
  };
}

export function createGeminiProvider(params: CreateGeminiProviderParams): AiProvider {
  const baseUrl = params.baseUrl?.trim() ? params.baseUrl.trim() : 'https://generativelanguage.googleapis.com/v1beta';
  const timeoutMs = params.timeoutMs ?? 60_000;

  async function generateText(generateTextParams: AiGenerateTextParams): Promise<AiGenerateTextResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const generationConfig =
        generateTextParams.temperature === undefined && generateTextParams.maxOutputTokens === undefined
          ? undefined
          : {
              ...(generateTextParams.temperature === undefined ? {} : { temperature: generateTextParams.temperature }),
              ...(generateTextParams.maxOutputTokens === undefined
                ? {}
                : { maxOutputTokens: generateTextParams.maxOutputTokens }),
            };

      const requestBody: GeminiGenerateContentRequest = {
        contents: buildGeminiContents(generateTextParams.messages),
        ...(generationConfig ? { generationConfig } : {}),
      };

      const url = new URL(`${baseUrl}/models/${generateTextParams.model}:generateContent`);
      url.searchParams.set('key', params.apiKey);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      const json = (await response.json().catch(() => undefined)) as GeminiGenerateContentResponse | undefined;
      if (!response.ok) {
        throw new Error(formatGeminiErrorMessage(response.status, json));
      }

      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
      if (!text) {
        throw new Error('Gemini 未返回内容');
      }

      const usage = buildUsage(json?.usageMetadata);
      return {
        text,
        ...(usage ? { usage } : {}),
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function* streamText(generateTextParams: AiGenerateTextParams): AsyncIterable<AiStreamTextEvent> {
    const result = await generateText(generateTextParams);
    yield { type: 'delta', textDelta: result.text };
    yield result.usage ? { type: 'done', usage: result.usage } : { type: 'done' };
  }

  return {
    providerName: 'gemini',
    generateText,
    streamText,
  };
}
