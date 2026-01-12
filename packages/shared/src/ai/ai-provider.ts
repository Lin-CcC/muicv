export type AiRole = 'system' | 'user' | 'assistant' | 'tool';

export type AiMessage = {
  role: AiRole;
  content: string;
};

export type AiUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export type AiGenerateTextParams = {
  model: string;
  messages: AiMessage[];
  temperature?: number;
  maxOutputTokens?: number;
  signal?: AbortSignal;
};

export type AiGenerateTextResult = {
  text: string;
  usage?: AiUsage;
};

export type AiStreamTextDeltaEvent = {
  type: 'delta';
  textDelta: string;
};

export type AiStreamTextDoneEvent = {
  type: 'done';
  usage?: AiUsage;
};

export type AiStreamTextEvent = AiStreamTextDeltaEvent | AiStreamTextDoneEvent;

export interface AiProvider {
  readonly providerName: string;
  generateText(params: AiGenerateTextParams): Promise<AiGenerateTextResult>;
  streamText(params: AiGenerateTextParams): AsyncIterable<AiStreamTextEvent>;
}
