/**
 * 转写文本中"填充词"频率统计。issue #1 M2 客户端职责。
 *
 * 中英文常见填充词（口头禅 / 思考占位词），出现 > 1 次 / 15s 时面试官会扣分。
 * 阈值判断在 muicv-interview SKILL.md 的反馈维度里，本模块只给绝对计数。
 *
 * 实现注意：
 * - 中文按字符级匹配，因为 whisper 输出是连写无空格
 * - 英文按词边界匹配（避免 "alike" 命中 "like"）
 * - 大小写不敏感
 */

// 单字符填充词不能和多字符短语前缀重叠（"那" 是 "那个" 的前缀，会双重计数；
// 同时 "那" 单独使用很常见非 filler 用法，干脆去掉）。
const ZH_FILLERS = ['嗯', '呃', '啊', '那个', '就是', '然后', '对吧', '所以', '其实', '这个'];

const EN_FILLERS = ['um', 'uh', 'like', 'you know', 'basically', 'actually', 'kinda', 'sort of'];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countZhFillers(text: string): number {
  let total = 0;
  for (const filler of ZH_FILLERS) {
    const re = new RegExp(escapeRegex(filler), 'g');
    total += (text.match(re) ?? []).length;
  }
  return total;
}

function countEnFillers(text: string): number {
  const lower = text.toLowerCase();
  let total = 0;
  for (const filler of EN_FILLERS) {
    // 英文加词边界 \b 防 "alike" → "like"。多词短语用空白容错。
    const escaped = escapeRegex(filler).replace(/\\ /g, '\\s+');
    const re = new RegExp(`\\b${escaped}\\b`, 'g');
    total += (lower.match(re) ?? []).length;
  }
  return total;
}

export function countFillers(transcript: string): number {
  if (!transcript) return 0;
  return countZhFillers(transcript) + countEnFillers(transcript);
}
