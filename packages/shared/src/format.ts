/**
 * 跨包共用的展示格式化 helpers。webside 上 SSR 输出的日期 / 时间格式必须确定性
 * （否则 hydration mismatch），所以日期类 helper 暂不放在这里 —— 各端按各自需求自己写。
 *
 * 这里只放**输出与运行环境无关**的格式化函数。
 */

/**
 * 格式化「分」为带货币符号的金额字符串。
 *
 * 规则：
 *   - 输入非数字（null / undefined / NaN）→ 返回 `—`
 *   - currency=CNY → `¥`，USD → `$`，其它 → `${currency} `
 *   - 保留 2 位小数
 */
export function formatCents(cents: number | null | undefined, currency: string | null | undefined = 'CNY'): string {
  if (typeof cents !== 'number' || !Number.isFinite(cents)) return '—';
  const c = currency ?? 'CNY';
  const symbol = c === 'CNY' ? '¥' : c === 'USD' ? '$' : `${c} `;
  return `${symbol}${(cents / 100).toFixed(2)}`;
}
