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

function createAbortController(timeoutMs: number, signal: AbortSignal | undefined) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const abortHandler = () => controller.abort();
  let didSubscribe = false;
  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener('abort', abortHandler);
      didSubscribe = true;
    }
  }

  function cleanup() {
    clearTimeout(timeoutId);
    if (signal && didSubscribe) {
      signal.removeEventListener('abort', abortHandler);
    }
  }

  return { cleanup, controller };
}

async function* iterateSseDataLines(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal | undefined,
): AsyncIterable<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      if (signal?.aborted) {
        throw new Error('AbortError');
      }

      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;

      buffer += decoder.decode(value, { stream: true });
      buffer = buffer.replaceAll('\r\n', '\n');

      let boundaryIndex = buffer.indexOf('\n\n');
      while (boundaryIndex >= 0) {
        const rawEvent = buffer.slice(0, boundaryIndex);
        buffer = buffer.slice(boundaryIndex + 2);

        for (const line of rawEvent.split('\n')) {
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trimStart();
          if (!data) continue;
          yield data;
        }

        boundaryIndex = buffer.indexOf('\n\n');
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

export function createGeminiProvider(params: CreateGeminiProviderParams): AiProvider {
  const baseUrl = params.baseUrl?.trim() ? params.baseUrl.trim() : 'https://generativelanguage.googleapis.com/v1beta';
  const timeoutMs = params.timeoutMs ?? 60_000;

  async function generateText(generateTextParams: AiGenerateTextParams): Promise<AiGenerateTextResult> {
    const { controller, cleanup } = createAbortController(timeoutMs, generateTextParams.signal);
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
      cleanup();
    }
  }

  async function* streamText(generateTextParams: AiGenerateTextParams): AsyncIterable<AiStreamTextEvent> {
    const { controller, cleanup } = createAbortController(timeoutMs, generateTextParams.signal);

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

      const url = new URL(`${baseUrl}/models/${generateTextParams.model}:streamGenerateContent`);
      url.searchParams.set('key', params.apiKey);
      url.searchParams.set('alt', 'sse');

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          accept: 'text/event-stream',
          'content-type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (!response.ok) {
        const json = (await response.json().catch(() => undefined)) as GeminiGenerateContentResponse | undefined;
        throw new Error(formatGeminiErrorMessage(response.status, json));
      }

      if (!response.body) {
        throw new Error('Gemini 未返回流式响应');
      }

      let usage: ReturnType<typeof buildUsage> | undefined;

      for await (const data of iterateSseDataLines(response.body, controller.signal)) {
        const chunk = JSON.parse(data) as GeminiGenerateContentResponse;

        const errorMessage = chunk.error?.message?.trim();
        if (errorMessage) {
          throw new Error(`Gemini 请求失败：${errorMessage}`);
        }

        const parts = chunk.candidates?.[0]?.content?.parts ?? [];
        const textDelta = parts.map((part) => part.text ?? '').join('');

        if (textDelta) {
          yield { type: 'delta', textDelta };
        }

        const nextUsage = buildUsage(chunk.usageMetadata);
        if (nextUsage) usage = nextUsage;
      }

      if (controller.signal.aborted) {
        throw new Error('AbortError');
      }

      yield usage ? { type: 'done', usage } : { type: 'done' };
    } finally {
      cleanup();
    }
  }

  return {
    providerName: 'gemini',
    generateText,
    streamText,
  };
}
