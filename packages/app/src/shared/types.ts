/**
 * main 和 renderer 共用的类型。preload 把同形 API 暴露给 window.muicv。
 */

export type AppConfig = {
  /** 用户工作目录绝对路径，所有 .claude/muicv/ 操作落到这里。 */
  workspaceDir: string | null;
  /** muirouter API key（sk-gw-...），用于 LLM 调用 + 余额查询。可选 */
  muirouterKey: string | null;
  /** muicv 后端 API key（mui_...），用于调 /render /jobs/fetch。可选 */
  muicvApiKey: string | null;
  /** muicv API base URL，默认 https://api.muicv.com */
  muicvApiBase: string;
  /** muirouter LLM base URL，默认 https://api.muirouter.com/v1（OpenAI 兼容） */
  muirouterLlmBase: string;
  /** 默认模型 id（具体 muirouter 支持哪些跑通后再调） */
  defaultModel: string;
};

export const DEFAULT_CONFIG: AppConfig = {
  workspaceDir: null,
  muirouterKey: null,
  muicvApiKey: null,
  muicvApiBase: 'https://api.muicv.com',
  muirouterLlmBase: 'https://api.muirouter.com/v1',
  defaultModel: 'gpt-4o-mini',
};

export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

export type ChatMessage = {
  id: string;
  role: ChatRole;
  /** 文本内容（assistant 回复 / 用户输入 / tool result 摘要）。 */
  content: string;
  /** 如果是 assistant 调了 tool，记录工具名和输入。 */
  toolCalls?: Array<{
    id: string;
    name: string;
    input: unknown;
    output?: unknown;
    error?: string;
  }>;
  createdAt: number;
};

/** preload 注入到 window.muicv 的 API 形状。 */
export type RendererApi = {
  config: {
    get(): Promise<AppConfig>;
    set(patch: Partial<AppConfig>): Promise<AppConfig>;
    selectWorkspace(): Promise<string | null>;
  };
  shell: {
    openExternal(url: string): Promise<void>;
    openWorkspace(): Promise<void>;
  };
  agent: {
    /** 发起一次 chat（流式）。返回的是一个 channel id，渲染层订阅 'agent:chunk:<id>' 拿增量。 */
    chat(messages: ChatMessage[]): Promise<{ channelId: string }>;
    /** 中断当前 chat。 */
    abort(channelId: string): Promise<void>;
  };
};
