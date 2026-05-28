/**
 * 给 next/og 的 ImageResponse 用：按文本动态拉 Google Fonts 字体子集。
 *
 * 为什么需要：edge runtime 上 `<div>中文</div>` 默认 sans-serif 不带 CJK，
 * 直接渲染中文会出现豆腐块。Google Fonts 的 CSS2 API 支持 `text=` 查询参数，
 * 会返回只包含这些字符的子集（一般 5-10 KB），刚好可以塞进 ImageResponse
 * 的 `fonts` 选项里。
 *
 * 关键：Satori (next/og 内部) 只认 **TTF / OTF / WOFF**，不认 WOFF2 —— WOFF2
 * 需要 brotli 解压，Satori 没带。Google Fonts 默认给现代 Chrome UA 是 woff2，
 * 那条路径上 Satori 渲染时会抛异常 → CF 1101。
 *
 * 解决：**不设 User-Agent**，让 fetch 走 runtime 默认 UA（CF Worker 默认 UA
 * 在 Google 那边判定为非现代浏览器），Google 会返回 `format('truetype')`，
 * Satori 直接吃。
 */

/** 与 next/og `FontOptions.weight` 对齐：只允许 100 的倍数。 */
export type FontWeight = 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;

type LoadedFont = {
  name: string;
  data: ArrayBuffer;
  weight: FontWeight;
  style: 'normal';
};

/**
 * 从 Google Fonts CSS API 拉一个只包含指定文本的 TTF 子集。
 * 失败时返回 null，让调用方走 ASCII 兜底，不抛错。
 */
export async function loadGoogleFontSubset(
  family: string,
  weight: FontWeight,
  text: string,
): Promise<LoadedFont | null> {
  try {
    const url = `https://fonts.googleapis.com/css2?family=${family}:wght@${weight}&text=${encodeURIComponent(text)}`;
    // 故意不传 User-Agent —— CF Worker 默认 UA 在 Google 这边判定为非现代浏览器，
    // 会返回 format('truetype')（Satori 能直接吃）。如果传 Chrome UA 拿到的是
    // woff2，Satori 渲染时会抛异常 → CF 1101。
    const cssRes = await fetch(url);
    if (!cssRes.ok) return null;
    const css = await cssRes.text();
    // 优先 truetype；同源 CSS 里偶尔也会出现 woff（zlib 压缩，Satori 也认）
    const match = css.match(/src:\s*url\((https:\/\/[^)]+)\)\s*format\('(?:truetype|woff)'\)/);
    const fontUrl = match?.[1];
    if (!fontUrl) return null;
    const fontRes = await fetch(fontUrl);
    if (!fontRes.ok) return null;
    const data = await fontRes.arrayBuffer();
    return { name: family.replace(/\+/g, ' '), data, weight, style: 'normal' };
  } catch {
    return null;
  }
}

/**
 * 一次拿多权重的子集，方便 OG 图里既要标题粗体又要副标常规。
 * 单个失败不影响其它权重——失败的那条静默丢弃。
 */
export async function loadGoogleFontSubsets(
  family: string,
  weights: FontWeight[],
  text: string,
): Promise<LoadedFont[]> {
  const results = await Promise.all(weights.map((w) => loadGoogleFontSubset(family, w, text)));
  return results.filter((r): r is LoadedFont => r !== null);
}
