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

export function createOpenAiProvider(params: CreateOpenAiProviderParams): AiProvider {
  const baseUrl = params.baseUrl?.trim() ? params.baseUrl.trim() : 'https://api.openai.com/v1';
  const timeoutMs = params.timeoutMs ?? 60_000;

  async function generateText(generateTextParams: AiGenerateTextParams): Promise<AiGenerateTextResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

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
      clearTimeout(timeoutId);
    }
  }

  async function* streamText(generateTextParams: AiGenerateTextParams): AsyncIterable<AiStreamTextEvent> {
    const result = await generateText(generateTextParams);
    yield { type: 'delta', textDelta: result.text };
    yield result.usage ? { type: 'done', usage: result.usage } : { type: 'done' };
  }

  return {
    providerName: 'openai',
    generateText,
    streamText,
  };
}
