import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { AttachmentRef } from '../../shared/types.ts';

/**
 * 把 inbox/ 下的图像附件读成 base64 data URL（OpenAI Agents SDK 的 input_image
 * content block 直接吃 data URL，免对接 file storage）。
 *
 * 越界保护：附件路径必须落在 `<workspaceDir>/inbox/`，越界返 null 跳过。
 * 读盘失败（被删 / 损坏）也返 null——上层负责"图丢了 → 跳过单张，文本仍发"。
 *
 * 历史 user message 的图也复用这个函数：Claude Code 模式下每轮把全部历史图重新
 * 内联到 input，靠底层 LLM 的 prompt cache（Anthropic cache_control / OpenAI
 * automatic）抵消重复 token 成本。详见 history.ts buildAgentInput。
 */
export async function readImageAsDataUrl(
  workspaceDir: string,
  img: AttachmentRef,
  readFn: (abs: string) => Promise<Buffer> = (p) => readFile(p),
): Promise<string | null> {
  const normalized = img.path.replace(/^[/\\]+/, '');
  const abs = resolve(workspaceDir, normalized);
  const root = workspaceDir.endsWith('/') || workspaceDir.endsWith('\\') ? workspaceDir : `${workspaceDir}/`;
  if (!abs.startsWith(root) && abs !== workspaceDir) {
    console.warn('[multimodal] reject out-of-workspace image:', img.path);
    return null;
  }
  try {
    const buf = await readFn(abs);
    const mime = img.mimeType || 'image/png';
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch (err) {
    console.warn('[multimodal] failed to read image', img.path, err);
    return null;
  }
}
