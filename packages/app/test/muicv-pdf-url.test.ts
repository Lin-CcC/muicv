import assert from 'node:assert/strict';
import test from 'node:test';

import { pathToMuicvPdfUrl } from '../src/renderer/lib/muicv-pdf-url.ts';

// 模拟主进程对 muicv-pdf:// URL 的反向解析。和 src/main/index.ts 的 protocol.handle
// 保持等价：取 hostname / 解码 pathname / Windows 盘符前导 '/' 剥掉。
function parseMuicvPdfUrl(rawUrl: string): { hostname: string; filePath: string } {
  const url = new URL(rawUrl);
  let raw = decodeURIComponent(url.pathname);
  if (/^\/[A-Za-z]:/.test(raw)) raw = raw.slice(1);
  return { hostname: url.hostname, filePath: raw };
}

test('macOS 绝对路径 roundtrip 不丢失', () => {
  const input = '/Users/me/Documents/Mui简历/profile/r.pdf';
  const url = pathToMuicvPdfUrl(input);
  assert.match(url, /^muicv-pdf:\/\/local\//);
  const { hostname, filePath } = parseMuicvPdfUrl(url);
  assert.equal(hostname, 'local');
  assert.equal(filePath, input);
});

test('Windows 盘符路径正确编码并能反向还原', () => {
  const input = 'C:\\Users\\me\\Documents\\Mui简历\\profile\\r.pdf';
  const url = pathToMuicvPdfUrl(input);
  // URL 形如 muicv-pdf://local/C:/Users/...，盘符前必须有 /，否则被粘成 'localC:'。
  assert.match(url, /^muicv-pdf:\/\/local\/C:\//);
  const { hostname, filePath } = parseMuicvPdfUrl(url);
  assert.equal(hostname, 'local');
  // 反向得到 forward-slash 形式，path.resolve 在 Windows 上会规整成 'C:\Users\...'。
  assert.equal(filePath, 'C:/Users/me/Documents/Mui简历/profile/r.pdf');
});

test('文件名含空格也能还原', () => {
  const input = '/Users/me/Mui简历/我 的 简历.pdf';
  const url = pathToMuicvPdfUrl(input);
  // encodeURI 会把空格转成 %20
  assert.ok(url.includes('%20'));
  const { filePath } = parseMuicvPdfUrl(url);
  assert.equal(filePath, input);
});

test('Windows 小写盘符也能识别', () => {
  const input = 'd:\\workspace\\r.pdf';
  const url = pathToMuicvPdfUrl(input);
  assert.match(url, /^muicv-pdf:\/\/local\/d:\//);
  const { filePath } = parseMuicvPdfUrl(url);
  assert.equal(filePath, 'd:/workspace/r.pdf');
});

test('hostname 不是 local 应被识别（防御性）', () => {
  // 如果 Windows 上忘了补 / 会被解析成 'localc' 之类的 host，这里固化对比。
  const broken = new URL('muicv-pdf://localC:/x/r.pdf');
  assert.notEqual(broken.hostname, 'local');
});
