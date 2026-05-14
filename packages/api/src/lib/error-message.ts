/**
 * 错误归一：Error → .message；其它 → String(...)。
 * 路由 detail 字段统一走这个，避免每处都写 `error instanceof Error ? error.message : String(error)`。
 */
export function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
