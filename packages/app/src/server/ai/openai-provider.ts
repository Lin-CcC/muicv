import type { AiGenerateTextParams, AiGenerateTextResult, AiProvider, AiStreamTextEvent } from '@muicv/shared';

type OpenAiChatCompletionMessageRole = 'system' | 'user' | 'assistant';

type OpenAiChatCompletionMessage = {
  role: OpenAiChatCompletionMessageRole;
  content: string;
};

type OpenAiChatCompletionRequest = {
  model: string;
  messages: OpenAiChatCompletionMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  stream_options?: {
    include_usage?: boolean;
  };
};

type OpenAiChatCompletionChoice = {
  message?: {
    role?: string;
    content?: string | null;
  };
};

type OpenAiChatCompletionUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

type OpenAiErrorPayload = {
  error?: {
    message?: string;
  };
};

type OpenAiChatCompletionResponse = OpenAiErrorPayload & {
  choices?: OpenAiChatCompletionChoice[];
  usage?: OpenAiChatCompletionUsage;
};

type OpenAiChatCompletionStreamChunk = OpenAiErrorPayload & {
  choices?: Array<{
    delta?: {
      role?: string;
      content?: string | null;
    };
  }>;
  usage?: OpenAiChatCompletionUsage;
};

export type CreateOpenAiProviderParams = {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
};

function toOpenAiRole(role: AiGenerateTextParams['messages'][number]['role']): OpenAiChatCompletionMessageRole {
  if (role === 'system') return 'system';
  if (role === 'assistant') return 'assistant';
  return 'user';
}

function formatOpenAiErrorMessage(status: number, payload: OpenAiErrorPayload | undefined) {
  const message = payload?.error?.message?.trim();
  return message ? `OpenAI 请求失败（status=${status}）：${message}` : `OpenAI 请求失败（status=${status}）`;
}

function buildUsage(usage: OpenAiChatCompletionUsage | undefined) {
  if (!usage) return undefined;

  const hasPrompt = usage.prompt_tokens !== undefined;
  const hasCompletion = usage.completion_tokens !== undefined;
  const hasTotal = usage.total_tokens !== undefined;
  if (!hasPrompt && !hasCompletion && !hasTotal) return undefined;

  return {
    ...(hasPrompt ? { inputTokens: usage.prompt_tokens } : {}),
    ...(hasCompletion ? { outputTokens: usage.completion_tokens } : {}),
    ...(hasTotal ? { totalTokens: usage.total_tokens } : {}),
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

export function createOpenAiProvider(params: CreateOpenAiProviderParams): AiProvider {
  const baseUrl = params.baseUrl?.trim() ? params.baseUrl.trim() : 'https://api.openai.com/v1';
  const timeoutMs = params.timeoutMs ?? 60_000;

  async function generateText(generateTextParams: AiGenerateTextParams): Promise<AiGenerateTextResult> {
    const { controller, cleanup } = createAbortController(timeoutMs, generateTextParams.signal);
    try {
      const requestBody: OpenAiChatCompletionRequest = {
        model: generateTextParams.model,
        messages: generateTextParams.messages.map((message) => ({
          role: toOpenAiRole(message.role),
          content: message.content,
        })),
        ...(generateTextParams.temperature === undefined ? {} : { temperature: generateTextParams.temperature }),
        ...(generateTextParams.maxOutputTokens === undefined ? {} : { max_tokens: generateTextParams.maxOutputTokens }),
      };

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${params.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      const json = (await response.json().catch(() => undefined)) as OpenAiChatCompletionResponse | undefined;
      if (!response.ok) {
        throw new Error(formatOpenAiErrorMessage(response.status, json));
      }

      const text = json?.choices?.[0]?.message?.content?.trim() ?? '';
      if (!text) {
        throw new Error('OpenAI 未返回内容');
      }

      const usage = buildUsage(json?.usage);
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
      const requestBody: OpenAiChatCompletionRequest = {
        model: generateTextParams.model,
        messages: generateTextParams.messages.map((message) => ({
          role: toOpenAiRole(message.role),
          content: message.content,
        })),
        stream: true,
        ...(generateTextParams.temperature === undefined ? {} : { temperature: generateTextParams.temperature }),
        ...(generateTextParams.maxOutputTokens === undefined ? {} : { max_tokens: generateTextParams.maxOutputTokens }),
      };

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${params.apiKey}`,
          accept: 'text/event-stream',
          'content-type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (!response.ok) {
        const json = (await response.json().catch(() => undefined)) as OpenAiChatCompletionResponse | undefined;
        throw new Error(formatOpenAiErrorMessage(response.status, json));
      }

      if (!response.body) {
        throw new Error('OpenAI 未返回流式响应');
      }

      let usage: ReturnType<typeof buildUsage> | undefined;
      let sawDoneMarker = false;

      for await (const data of iterateSseDataLines(response.body, controller.signal)) {
        if (data === '[DONE]') {
          sawDoneMarker = true;
          break;
        }

        const chunk = JSON.parse(data) as OpenAiChatCompletionStreamChunk;
        if (chunk.error?.message?.trim()) {
          throw new Error(`OpenAI 请求失败：${chunk.error.message.trim()}`);
        }

        const textDelta = chunk.choices?.[0]?.delta?.content ?? '';
        if (typeof textDelta === 'string' && textDelta) {
          yield { type: 'delta', textDelta };
        }

        const nextUsage = buildUsage(chunk.usage);
        if (nextUsage) usage = nextUsage;
      }

      if (!sawDoneMarker && controller.signal.aborted) {
        throw new Error('AbortError');
      }

      yield usage ? { type: 'done', usage } : { type: 'done' };
    } finally {
      cleanup();
    }
  }

  return {
    providerName: 'openai',
    generateText,
    streamText,
  };
}
