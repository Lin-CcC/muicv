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
 * mimo / DeepSeek 系 thinking-mode 模型在多轮 tool calling 时要求把上一轮
 * assistant 响应的 reasoning_content 字段回传，OpenAI Agents SDK 走 chat_completions
 * 路径时不知道这个非标准字段会直接丢掉 → mimo 400。上游修复只在 agents-extensions
 * 的 aisdk() 路径，且 gate 写死 isDeepSeekModel；我们在 fetch 层自己拦截：
 *
 *   Response 侧：检测 mimo streaming 响应，tee 出一份 SSE 流，后台累计
 *               delta.reasoning_content 存到 pendingReasoning 单 slot 缓存。
 *   Request 侧：下次 mimo 请求出去前，把缓存的 reasoning_content 注入到
 *               body.messages 最后一条 assistant 上，然后清空缓存。
 *
 * 并发假设：@openai/agents 在一次 run() 内严格串行调用 fetch（每轮等 stream
 * 流完 + tool 跑完才发下一轮），单 slot 不会被并发覆盖。跨 run 残留也无害——
 * 下次 request 注入后立即清空，且新 run 第一轮 messages 里没有 in-flight
 * assistant，注入循环找不到目标自然跳过。
 *
 * 上游参考：https://github.com/openai/openai-agents-js/pull/792（DeepSeek 同款问题）。
 */
let pendingReasoning: { model: string; content: string } | null = null;

function isMimoModel(modelId: unknown): modelId is string {
  return typeof modelId === 'string' && modelId.startsWith('mimo-');
}

/**
 * OpenAI SDK 自定义 fetch wrapper，承担两件事：
 *   1. non-ok 响应时打印完整 body + 请求摘要（mimo / muirouter 经常返回 400
 *      "Param Incorrect" 之类语义稀薄的错误，没这层日志根本看不出哪个 param 不对）
 *   2. mimo thinking-mode reasoning_content 双向透传（见 pendingReasoning 注释）
 *
 * 注意：req body 可能含敏感内容（用户对话原文），日志只截 1.5KB 摘要。
 */
async function loggingFetch(input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> {
  // Request 侧：mimo 请求 + 上一轮缓存命中 → 注入 reasoning_content 到 last assistant
  let mutatedInit = init;
  if (init?.body && typeof init.body === 'string' && pendingReasoning) {
    try {
      const body = JSON.parse(init.body);
      if (isMimoModel(body.model) && body.model === pendingReasoning.model && Array.isArray(body.messages)) {
        const cached = pendingReasoning;
        pendingReasoning = null;
        for (let i = body.messages.length - 1; i >= 0; i--) {
          const msg = body.messages[i];
          if (msg && typeof msg === 'object' && msg.role === 'assistant') {
            msg.reasoning_content = cached.content;
            mutatedInit = { ...init, body: JSON.stringify(body) };
            break;
          }
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

  // Response 侧：mimo streaming 响应 → tee 一份流到后台 tap，抓 delta.reasoning_content
  const reqModel = extractModelFromRequestBody(mutatedInit?.body);
  const isStream = res.ok && !!res.body && (res.headers.get('content-type') ?? '').includes('text/event-stream');
  if (isStream && isMimoModel(reqModel)) {
    const [streamForSDK, streamForUs] = res.body!.tee();
    tapMimoReasoning(streamForUs, reqModel).catch((err) => {
      console.warn('[mimo reasoning tap] failed:', err);
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
async function tapMimoReasoning(stream: ReadableStream<Uint8Array>, model: string): Promise<void> {
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
            const json = JSON.parse(payload) as { choices?: Array<{ delta?: { reasoning_content?: unknown } }> };
            const delta = json.choices?.[0]?.delta?.reasoning_content;
            if (typeof delta === 'string') acc += delta;
          } catch {
            /* 半包 / 非 JSON 行忽略 */
          }
        }
      }
    }
    if (acc) pendingReasoning = { model, content: acc };
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

  // 空转看门狗：如果 stream open 后 30s 内没收到任何 event（mimo / 第三方代理偶发
  // silent hang），主动 abort 并报错，避免 UI 永远卡在"思考中"。任何 event 到达
  // 就 reset 计时。30s 经验值——mimo 经 muirouter 冷启动通常 8-15s，留 2 倍 headroom。
  const STREAM_IDLE_TIMEOUT_MS = 30_000;
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
