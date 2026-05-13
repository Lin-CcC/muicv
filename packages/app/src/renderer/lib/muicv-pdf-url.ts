// 把绝对路径编码为 muicv-pdf:// URL，跨平台。
//
// 协议历史命名带 pdf，现已泛化：除 .pdf 外还服务常见图片格式（png/jpeg/gif/webp/svg/
// bmp/avif/heic/heif），让 chromium 内置 viewer 在 <iframe>（PDF）/ <img>（图片）
// 里直接 stream 渲染。后缀白名单 + workspace 边界检查在 main/index.ts 的协议 handler。
//
// macOS:   /Users/x/a.pdf       → muicv-pdf://local/Users/x/a.pdf
// Windows: C:\Users\x\a.png     → muicv-pdf://local/C:/Users/x/a.png
//   盘符前补 /，让 URL parser 把 'local' 当 host、'/C:/...' 当 pathname；
//   \ 统一转 /，避免落到 URL 里被 Chromium 隐式规整带来的边界问题。
export function pathToMuicvPdfUrl(absPath: string): string {
  const forward = absPath.replace(/\\/g, '/');
  const prefix = forward.startsWith('/') ? '' : '/';
  return `muicv-pdf://local${prefix}${encodeURI(forward)}`;
}
