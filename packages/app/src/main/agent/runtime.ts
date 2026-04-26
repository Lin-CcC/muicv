import type { WebContents } from 'electron';

import { Agent, run, setDefaultOpenAIClient, setDefaultOpenAIKey, setOpenAIAPI } from '@openai/agents';
import OpenAI from 'openai';

import { randomUUID } from 'node:crypto';

import type { AgentChunk, AppConfig, ChatMessage, ConversationType, ToolCallRecord } from '../../shared/types.ts';
import { getConversation, saveConversation } from '../conversations.ts';
import { buildApiTools } from './api-tools.ts';
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
  setDefaultOpenAIClient(new OpenAI({ apiKey, baseURL }));
  configuredKey = apiKey;
  configuredBase = baseURL;
  return true;
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
  if (!ensureConfigured(config)) {
    send({ type: 'error', message: 'NOT_LOGGED_IN' });
    send({ type: 'finish', reason: 'error' });
    return;
  }

  // artifact 收集：tool 调用过程中累计 artifact，完成后塞进 assistant message
  const collectedArtifacts: Array<{ kind: import('../../shared/types.ts').ArtifactKind; path: string; title: string }> =
    [];
  const emitArtifact: ArtifactEmitter = (a) => {
    collectedArtifacts.push(a);
    send({ type: 'artifact', ...a });
  };

  const tools = [...buildFileTools(config.workspaceDir, emitArtifact), ...buildApiTools(config, emitArtifact)];
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

  // OpenAI Agents SDK 的 input：完整对话历史 array of items（assistant + user 交替）
  // MVP：直接传上一条 user 文本 + 把历史压成 string context。后续可改为 AgentInputItem[]。
  const history = messages
    .slice(0, -1)
    .map((m) => `${m.role === 'user' ? '【用户】' : '【助手】'} ${m.content}`)
    .join('\n\n');
  const input = history ? `${history}\n\n【用户】 ${lastUser.content}` : lastUser.content;

  const abort = new AbortController();
  activeRuns.set(channelId, abort);

  // 提到 try 外面，让 error / abort 路径也能拿到部分输出存盘
  let assistantText = '';
  const assistantToolCalls: ToolCallRecord[] = [];

  try {
    const stream = await run(agent, input, {
      stream: true,
      signal: abort.signal,
      maxTurns: 30,
    });

    // assistantText / assistantToolCalls 已在 try 外定义；这里不再 redeclare
    for await (const event of stream) {
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
    if (aborted) {
      send({ type: 'finish', reason: 'aborted' });
    } else {
      // OpenAI SDK 经常把 fetch 失败包成 "Connection error."，真实原因藏在 .cause
      // 把 cause 链全打到主进程 console + 一并传给 renderer，方便定位
      const cause = (error as { cause?: unknown })?.cause;
      const causeMsg =
        cause instanceof Error
          ? `${cause.name}: ${cause.message}`
          : cause !== undefined
            ? String(cause)
            : '';
      console.error('[agent runtime] error:', error);
      if (cause !== undefined) console.error('[agent runtime] error.cause:', cause);
      const baseMsg = error instanceof Error ? error.message : String(error);
      const msg = causeMsg ? `${baseMsg} (cause: ${causeMsg})` : baseMsg;
      send({ type: 'error', message: msg });
      send({ type: 'finish', reason: 'error' });
    }
  } finally {
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
