import { tool } from '@openai/agents';
import type { WebContents } from 'electron';
import { z } from 'zod';

import type { AppConfig } from '../../shared/types.ts';
import { MicPermissionDenied, RecordingCancelled, recordAndTranscribe } from '../audio.ts';

/**
 * STT 工具集（issue #1 M2）。
 *
 * record_and_transcribe_response：让用户口头答题。
 *   1. ensureMicrophoneAccess（macOS 权限弹窗）
 *   2. 触发 renderer RecordPanel → 等用户录完
 *   3. POST {muicvApiBase}/audio/transcribe（multipart/form-data）
 *   4. 拿到 transcript → countFillers + pause 数 → 返回 JSON
 *
 * 实际流程在 main/audio.ts 的 recordAndTranscribe 公共函数里，跟 chatbox 麦克风
 * 按钮共用同一套链路。本文件只负责把它包成 agent tool 形态 + 错误转字符串。
 *
 * 失败语义（直接返回字符串给 agent，agent 据此决定要不要回退打字模式）：
 *   - 麦克风未授权 → "录音失败：麦克风未授权..."
 *   - 用户取消 → "录音失败：用户取消"
 *   - 网络 / 后端错误 → "录音失败：..."
 *
 * 仅在 muicv 桌面 app 内有效；description 里说清楚让 agent 在 terminal 别误调。
 */

export function buildSttTools(config: AppConfig, sender: WebContents) {
  const recordAndTranscribeResponse = tool({
    name: 'record_and_transcribe_response',
    description:
      '弹出录音面板让用户用麦克风口头回答（最长 N 秒）。返回 JSON 字符串，含 transcript / durationMs / language / fillerCount / pauseCount。**仅在 muicv 桌面 app 内可用**。',
    parameters: z.object({
      durationLimitSec: z.number().nullable().describe('录音上限秒数，默认 180（3 分钟）'),
    }),
    execute: async ({ durationLimitSec }) => {
      try {
        const result = await recordAndTranscribe({
          durationLimitSec: durationLimitSec ?? 180,
          sender,
          config,
        });
        return JSON.stringify(result);
      } catch (err) {
        if (err instanceof MicPermissionDenied || err instanceof RecordingCancelled) {
          return `录音失败：${err.message}`;
        }
        return `录音失败：${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });

  return [recordAndTranscribeResponse];
}
