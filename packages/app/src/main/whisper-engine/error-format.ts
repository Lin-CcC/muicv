/**
 * 把底层 Error 的 message + cause（含 Node 的 errno code）拍平成一段可读文本，
 * 方便往 UI 冒泡时一眼看到根因（DNS/SSL/连接拒绝/超时…），而不是只剩 `fetch failed`。
 */
export function describeCause(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const code = (err as NodeJS.ErrnoException).code;
  const cause = (err as Error & { cause?: unknown }).cause;
  const causeText = cause instanceof Error ? describeCause(cause) : cause ? String(cause) : '';
  const head = `${err.message}${code ? ` [${code}]` : ''}`;
  return causeText ? `${head} → ${causeText}` : head;
}
