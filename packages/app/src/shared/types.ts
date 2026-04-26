/**
 * main 和 renderer 共用的类型。preload 把同形 API 暴露给 window.muicv。
 */

/**
 * 一份"简历"的元数据。每份 profile 对应硬盘上的一个独立资料夹，
 * 里面 .claude/muicv/ 是真实素材库。同一账号支持多份 profile，
 * 解决"夫妻共用账号"、"求职 / 跳槽两套素材"等场景。
 */
export type Profile = {
  id: string;
  /** 用户给的名字，例如 "默认"、"求职 2026"、"老婆的"。 */
  name: string;
  /** 资料夹绝对路径。 */
  dir: string;
  /** 创建时间（unix ms）。 */
  createdAt: number;
};

export type AppConfig = {
  /** 当前用户已创建的所有 profile。空数组 = 还没初始化（首次登录会自动建一份默认）。 */
  profiles: Profile[];
  /** 当前激活的 profile id；null = 还没激活任何 profile。 */
  activeProfileId: string | null;
  /**
   * 当前激活 profile 的资料夹绝对路径（由 main 进程根据 activeProfileId 推导出来）。
   * 给 agent runtime / 老代码用的派生字段，本身不可写。
   */
  workspaceDir: string | null;
  /** muicv 账号 API key（mui_...）。桌面端唯一身份凭证。 */
  muicvApiKey: string | null;
  /** muicv API base URL（高级配置）。 */
  muicvApiBase: string;
  /** 默认模型 id。 */
  defaultModel: string;
  /**
   * 用户自带 LLM endpoint（OpenAI 兼容）。例如：
   *   - https://api.openai.com/v1
   *   - https://api.muirouter.com/v1
   *   - 自部署 llama.cpp / ollama 等
   * 留空 = 走 muicv 平台代理（默认）。
   */
  customLlmBase: string | null;
  /** 自带 LLM endpoint 的 API key。和 customLlmBase 配套使用。 */
  customLlmKey: string | null;
};

export const DEFAULT_CONFIG: AppConfig = {
  profiles: [],
  activeProfileId: null,
  workspaceDir: null,
  muicvApiKey: null,
  muicvApiBase: 'https://api.muicv.com',
  defaultModel: 'gpt-4o-mini',
  customLlmBase: null,
  customLlmKey: null,
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
    set(
      patch: Partial<
        Pick<AppConfig, 'muicvApiBase' | 'defaultModel' | 'muicvApiKey' | 'customLlmBase' | 'customLlmKey'>
      >,
    ): Promise<AppConfig>;
  };
  profile: {
    /** 创建一份新的 profile。如果不传 dir 会让用户挑（dialog）；传了就用那个目录。 */
    create(opts: { name: string; dir?: string }): Promise<{ ok: boolean; profile?: Profile; message?: string }>;
    /** 让 main 进程在 ~/Documents/Mui简历/<name> 下自动建一个目录并创建 profile。 */
    createInDocuments(name: string): Promise<{ ok: boolean; profile?: Profile; message?: string }>;
    /** 让用户选目录后，把它挂成一份 profile。dialog 取消则返回 ok:false。 */
    pickFolder(name: string): Promise<{ ok: boolean; profile?: Profile; message?: string }>;
    /** 切换激活 profile。 */
    switchTo(id: string): Promise<AppConfig>;
    /** 重命名（只改 metadata，不动磁盘）。 */
    rename(id: string, name: string): Promise<AppConfig>;
    /** 从 app 里移除（不删盘上文件）；如果是激活的，会切到列表里下一个。 */
    remove(id: string): Promise<AppConfig>;
    /** 在文件管理器里打开某个 profile 的目录。 */
    openInFinder(id: string): Promise<void>;
    /** 登录后调一次：如果还没任何 profile，就在 ~/Documents/Mui简历/默认/ 自动建一份。 */
    ensureDefault(): Promise<AppConfig>;
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
