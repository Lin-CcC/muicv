/**
 * main 和 renderer 共用的类型。preload 把同形 API 暴露给 window.muicv。
 */

export type AppConfig = {
  /** 用户工作目录绝对路径，所有 .claude/muicv/ 操作落到这里。 */
  workspaceDir: string | null;
  /**
   * muicv 账号 API key（mui_...）—— 在 muicv.com/dashboard 生成。
   * 桌面端唯一身份凭证：调 muicv API 用它，agent 调 LLM 也走 muicv 的
   * /llm/v1/* 反向代理，由 muicv 后端按用户档位 / BYOK 路由到 muirouter。
   */
  muicvApiKey: string | null;
  /** muicv API base URL，默认 https://api.muicv.com */
  muicvApiBase: string;
  /** 默认模型 id（muirouter 支持的 OpenAI 兼容 model name） */
  defaultModel: string;
};

export const DEFAULT_CONFIG: AppConfig = {
  workspaceDir: null,
  muicvApiKey: null,
  muicvApiBase: 'https://api.muicv.com',
  defaultModel: 'gpt-4o-mini',
};

/**
 * 登录后从 muicv API GET /me 拿到的信息。null 表示未登录 / key 失效。
 */
export type SessionInfo = {
  id: string;
  email: string;
  name: string;
  image: string | null;
  /** 订阅档位（M4 起激活，目前所有人都是 free） */
  plan: 'free' | 'pro' | 'max';
  /** 是否在 dashboard 绑过 muirouter；没绑 LLM 调不通 */
  hasBYOK: boolean;
};

export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

export type ToolCallRecord = {
  id: string;
  name: string;
  input: unknown;
  output?: unknown;
  error?: string;
};

export type ChatMessage = {
  id: string;
  role: ChatRole;
  /** 文本内容（assistant 回复 / 用户输入 / tool result 摘要）。 */
  content: string;
  /** 如果是 assistant 调了 tool，记录工具名和输入。 */
  toolCalls?: ToolCallRecord[];
  createdAt: number;
};

/**
 * main → renderer 通过 'agent:chunk' IPC 转发的事件类型。
 * 包了 OpenAI Agents SDK 的 RunStreamEvent，做扁平化让 renderer 直接消费。
 */
export type AgentChunk =
  /** assistant 文字流增量（model 边输出边给）。 */
  | { type: 'text-delta'; delta: string }
  /** 一段完整 message_output_item 已确认（用于纠错 / 完整文本）。 */
  | { type: 'message-completed'; text: string }
  /** 工具调用开始：name + 输入参数（JSON 字符串） */
  | { type: 'tool-called'; toolCallId: string; toolName: string; argsJson: string }
  /** 工具调用结束：output 字符串（截断 to ~2KB） */
  | { type: 'tool-output'; toolCallId: string; output: string }
  /** 整个 run 结束（reason: 'completed' / 'error' / 'aborted'） */
  | { type: 'finish'; reason: string }
  /** 出错（network / api / parse）。 */
  | { type: 'error'; message: string };

export type SessionCheckResult =
  | { status: 'ok'; session: SessionInfo }
  | { status: 'no-key' }
  | { status: 'invalid-key'; message: string }
  | { status: 'network-error'; message: string };

/** preload 注入到 window.muicv 的 API 形状。 */
export type RendererApi = {
  config: {
    get(): Promise<AppConfig>;
    set(patch: Partial<AppConfig>): Promise<AppConfig>;
    selectWorkspace(): Promise<string | null>;
  };
  session: {
    /** 用当前 muicvApiKey 调 GET /me 验证，结果区分网络错 vs key 无效 */
    check(): Promise<SessionCheckResult>;
    /** 用一个候选 mui_ key 试登录（不写 store；成功后调 login 才存） */
    verify(candidateKey: string): Promise<SessionCheckResult>;
    /** 验证通过后存 mui_ key + 返回 session */
    login(candidateKey: string): Promise<SessionCheckResult>;
    /** 清 mui_ key + 任何缓存的 session */
    logout(): Promise<void>;
    /**
     * OAuth-style 自动登录：main 进程生成随机 state，记到内存里，
     * 打开浏览器 https://muicv.com/connect?state=...&redirect=muicv://callback。
     * 用户在网页授权后会通过 muicv:// scheme 唤起 app，main 验证 state 后
     * 自动 loginWithKey + 推送 session:autoLogin 事件给 renderer。
     */
    beginConnect(): Promise<{ ok: boolean; message?: string }>;
    /** 订阅自动登录结果（成功 / 失败）。返回 unsubscribe。 */
    onAutoLogin(handler: (result: SessionCheckResult) => void): () => void;
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
