import type { AttachmentKind, AttachmentRef } from '../../shared/types.ts';

/**
 * agent runtime 上来的错误分三类，决定 UI 怎么展示：
 *   - ai-not-configured：让用户去 settings 接 AI（402 / muirouter 没绑）
 *   - no-profile：让用户去新建 profile
 *   - plain：当成普通错误打到红条
 */
export function classifyError(raw: string): 'ai-not-configured' | 'no-profile' | 'plain' {
  if (!raw) return 'plain';
  if (raw === 'NOT_LOGGED_IN') return 'plain';
  if (raw === 'NO_PROFILE') return 'no-profile';
  if (/no-muirouter-link|402|muirouter|byok/i.test(raw)) return 'ai-not-configured';
  return 'plain';
}

export function safeParseJson(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return json;
  }
}

export function cryptoRandomId(): string {
  return crypto.randomUUID();
}

/**
 * 剥掉对话标题前面的 emoji 前缀（含 ZWJ / VS-16 组合）+ 紧随的空格。
 * 历史 schema 默认标题是「[emoji] [label] · MM-DD」直接写盘的，新版本默认
 * 标题已经不带 emoji（类型图标在 UI 层独立渲染），这个函数只是兼容旧数据，
 * 不动磁盘 —— 用户改名想保留任何前导符号都不会被误剥。
 */
export function stripLeadingEmoji(s: string): string {
  // \p{Extended_Pictographic} 主体 + ️ (VS-16) + ‍ (ZWJ)
  return s.replace(/^(?:[\p{Extended_Pictographic}️‍]+\s*)+/u, '');
}

/**
 * 把 markdown 里出现的相对路径（如 "versions/xxx.md"）拼成绝对路径，
 * 配合 openRightPanel 在右栏打开预览。已经是绝对路径就直接返回。
 */
export function resolveWorkspacePath(workspaceDir: string | null, p: string): string {
  if (!p) return p;
  if (p.startsWith('/') || /^[A-Za-z]:[\\/]/.test(p)) return p;
  if (!workspaceDir) return p;
  const sep = workspaceDir.includes('\\') ? '\\' : '/';
  return workspaceDir.replace(/[/\\]+$/, '') + sep + p.replace(/^[/\\]+/, '');
}

const KIND_LABEL: Record<AttachmentKind, string> = {
  pdf: 'PDF',
  docx: 'DOCX',
  markdown: 'Markdown',
  text: '纯文本',
  image: '图像',
};

/**
 * 把附件列表拼成 user message footer。agent 拿到后 `read_file` 这些路径即可。
 *
 * - PDF / DOCX：已经在 main 进程提取出 sidecar，明确告知 agent 走哪个 .txt
 * - 图像：写明"已附在本条消息（input_image）"——附件本身已通过多模态 content
 *   block 跟随 user message 进入模型，**agent 不要再 read_file 二进制文件**
 */
export function formatAttachmentsFooter(refs: AttachmentRef[]): string {
  if (refs.length === 0) return '';
  const lines = refs.map((r) => {
    const head = `- ${r.path}（${KIND_LABEL[r.kind]}`;
    if (r.kind === 'image') return `${head}，已随消息附图，agent 直接看图，不要 read_file）`;
    return r.textPath ? `${head}，已提取文本：${r.textPath}）` : `${head}）`;
  });
  return `\n\n---\n[附件]\n${lines.join('\n')}`;
}
