import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { AgentInputItem } from '@openai/agents';

import type { AttachmentRef } from '../../shared/types.ts';

/**
 * 把最后一条 user 的图像附件转成 OpenAI Agents SDK 的 input_image content block，
 * 让模型 vision 直接看图（截图、纸质简历照片、设计稿等）。
 *
 * 设计取舍：
 *   - **只对最后一条 user 附图**——历史消息里的图像不会重复 base64，省 token 也避免
 *     长对话越滚越大。用户重新上传同一张图就再走一次。
 *   - 文件以 base64 内联成 data URL，不传 file ID。OpenAI 兼容代理（含 muicv 后端）
 *     都接 data URL，免对接 file storage API。
 *   - 只读 attachments 里 `kind: 'image'` 的；text/PDF/DOCX 仍然走 footer + read_file。
 *   - 读文件失败（被删 / 越界 / 损坏）走静默跳过：不往 input 加图像 block，但保留文本，
 *     避免一张图崩掉整次对话。失败原因走 console.warn 给开发看。
 *
 * 越界保护：附件路径必须落在 `<workspaceDir>/inbox/`，越界返 null 跳过。
 */
export async function applyImageAttachments(
  items: AgentInputItem[],
  lastUserAttachments: AttachmentRef[] | undefined,
  workspaceDir: string,
  readFn: (abs: string) => Promise<Buffer> = (p) => readFile(p),
): Promise<AgentInputItem[]> {
  if (!lastUserAttachments || lastUserAttachments.length === 0) return items;
  const images = lastUserAttachments.filter((a) => a.kind === 'image');
  if (images.length === 0) return items;
  if (items.length === 0) return items;

  const last = items[items.length - 1];
  // AgentInputItem 是 discriminated union；只在最后一条是 user message 时改写
  if (!last || !('role' in last) || last.role !== 'user') return items;

  // user content 可能是 string（纯文本）或已经是 array（不太会发生，兜底）
  const existingText = typeof last.content === 'string' ? last.content : '';

  const dataUrls: Array<{ mime: string; url: string }> = [];
  for (const img of images) {
    const url = await readImageAsDataUrl(workspaceDir, img, readFn);
    if (url) dataUrls.push({ mime: img.mimeType || 'image/png', url });
  }
  if (dataUrls.length === 0) return items;

  const content: Array<{ type: 'input_text'; text: string } | { type: 'input_image'; image: string }> = [];
  if (existingText) content.push({ type: 'input_text', text: existingText });
  for (const { url } of dataUrls) {
    content.push({ type: 'input_image', image: url });
  }

  const next: AgentInputItem[] = items.slice(0, -1);
  next.push({ ...last, content } as AgentInputItem);
  return next;
}

async function readImageAsDataUrl(
  workspaceDir: string,
  img: AttachmentRef,
  readFn: (abs: string) => Promise<Buffer>,
): Promise<string | null> {
  const normalized = img.path.replace(/^[/\\]+/, '');
  const abs = resolve(workspaceDir, normalized);
  // 越界保护：附件应该位于 inbox/，正常 attachments:save 写出来都是这个前缀
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
