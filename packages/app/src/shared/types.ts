/**
 * main 和 renderer 共用的类型。preload 把同形 API 暴露给 window.muicv。
 */

import { DEFAULT_LLM_MODEL } from '@muicv/shared';

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
  defaultModel: DEFAULT_LLM_MODEL,
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
  /**
   * 订阅档位。server 根据 subscription.stripePriceId + status 推导。
   * 老 server 可能没补这个字段；client 兜底当 'free'。
   */
  plan?: 'free' | 'pro' | 'max';
  /** 当前 token 余额（显示 token；server 已 microToDisplay 过）。可能是小数。 */
  balance: number;
  /** 是否在 dashboard 绑过 muirouter；muicv 余额耗尽且 hasBYOK=false 时 LLM 调不通 */
  hasBYOK: boolean;
  /** muirouter 绑定的快照——dashboard 改了模型 / 余额变化都在这里反映。null 表示未绑定。 */
  muirouter: MuirouterInfo | null;
};

/** /api/me 返回的 muirouter 字段。来自 D1 muirouterLink 表，dashboard / app 共享同一份。 */
export type MuirouterInfo = {
  email: string | null;
  defaultModel: string;
  currency: string | null;
  balanceCents: number | null;
  /** balance 快照更新时间，Unix ms。 */
  balanceUpdatedAt: number | null;
};

/**
 * `muirouter:linked` 事件 payload —— main 进程把 deep-link 校验结果推给 renderer。
 *
 * 'ok'：服务端已写入 muirouterLink，renderer 应当重拉 /api/me 同步状态。
 * 'state-mismatch'：深链 app_state 跟内存 pending 不匹配（过期 / CSRF 失败）。
 * 'failed'：服务端汇报失败（用户拒绝授权 / token 端点错），reason 是错误码。
 */
export type MuirouterLinkResult =
  | { status: 'ok' }
  | { status: 'state-mismatch' }
  | { status: 'failed'; reason: string };

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
  /** assistant 完成时附带的 artifact 卡片（用户写的文件 / 读的关键资料）。 */
  artifacts?: ArtifactRef[];
  createdAt: number;
};

/**
 * 对话类型：每种类型对应一个主线 skill。新建对话时选类型，
 * agent 拿到 focusType 后在 system prompt 里加一句"本次主线是 X"，
 * 让 agent 优先按对应 skill 的章节工作。所有 skill 仍然全量加载，
 * 类型只决定侧重，不锁工具。
 */
export type ConversationType =
  | 'core' // 记录职业生涯（素材整理）—— muicv-core
  | 'generate' // 针对岗位生成简历 —— muicv-generate
  | 'critique' // 简历评审 —— muicv-critique
  | 'jobs' // JD 抓取与匹配 —— muicv-jobs
  | 'interview' // 模拟面试 —— muicv-interview
  | 'coaching'; // 就业辅导 —— muicv-coaching

export const CONVERSATION_TYPE_META: Record<
  ConversationType,
  { label: string; emoji: string; tagline: string; placeholder: string }
> = {
  core: {
    label: '记录职业生涯',
    emoji: '📝',
    tagline: '记录工作经历、项目、技能、亮点',
    placeholder: '比如：「我 2023 年在 ACME 做高级前端，做了 X 项目，业务量提升 30%」',
  },
  generate: {
    label: '针对岗位生成简历',
    emoji: '📄',
    tagline: '基于素材库，生成适合特定 JD 的简历版本',
    placeholder: '比如：「针对 Google L5 的岗位生成一份简历」',
  },
  critique: {
    label: '简历评审',
    emoji: '🔍',
    tagline: 'STAR 结构、量化、关键词、长度全方位检查',
    placeholder: '比如：「评审我最近生成的 google-l5 简历」',
  },
  jobs: {
    label: 'JD 抓取与匹配',
    emoji: '🎯',
    tagline: '从招聘链接抓 JD，分析与你素材的匹配度',
    placeholder: '比如：粘一个招聘链接，或者「分析一下 openai-swe 这个岗位」',
  },
  interview: {
    label: '模拟面试',
    emoji: '🎤',
    tagline: '行为题 / 技术题角色扮演 + 反馈',
    placeholder: '比如：「针对 google-l5 模拟一轮 behavioral 面试」',
  },
  coaching: {
    label: '就业辅导',
    emoji: '🧭',
    tagline: '职业方向、薪资协商、跳槽时机等',
    placeholder: '比如：「我现在该不该跳槽？」',
  },
};

/** 工件类型 —— renderer 拿到 artifact chunk 后按 kind 选 icon / 文案。 */
export type ArtifactKind =
  | 'profile'
  | 'experience'
  | 'project'
  | 'jd-target'
  | 'resume-version'
  | 'critique-report'
  | 'cover-letter'
  | 'other';

/** 一次工件引用 —— 路径 + 类型 + 标题（标题给卡片显示用，path 是绝对路径或相对于 workspace 的路径）。 */
export type ArtifactRef = {
  kind: ArtifactKind;
  /** 绝对路径，方便右栏直接 fs.read。 */
  path: string;
  /** 显示用文件名（basename）。 */
  title: string;
  /**
   * 这次 artifact 是 agent 读出来的参考资料（read_file）还是写出来的产物
   * （write_file / edit_file / render_resume_pdf / fetch_jd）。
   * read 类是过程信息（折叠到工具调用组里），write 类是产物（显眼卡片
   * + 自动打开右栏预览）。
   */
  source: 'read' | 'write';
};

/** 一份对话的元数据 + 消息历史。持久化到 <profile.dir>/.claude/muicv/conversations/<id>.json。 */
export type Conversation = {
  id: string;
  profileId: string;
  type: ConversationType;
  /** 用户改 / 默认按类型 + 创建日期生成。 */
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
};

/** 列表用的轻量 summary（不含 messages，省 IO）。 */
export type ConversationSummary = Omit<Conversation, 'messages'> & {
  messageCount: number;
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
  | { type: 'error'; message: string }
  /**
   * Agent 调 read/write_file 落到约定路径时（versions/* / targets/* / applications/*），
   * runtime 主动推一个 artifact chunk，renderer 在消息流里渲染卡片，
   * 点卡片或后续 agent 再访问该路径都会切右栏到这个文件。
   * source: read（过程参考）/ write（最终产物，会自动开右栏）。
   */
  | { type: 'artifact'; kind: ArtifactKind; path: string; title: string; source: 'read' | 'write' };

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
    /**
     * OAuth-style muirouter 关联：main 生成 app_state，打开浏览器到
     * /api/muirouter/oauth/start?from=app&app_state=...。muicv 服务端透传到 muirouter，
     * 授权完成后服务端 302 到 muicv://muirouter-linked，main 校验后推
     * `muirouter:linked` 事件。renderer 收到后应重拉 /api/me 获取最新状态。
     */
    beginLinkMuirouter(): Promise<{ ok: boolean; message?: string }>;
    /** 订阅 muirouter 关联结果（成功 / state 失配 / 服务端失败）。返回 unsubscribe。 */
    onMuirouterLinked(handler: (result: MuirouterLinkResult) => void): () => void;
  };
  shell: {
    openExternal(url: string): Promise<void>;
    openWorkspace(): Promise<void>;
  };
  app: {
    /** Electron app.getVersion()，用于在设置页 footer 显示版本号方便排查问题。 */
    getVersion(): Promise<string>;
  };
  agent: {
    /**
     * 发起一次 chat（流式）。
     *
     * conv: 关联的 conversation —— runtime 用 conv.type 选 focus skill，
     * 用 conv.id + profileId 在 finish 后 flush 整份对话到磁盘。
     * messages 是当前对话的全部历史 + 刚 push 的 user msg。
     *
     * 返回 channelId，渲染层订阅 'muicv:agent:chunk:<id>' 拿增量。
     */
    chat(opts: {
      profileId: string;
      convId: string;
      type: ConversationType;
      messages: ChatMessage[];
    }): Promise<{ channelId: string }>;
    /** 中断当前 chat。 */
    abort(channelId: string): Promise<void>;
  };
  conversation: {
    /** 列出当前 profile 下所有对话（不含 messages，按 updatedAt 倒序）。 */
    list(profileId: string): Promise<ConversationSummary[]>;
    /** 加载一份对话（含 messages）。 */
    get(profileId: string, convId: string): Promise<Conversation | null>;
    /** 新建。type 决定默认 title 和 system prompt focus。 */
    create(opts: { profileId: string; type: ConversationType; title?: string }): Promise<Conversation>;
    rename(profileId: string, convId: string, title: string): Promise<void>;
    remove(profileId: string, convId: string): Promise<void>;
  };
  fs: {
    /** 读一个文件（utf8）。给右栏文件预览用。失败返回 null。 */
    read(path: string): Promise<string | null>;
    /** 列目录（仅当前 workspace 内）。返回 null = 路径越界 / 读不到。 */
    listDir(path: string): Promise<Array<{ name: string; path: string; isDirectory: boolean }> | null>;
    /** 在文件管理器里打开。 */
    showInFolder(path: string): Promise<void>;
  };
};
