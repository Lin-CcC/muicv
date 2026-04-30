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
