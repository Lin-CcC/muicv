// 把绝对路径编码为 muicv-pdf:// URL，跨平台。
// macOS:   /Users/x/a.pdf       → muicv-pdf://local/Users/x/a.pdf
// Windows: C:\Users\x\a.pdf     → muicv-pdf://local/C:/Users/x/a.pdf
//   盘符前补 /，让 URL parser 把 'local' 当 host、'/C:/...' 当 pathname；
//   \ 统一转 /，避免落到 URL 里被 Chromium 隐式规整带来的边界问题。
export function pathToMuicvPdfUrl(absPath: string): string {
  const forward = absPath.replace(/\\/g, '/');
  const prefix = forward.startsWith('/') ? '' : '/';
  return `muicv-pdf://local${prefix}${encodeURI(forward)}`;
}
