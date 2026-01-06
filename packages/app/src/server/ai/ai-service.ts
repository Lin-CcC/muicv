import type { AiMessage, AiProvider, ChatMessage } from '@muicv/shared';

import { getRuntimeEnvValue, requireRuntimeEnvValue } from '../runtime-env.ts';
import { createGeminiProvider } from './gemini-provider.ts';
import { createOpenAiProvider } from './openai-provider.ts';

export type AiProviderId = 'openai' | 'gemini';

export type CreateAiClientParams = {
  provider?: AiProviderId;
  model?: string;
};

type AiClient = {
  providerId: AiProviderId;
  model: string;
  provider: AiProvider;
};

type GlobalWithAiClient = typeof globalThis & {
  __muicvAiClient?: AiClient;
};

const globalWithAiClient = globalThis as GlobalWithAiClient;

function parseAiProviderId(value: string | undefined): AiProviderId | undefined {
  if (value === 'openai') return 'openai';
  if (value === 'gemini') return 'gemini';
  return undefined;
}

function resolveDefaultProviderId() {
  const fromEnv = parseAiProviderId(getRuntimeEnvValue('MUICV_AI_PROVIDER'));
  if (fromEnv) return fromEnv;

  const hasOpenAiKey = Boolean(getRuntimeEnvValue('OPENAI_API_KEY'));
  const hasGoogleKey = Boolean(getRuntimeEnvValue('GOOGLE_API_KEY'));

  if (hasOpenAiKey) return 'openai';
  if (hasGoogleKey) return 'gemini';

  throw new Error('未配置 AI Key：请设置 OPENAI_API_KEY 或 GOOGLE_API_KEY');
}

function resolveModel(providerId: AiProviderId) {
  if (providerId === 'openai') {
    return getRuntimeEnvValue('MUICV_OPENAI_MODEL') ?? 'gpt-4o-mini';
  }

  return getRuntimeEnvValue('MUICV_GEMINI_MODEL') ?? 'gemini-1.5-flash';
}

function createAiClient(params?: CreateAiClientParams): AiClient {
  const providerId = params?.provider ?? resolveDefaultProviderId();
  const model = params?.model?.trim() ? params.model.trim() : resolveModel(providerId);

  if (providerId === 'openai') {
    const apiKey = requireRuntimeEnvValue('OPENAI_API_KEY');
    return {
      model,
      provider: createOpenAiProvider({ apiKey }),
      providerId,
    };
  }

  const apiKey = requireRuntimeEnvValue('GOOGLE_API_KEY');
  return {
    model,
    provider: createGeminiProvider({ apiKey }),
    providerId,
  };
}

export function getAiClient(params?: CreateAiClientParams): AiClient {
  const resolvedProvider = params?.provider;
  const resolvedModel = params?.model;

  if (!resolvedProvider && !resolvedModel && globalWithAiClient.__muicvAiClient) {
    return globalWithAiClient.__muicvAiClient;
  }

  const client = createAiClient(params);
  if (!resolvedProvider && !resolvedModel) {
    globalWithAiClient.__muicvAiClient = client;
  }

  return client;
}

export type BuildAssistantPromptParams = {
  systemPrompt: string;
  messages: ChatMessage[];
  maxHistoryMessages?: number;
};

export function buildAiMessagesForAssistant(params: BuildAssistantPromptParams): AiMessage[] {
  const maxHistoryMessages = params.maxHistoryMessages ?? 30;
  const history = params.messages.slice(-maxHistoryMessages);

  return [
    {
      role: 'system',
      content: params.systemPrompt,
    },
    ...history.map((message) => ({
      role: message.role,
      content: message.content,
    })),
  ];
}
