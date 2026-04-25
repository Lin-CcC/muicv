import type { WebContents } from 'electron';

import { Agent, run, setDefaultOpenAIClient, setDefaultOpenAIKey, setOpenAIAPI } from '@openai/agents';
import OpenAI from 'openai';

import type { AgentChunk, AppConfig, ChatMessage } from '../../shared/types.ts';
import { buildApiTools } from './api-tools.ts';
import { buildSystemPrompt } from './skills.ts';
import { buildFileTools } from './tools.ts';

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

function ensureConfigured(config: AppConfig): boolean {
  if (!config.muicvApiKey) return false;
  const llmBase = `${config.muicvApiBase.replace(/\/$/, '')}/llm/v1`;
  if (configuredKey === config.muicvApiKey && configuredBase === llmBase) return true;
  setOpenAIAPI('chat_completions');
  setDefaultOpenAIKey(config.muicvApiKey, false);
  setDefaultOpenAIClient(new OpenAI({ apiKey: config.muicvApiKey, baseURL: llmBase }));
  configuredKey = config.muicvApiKey;
  configuredBase = llmBase;
  return true;
}

const activeRuns = new Map<string, AbortController>();

/**
 * 启动一次 agent 流式 run。每个 chunk 通过 sender.send('agent:chunk', channelId, payload)
 * 转发到 renderer。返回一个 promise，run 结束时 resolve。
 */
export async function runAgent(
  channelId: string,
  messages: ChatMessage[],
  config: AppConfig,
  sender: WebContents,
): Promise<void> {
  const send = (chunk: AgentChunk) => {
    if (!sender.isDestroyed()) sender.send('agent:chunk', channelId, chunk);
  };

  if (!config.workspaceDir) {
    send({ type: 'error', message: '未选工作目录，请去设置选一个。' });
    send({ type: 'finish', reason: 'error' });
    return;
  }
  if (!ensureConfigured(config)) {
    send({
      type: 'error',
      message:
        '未配置 muicv API key（mui_...）。在 https://muicv.com/dashboard 生成后粘贴到设置页。',
    });
    send({ type: 'finish', reason: 'error' });
    return;
  }

  const tools = [...buildFileTools(config.workspaceDir), ...buildApiTools(config)];
  const agent = new Agent({
    name: 'Mui简历',
    instructions: buildSystemPrompt(),
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

  try {
    const stream = await run(agent, input, {
      stream: true,
      signal: abort.signal,
      maxTurns: 30,
    });

    for await (const event of stream) {
      if (event.type === 'raw_model_stream_event') {
        // raw event from OpenAI Responses / Chat Completions stream
        const data = event.data as unknown as { type?: string; delta?: string; text?: string };
        // chat_completions stream 的 chunk 类型可能是 'output_text_delta' / 'response.output_text.delta'
        if (data?.type && /text.*delta/i.test(data.type) && typeof data.delta === 'string') {
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
            argsJson =
              typeof raw.arguments === 'string'
                ? raw.arguments
                : JSON.stringify(raw.arguments ?? {});
          } catch {
            /* keep default */
          }
          send({ type: 'tool-called', toolCallId, toolName, argsJson });
        } else if (event.name === 'tool_output' && item.type === 'tool_call_output_item') {
          const raw = item.rawItem ?? {};
          const toolCallId = String(raw.callId ?? raw.id ?? '');
          const output = typeof item.output === 'string' ? item.output : JSON.stringify(item.output ?? '');
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
    send({ type: 'finish', reason: 'completed' });
  } catch (error) {
    if (abort.signal.aborted) {
      send({ type: 'finish', reason: 'aborted' });
    } else {
      const msg = error instanceof Error ? error.message : String(error);
      send({ type: 'error', message: msg });
      send({ type: 'finish', reason: 'error' });
    }
  } finally {
    activeRuns.delete(channelId);
  }
}

export function abortRun(channelId: string): void {
  const ctrl = activeRuns.get(channelId);
  if (ctrl) ctrl.abort();
}

function cryptoRandomShort(): string {
  return Math.random().toString(36).slice(2, 10);
}
