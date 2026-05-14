import type { WebContents } from 'electron';

import { Agent, run, setDefaultOpenAIClient, setDefaultOpenAIKey, setOpenAIAPI } from '@openai/agents';
import OpenAI from 'openai';

import { randomUUID } from 'node:crypto';

import { modelSupportsVision } from '@muicv/shared';

import type { AgentChunk, AppConfig, ChatMessage, ConversationType, ToolCallRecord } from '../../shared/types.ts';
import { getConversation, saveConversation } from '../conversations.ts';
import { buildSttTools } from './api-tools-stt.ts';
import { buildSyncTools } from './api-tools-sync.ts';
import { buildApiTools } from './api-tools.ts';
import { buildAgentInput, getModelBudget } from './history.ts';
import { readImageAsDataUrl } from './multimodal.ts';
import { buildSystemPrompt } from './skills.ts';
import { type ArtifactEmitter, buildFileTools } from './tools.ts';

/**
 * 配置 OpenAI Agents SDK 全局 client，让它走 muicv API 的 OpenAI 兼容代理：
 *
 *   electron → POST ${muicvApiBase}/llm/v1/chat/completions
 *           Authorization: Bearer mui_xxx
 *      muicv worker requireApiKey → 查 muirouterLink → 替换 Authorization
 *           为用户的 sk-gw-xxx → 转发到 https://api.muirouter.com/v1
 *
 * 这样：
 *   - 桌面 app 只需要 mui_ key 一个凭证
 *   - LLM 调用统一被 muicv 后端审计 / 计费 / 路由
 *   - 用户付费档位 (Free/Pro/Max) + BYOK 状态完全由 muicv 后端控制，
 *     电脑端不需要知道
 */
let configuredKey: string | null = null;
let configuredBase: string | null = null;

/**
 * 决定这次 run 用谁的 endpoint：
 *
 *   1. 如果用户配了自带的 LLM endpoint + key（customLlmBase / customLlmKey），
 *      直接打那个 endpoint —— "自带 AI 余额"模式，跳过 muicv 平台代理。
 *   2. 否则走 muicv 平台代理（${muicvApiBase}/llm/v1），由 muicv 后端按账号
 *      档位 / muirouter BYOK 路由。
 *
 * 没 key 也没自带 endpoint = 不能用，返回 false。
 */
function ensureConfigured(config: AppConfig): boolean {
  let baseURL: string;
  let apiKey: string;

  if (config.customLlmKey && config.customLlmBase) {
    baseURL = config.customLlmBase.replace(/\/$/, '');
    apiKey = config.customLlmKey;
  } else if (config.muicvApiKey) {
    baseURL = `${config.muicvApiBase.replace(/\/$/, '')}/llm/v1`;
    apiKey = config.muicvApiKey;
  } else {
    return false;
  }

  if (configuredKey === apiKey && configuredBase === baseURL) return true;
  setOpenAIAPI('chat_completions');
  setDefaultOpenAIKey(apiKey);
  setDefaultOpenAIClient(new OpenAI({ apiKey, baseURL, fetch: loggingFetch }));
  configuredKey = apiKey;
  configuredBase = baseURL;
  return true;
}

/**
 * thinking-mode 推理模型（mimo / DeepSeek 系）在多轮 tool calling 时要求**每一条带
 * tool_calls 的 assistant message** 都要伴随 reasoning_content；OpenAI Agents SDK
 * 走 chat_completions 时不识别这个非标准字段会直接丢掉 → 400 `Param Incorrect`。
 *
 *   Response 侧：thinking-mode streaming response → body.tee() 后台读 SSE，
 *                每轮累计 delta.reasoning_content 推入 reasoningQueue 末尾
 *   Request 侧：thinking-mode 下次请求出去前，遍历 body.messages 里所有 assistant
 *                从队尾对齐注入（FIFO：reasoningQueue[0] → 倒数第 queue.length 条）
 *
 * 触发条件：`isThinkingModeModel(modelId)` 白名单（当前 mimo-* / deepseek-*）。
 * 新增 thinking-mode 模型时把前缀加进去即可——本来就要在 pricing.ts 的
 * LLM_DISPLAY_META 里登记新模型，顺手维护这一处零成本，避免对 GPT 请求做无用的
 * tee + SSE 解析。
 *
 * 并发假设：SDK 在一次 run() 内严格串行调用 fetch（等 stream 流完 + tool 跑完
 * 才发下一轮），队列推入和读取不会并发。每次 runAgent 起点调
 * `resetReasoningState()` 清队列，避免跨 run 残留。
 *
 * 上游参考：https://github.com/openai/openai-agents-js/pull/792（DeepSeek 同款问题，
 * 但仅在 agents-extensions 的 aisdk 路径修，chat_completions 路径未修——若哪天
 * 上游覆盖了，可以删掉这层）。
 */
type ReasoningCapture = { model: string; content: string };
let reasoningQueue: ReasoningCapture[] = [];

/**
 * 实时 reasoning_content delta 监听器。runAgent 启动时设置（转发到 send），
 * 结束时清空。模块级单 slot：依赖 SDK 单 run 内串行——多 channel 并发场景里
 * 可能串台，但当前架构用户不会同时跑两个 agent。
 */
let reasoningDeltaListener: ((delta: string) => void) | null = null;

/** runAgent 调用前清队列，避免上一轮 run 的 reasoning 错位注入本轮 assistant。 */
function resetReasoningState(): void {
  reasoningQueue = [];
}

function setReasoningDeltaListener(fn: ((delta: string) => void) | null): void {
  reasoningDeltaListener = fn;
}

/**
 * 是否是带 thinking mode 的推理模型——同时控制两件事：
 *   1. reasoning_content 透传层是否启用（tap streaming + inject 到 messages）
 *   2. watchdog timeout 长度（thinking 模型 120s vs 普通 30s）
 *
 * 新增 thinking 模型时把前缀加这里——本来就要登记到 pricing.ts 的 LLM_DISPLAY_META，
 * 顺手改一行零成本。
 */
function isThinkingModeModel(modelId: unknown): modelId is string {
  if (typeof modelId !== 'string') return false;
  return modelId.startsWith('mimo-') || modelId.startsWith('deepseek-');
}

/**
 * OpenAI SDK 自定义 fetch wrapper，承担两件事：
 *   1. non-ok 响应时打印完整 body + 请求摘要（mimo / muirouter 经常返回 400
 *      "Param Incorrect" 之类语义稀薄的错误，没这层日志根本看不出哪个 param 不对）
 *   2. thinking-mode reasoning_content 双向透传（见 reasoningQueue 注释）
 *
 * 注意：req body 可能含敏感内容（用户对话原文），日志只截 1.5KB 摘要。
 */
async function loggingFetch(input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> {
  // Request 侧：队列非空 → 从队尾对齐注入到 body.messages 末尾 N 条 assistant
  // body.messages 里 assistant 分两类：
  //   - 历史完成态：从持久化 ChatMessage[] 经 history.toItem 重建，无 tool_calls，不要求 reasoning
  //   - 本轮新生成：SDK 在 run() 内部按 turn 累计，有 tool_calls，强制要求 reasoning
  // 队列长度 = 本轮已完成的 turn 数 = 末尾 N 条新 assistant。从队尾对齐：
  //   reasoningQueue[0] → 倒数第 queue.length 条 assistant
  //   reasoningQueue[i] → 倒数第 (queue.length - i) 条 assistant
  let mutatedInit = init;
  if (init?.body && typeof init.body === 'string' && reasoningQueue.length > 0) {
    try {
      const body = JSON.parse(init.body);
      if (isThinkingModeModel(body.model) && Array.isArray(body.messages)) {
        const assistantIndices: number[] = [];
        for (let i = 0; i < body.messages.length; i++) {
          const msg = body.messages[i];
          if (msg && typeof msg === 'object' && msg.role === 'assistant') assistantIndices.push(i);
        }
        const offset = assistantIndices.length - reasoningQueue.length;
        let injected = 0;
        if (offset >= 0) {
          for (let i = 0; i < reasoningQueue.length; i++) {
            const slot = reasoningQueue[i];
            if (!slot || slot.model !== body.model) continue;
            const target = assistantIndices[offset + i];
            if (target == null) continue;
            (body.messages[target] as Record<string, unknown>).reasoning_content = slot.content;
            injected++;
          }
        }
        if (injected > 0) {
          mutatedInit = { ...init, body: JSON.stringify(body) };
        }
      }
    } catch {
      /* 非 JSON body 不动 */
    }
  }

  const res = await fetch(input, mutatedInit);

  if (!res.ok) {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const cloned = res.clone();
    const body = await cloned.text().catch(() => '<read body failed>');
    const reqBody = typeof mutatedInit?.body === 'string' ? mutatedInit.body.slice(0, 1500) : '<non-string body>';
    console.error(
      `[OpenAI fetch] ${res.status} ${res.statusText} ${url}\n  resp body: ${body.slice(0, 2000)}\n  req body (≤1500): ${reqBody}`,
    );
  }

  // Response 侧：thinking-mode streaming 响应 → tee 一份流到后台 tap 抓
  // delta.reasoning_content。仅对 isThinkingModeModel 触发，避免给 GPT 这类
  // 没 reasoning_content 字段的模型做无用的 tee + JSON.parse。
  const reqModel = extractModelFromRequestBody(mutatedInit?.body);
  const isStream = res.ok && !!res.body && (res.headers.get('content-type') ?? '').includes('text/event-stream');
  if (isStream && isThinkingModeModel(reqModel)) {
    const [streamForSDK, streamForUs] = res.body!.tee();
    tapReasoningStream(streamForUs, reqModel).catch((err) => {
      console.warn('[reasoning tap] failed:', err);
    });
    return new Response(streamForSDK, {
      status: res.status,
      statusText: res.statusText,
      headers: res.headers,
    });
  }

  return res;
}

function extractModelFromRequestBody(body: unknown): string | null {
  if (typeof body !== 'string') return null;
  try {
    const parsed = JSON.parse(body) as { model?: unknown };
    return typeof parsed.model === 'string' ? parsed.model : null;
  } catch {
    return null;
  }
}

/**
 * 后台读 SSE stream，按 OpenAI streaming 格式逐 chunk 解析，累计
 * `choices[0].delta.reasoning_content`，整段存到 pendingReasoning。
 *
 * SDK 在同一 run 内严格串行（等本轮 stream 完 + tool 跑完才发下一轮），
 * 所以 tap 一定在下一轮 request 前完成，缓存写入有 happens-before 保证。
 */
async function tapReasoningStream(stream: ReadableStream<Uint8Array>, model: string): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let acc = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf('\n\n')) !== -1) {
        const event = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        for (const line of event.split('\n')) {
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;
          try {
            const json = JSON.parse(payload) as { choices?: Array<{ delta?: Record<string, unknown> }> };
            const rc = json.choices?.[0]?.delta?.reasoning_content;
            if (typeof rc === 'string' && rc.length > 0) {
              acc += rc;
              reasoningDeltaListener?.(rc);
            }
          } catch {
            /* 半包 / 非 JSON 行忽略 */
          }
        }
      }
    }
    if (acc) reasoningQueue.push({ model, content: acc });
  } finally {
    reader.releaseLock();
  }
}

const activeRuns = new Map<string, AbortController>();

type RunOpts = {
  channelId: string;
  profileId: string;
  convId: string;
  type: ConversationType;
  messages: ChatMessage[];
  config: AppConfig;
  sender: WebContents;
};

/**
 * 启动一次 agent 流式 run。每个 chunk 通过 sender.send('agent:chunk', channelId, payload)
 * 转发到 renderer。run 结束时把整份 conversation flush 到磁盘。
 */
export async function runAgent(opts: RunOpts): Promise<void> {
  const { channelId, profileId, convId, type, messages, config, sender } = opts;

  const send = (chunk: AgentChunk) => {
    if (!sender.isDestroyed()) sender.send('agent:chunk', channelId, chunk);
  };

  if (!config.workspaceDir) {
    send({ type: 'error', message: 'NO_PROFILE' });
    send({ type: 'finish', reason: 'error' });
    return;
  }
  const workspaceDir = config.workspaceDir;
  if (!ensureConfigured(config)) {
    send({ type: 'error', message: 'NOT_LOGGED_IN' });
    send({ type: 'finish', reason: 'error' });
    return;
  }
  // 清掉上一轮 run 残留的 reasoning 队列，避免序号错位注入本轮 assistant
  resetReasoningState();
  // 把推理过程实时转发给 renderer，让 UI 展示真正的"思考中"内容而不是静态提示
  // 仅 thinking-mode 模型实际会触发，普通模型 stream 里没 reasoning_content 字段
  setReasoningDeltaListener((delta) => send({ type: 'reasoning-delta', delta }));

  // artifact 收集：tool 调用过程中累计 artifact，完成后塞进 assistant message
  const collectedArtifacts: Array<import('../../shared/types.ts').ArtifactRef> = [];
  const emitArtifact: ArtifactEmitter = (a) => {
    collectedArtifacts.push(a);
    send({ type: 'artifact', ...a });
  };

  const tools = [
    ...buildFileTools(config.workspaceDir, emitArtifact),
    ...buildApiTools(config, emitArtifact),
    ...buildSyncTools(config),
    ...buildSttTools(config, sender),
  ];
  const agent = new Agent({
    name: 'Mui简历',
    instructions: buildSystemPrompt(type),
    model: config.defaultModel,
    tools,
  });

  const lastUser = messages[messages.length - 1];
  if (!lastUser || lastUser.role !== 'user') {
    send({ type: 'error', message: '内部错误：最后一条消息不是 user' });
    send({ type: 'finish', reason: 'error' });
    return;
  }

  // 前置落盘 user msg：dev 重启 / 主进程崩 / 网络挂在 stream 中段时，
  // 至少保住用户刚敲的这条；flushConversation 末尾按 id 幂等不会重复 push。
  try {
    const convNow = await getConversation(profileId, convId);
    if (convNow) {
      const tail = convNow.messages[convNow.messages.length - 1];
      if (tail?.id !== lastUser.id) {
        convNow.messages.push(lastUser);
        await saveConversation(convNow);
      }
    }
  } catch (err) {
    console.error('[agent runtime] persist user msg failed', err);
  }

  // Vision 能力分支：模型路由到的 endpoint 不收图（如 mimo 系走 muirouter →
  // OpenRouter 没勾 image capability，见 issue #7）时，**不再硬错**——v0.4.x 起
  // 图片有第二种用途（upload_photo agent tool 上传证件照到 R2），不需要 vision。
  // 仅在 model 支持 vision 时把图 base64 进 input_image；不支持就跳过 imageReader，
  // 让 footer 的"调 upload_photo"提示引导 agent 走 R2 上传路径。
  const supportsVision = modelSupportsVision(config.defaultModel);

  // 把历史按 SDK 原生 AgentInputItem[] 组装，并按 token budget 做滑动窗口裁剪。
  // 历史里所有 user message 的图都重新 base64 进 input_image content block——
  // Claude Code 模式：每轮带全部历史图，靠底层 LLM 的 prompt cache 抵成本。
  // 见 history.ts 的 buildAgentInput 注释。
  const {
    items: input,
    droppedCount,
    estimatedTokens,
  } = await buildAgentInput(messages, {
    budgetTokens: getModelBudget(config.defaultModel),
    ...(supportsVision ? { imageReader: (ref) => readImageAsDataUrl(workspaceDir, ref) } : {}),
  });
  if (droppedCount > 0) {
    console.log(
      `[agent runtime] context trimmed: dropped ${droppedCount} oldest messages, ~${estimatedTokens} tokens kept`,
    );
  }

  const abort = new AbortController();
  activeRuns.set(channelId, abort);

  // 提到 try 外面，让 error / abort 路径也能拿到部分输出存盘
  let assistantText = '';
  const assistantToolCalls: ToolCallRecord[] = [];

  // 空转看门狗：如果 stream open 后 N 秒内没收到任何 event（mimo / 第三方代理偶发
  // silent hang），主动 abort 并报错，避免 UI 永远卡在"思考中"。任何 event 到达
  // 就 reset 计时。
  //   - 普通模型 30s（GPT 经 muirouter 冷启动通常 8-15s，留 2 倍 headroom）
  //   - thinking-mode 模型（mimo / DeepSeek 系）给 120s——multi-turn 深度推理时
  //     模型可能 30+s 才出第一个 chunk；SDK 在 reasoning 阶段不一定 yield event，
  //     所以哪怕底层 SSE 在流也可能看起来"空转"。
  const STREAM_IDLE_TIMEOUT_MS = isThinkingModeModel(config.defaultModel) ? 120_000 : 30_000;
  let lastEventAt = Date.now();
  let timedOut = false;
  const watchdog = setInterval(() => {
    if (Date.now() - lastEventAt > STREAM_IDLE_TIMEOUT_MS) {
      timedOut = true;
      console.warn(`[agent runtime] stream silent > ${STREAM_IDLE_TIMEOUT_MS}ms, aborting`);
      abort.abort();
    }
  }, 5_000);

  try {
    console.log(
      `[agent runtime] starting run with model=${config.defaultModel}, items=${input.length}, est=${estimatedTokens}t`,
    );
    const stream = await run(agent, input, {
      stream: true,
      signal: abort.signal,
      maxTurns: 30,
    });

    // assistantText / assistantToolCalls 已在 try 外定义；这里不再 redeclare
    for await (const event of stream) {
      lastEventAt = Date.now();
      if (event.type === 'raw_model_stream_event') {
        const data = event.data as unknown as { type?: string; delta?: string; text?: string };
        if (data?.type && /text.*delta/i.test(data.type) && typeof data.delta === 'string') {
          assistantText += data.delta;
          send({ type: 'text-delta', delta: data.delta });
        }
      } else if (event.type === 'run_item_stream_event') {
        const item = event.item as unknown as { type?: string; rawItem?: Record<string, unknown>; output?: unknown };
        if (event.name === 'tool_called' && item.type === 'tool_call_item') {
          const raw = item.rawItem ?? {};
          const toolCallId = String(raw.callId ?? raw.id ?? cryptoRandomShort());
          const toolName = String(raw.name ?? 'tool');
          let argsJson = '{}';
          try {
            argsJson = typeof raw.arguments === 'string' ? raw.arguments : JSON.stringify(raw.arguments ?? {});
          } catch {
            /* keep default */
          }
          let parsedInput: unknown;
          try {
            parsedInput = JSON.parse(argsJson);
          } catch {
            parsedInput = argsJson;
          }
          assistantToolCalls.push({ id: toolCallId, name: toolName, input: parsedInput });
          send({ type: 'tool-called', toolCallId, toolName, argsJson });
        } else if (event.name === 'tool_output' && item.type === 'tool_call_output_item') {
          const raw = item.rawItem ?? {};
          const toolCallId = String(raw.callId ?? raw.id ?? '');
          const output = typeof item.output === 'string' ? item.output : JSON.stringify(item.output ?? '');
          // 写回 toolCalls 数组里对应那条
          const tc = assistantToolCalls.find((c) => c.id === toolCallId);
          if (tc) tc.output = output.slice(0, 2048);
          send({ type: 'tool-output', toolCallId, output: output.slice(0, 2048) });
        } else if (event.name === 'message_output_created' && item.type === 'message_output_item') {
          const raw = item.rawItem ?? {};
          const content = raw.content as Array<{ type?: string; text?: string }> | undefined;
          const text = Array.isArray(content)
            ? content
                .filter((c) => c?.type === 'output_text' || c?.type === 'text')
                .map((c) => c?.text ?? '')
                .join('')
            : '';
          if (text) send({ type: 'message-completed', text });
        }
      }
    }

    await stream.completed;
    await flushConversation();
    send({ type: 'finish', reason: 'completed' });
  } catch (error) {
    const aborted = abort.signal.aborted;
    // error / abort 路径也保存已累积的部分，否则用户体感"全丢了"
    try {
      await flushConversation();
    } catch {
      /* 存盘失败不再二次报错 */
    }
    if (aborted && !timedOut) {
      send({ type: 'finish', reason: 'aborted' });
    } else if (timedOut) {
      send({
        type: 'error',
        message: `模型 ${config.defaultModel} 超过 ${STREAM_IDLE_TIMEOUT_MS / 1000}s 无响应，已中断。可能 endpoint 卡住或不支持本轮输入。看 electron-vite 终端日志查具体原因。`,
      });
      send({ type: 'finish', reason: 'error' });
    } else {
      // OpenAI SDK 经常把 fetch 失败包成 "Connection error."，真实原因藏在 .cause
      // 把 cause 链全打到主进程 console + 一并传给 renderer，方便定位
      const cause = (error as { cause?: unknown })?.cause;
      const causeMsg =
        cause instanceof Error ? `${cause.name}: ${cause.message}` : cause !== undefined ? String(cause) : '';
      console.error('[agent runtime] error:', error);
      if (cause !== undefined) console.error('[agent runtime] error.cause:', cause);
      const baseMsg = error instanceof Error ? error.message : String(error);
      const rawMsg = causeMsg ? `${baseMsg} (cause: ${causeMsg})` : baseMsg;
      const msg = isContextLengthError(rawMsg)
        ? '本次对话历史超出模型上下文长度。已尝试自动裁剪，仍超出的话请新开一个对话。'
        : isReasoningContentError(error, rawMsg)
          ? `当前模型「${config.defaultModel}」是带 thinking mode 的推理模型，多轮工具调用时要求回传 reasoning_content 字段，与 OpenAI Agents SDK 不兼容。请到设置切换到 GPT 系列（gpt-5.5 / gpt-5.4）。`
          : rawMsg;
      send({ type: 'error', message: msg });
      send({ type: 'finish', reason: 'error' });
    }
  } finally {
    clearInterval(watchdog);
    activeRuns.delete(channelId);
    setReasoningDeltaListener(null);
  }

  /** 把本轮 user msg + 累积的 assistant msg 追加到 conversation 文件。 */
  async function flushConversation(): Promise<void> {
    if (!lastUser) return;
    const conv = await getConversation(profileId, convId);
    if (!conv) return;
    // 防重复 push：极端 race 下可能 user msg 已经在里面
    const lastConv = conv.messages[conv.messages.length - 1];
    if (lastConv?.id !== lastUser.id) {
      conv.messages.push(lastUser);
    }
    const assistantMsg: ChatMessage = {
      id: randomUUID(),
      role: 'assistant',
      content: assistantText,
      createdAt: Date.now(),
    };
    if (assistantToolCalls.length > 0) assistantMsg.toolCalls = assistantToolCalls;
    if (collectedArtifacts.length > 0) assistantMsg.artifacts = collectedArtifacts;
    conv.messages.push(assistantMsg);
    await saveConversation(conv);
  }
}

export function abortRun(channelId: string): void {
  const ctrl = activeRuns.get(channelId);
  if (ctrl) ctrl.abort();
}

function cryptoRandomShort(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * 判断 OpenAI / 兼容 endpoint 抛出的错误是否属于 context length 溢出。
 * OpenAI 的标准 code 是 'context_length_exceeded'；兜底也匹配中英文常见措辞。
 */
function isContextLengthError(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes('context_length_exceeded') ||
    lower.includes('maximum context length') ||
    lower.includes('context length') ||
    lower.includes('too many tokens')
  );
}

/**
 * mimo / DeepSeek 等"thinking mode 推理模型"在多轮 tool calling 时要求
 * 把上一轮 assistant 消息的 reasoning_content 字段回传，否则 400。
 * OpenAI Agents SDK 不知道这个私有字段会把它丢掉 → 第二轮调用挂掉。
 *
 * mimo 的 400 响应：
 *   { error: { message: "Param Incorrect", param: "The reasoning_content in
 *              the thinking mode must be passed back to the API." } }
 * OpenAI SDK 把 message 当 baseMsg、把整个 body.error 挂到 (err as APIError).error。
 * 必须同时检测 message **和** error.param，否则 baseMsg 只有 "Param Incorrect"
 * 检测漏掉。
 */
function isReasoningContentError(error: unknown, msg: string): boolean {
  if (msg.toLowerCase().includes('reasoning_content')) return true;
  if (msg.toLowerCase().includes('thinking mode')) return true;
  const e = error as { error?: { param?: unknown; message?: unknown } };
  const param = typeof e?.error?.param === 'string' ? e.error.param.toLowerCase() : '';
  if (param.includes('reasoning_content') || param.includes('thinking mode')) return true;
  return false;
}
