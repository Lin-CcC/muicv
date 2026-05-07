/**
 * 把持久化的 ChatMessage[] 转成 OpenAI Agents SDK 的 AgentInputItem[]，
 * 同时实现一个简单的滑动窗口：超过 token budget 时丢弃最早的非必要消息。
 *
 * 不引入 tiktoken：用 char/2.5 估算，对长对话裁剪场景已经够用，
 * 偏保守反而能多留一点 headroom 给 system prompt + 输出。
 */

import type { AgentInputItem } from '@openai/agents';

import type { ChatMessage } from '../../shared/types.ts';

/**
 * 默认 token 预算。100k 是相对保守的值——大多数 muicv 在用的模型
 * （gpt-5.4 / mimo-v2.5 系列）的 context window 都 >= 128k，预留
 * ~30% 给 system prompt + tool schema + 模型输出。
 *
 * 不做 per-model 表，因为：
 *   - muicv 后端可能随时加新模型，硬编码表会过期；
 *   - 保守值在所有情况下都安全，代价是大 context 模型不能完全榨干。
 */
const DEFAULT_BUDGET_TOKENS = 100_000;

/** 估算 token 数：char/2.5。中文密集场景偏保守（实际 ~1 token/汉字），英文略低估。 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 2.5);
}

/** 给定模型 id 的 token 预算。目前所有模型走同一个保守默认值。 */
export function getModelBudget(_modelId: string): number {
  return DEFAULT_BUDGET_TOKENS;
}

export type BuildAgentInputResult = {
  items: AgentInputItem[];
  /** 被丢弃的历史 ChatMessage 条数（不含插入的 ellipsis 提示）。 */
  droppedCount: number;
  /** items 整体的预估 token 数（含 ellipsis 提示）。 */
  estimatedTokens: number;
};

/**
 * 把 ChatMessage[] 转成 AgentInputItem[]。
 *
 * 滑动窗口策略：
 *   - 最后一条 user message 永远保留（即使本身超 budget）——丢用户最新输入更糟；
 *   - 其余从最新往最早贪心累加，超 budget 即停；
 *   - 中间被切断时在保留段最前面插一条 user 提示「（已省略 N 条更早的对话）」，
 *     让模型知道历史不完整。
 *
 * 不还原 tool_call / tool_result 链：assistant.toolCalls 字段在送 LLM 时
 * 被忽略，跟 MVP 字符串拼接版本行为一致。
 */
export function buildAgentInput(messages: ChatMessage[], opts?: { budgetTokens?: number }): BuildAgentInputResult {
  const budget = opts?.budgetTokens ?? DEFAULT_BUDGET_TOKENS;
  if (messages.length === 0) {
    return { items: [], droppedCount: 0, estimatedTokens: 0 };
  }

  const reversed = [...messages].reverse();
  const kept: ChatMessage[] = [];
  let tokenAcc = 0;
  let isFirst = true;

  for (const m of reversed) {
    const cost = estimateTokens(m.content ?? '');
    if (isFirst) {
      // 最后一条（reverse 后的第一条）不论多大都保留
      kept.push(m);
      tokenAcc += cost;
      isFirst = false;
      continue;
    }
    if (tokenAcc + cost > budget) break;
    kept.push(m);
    tokenAcc += cost;
  }

  kept.reverse();
  const droppedCount = messages.length - kept.length;
  const items: AgentInputItem[] = kept.map(toItem);

  if (droppedCount > 0) {
    const ellipsisText = `（已省略 ${droppedCount} 条更早的对话）`;
    items.unshift({ role: 'user', content: ellipsisText });
    tokenAcc += estimateTokens(ellipsisText);
  }

  return { items, droppedCount, estimatedTokens: tokenAcc };
}

function toItem(msg: ChatMessage): AgentInputItem {
  const text = msg.content ?? '';
  if (msg.role === 'assistant') {
    return {
      role: 'assistant',
      status: 'completed',
      content: [{ type: 'output_text', text }],
    };
  }
  if (msg.role === 'system') {
    return { role: 'system', content: text };
  }
  // user / tool（持久化里不该出现 tool，兜底当 user 处理避免崩）
  return { role: 'user', content: text };
}
