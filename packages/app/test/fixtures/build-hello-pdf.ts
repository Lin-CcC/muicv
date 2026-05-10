// 生成 hello.pdf：用最小化结构（Type1 内嵌字体 Helvetica + 单行 "hello"）。
// 只在需要重建 fixture 时手动跑一次：`node test/fixtures/build-hello-pdf.ts`
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const objects: string[] = [];
function add(body: string) {
  objects.push(body);
}

add('<< /Type /Catalog /Pages 2 0 R >>');
add('<< /Type /Pages /Kids [3 0 R] /Count 1 /MediaBox [0 0 200 100] >>');
add('<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>');
add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
const stream = 'BT /F1 24 Tf 50 50 Td (hello) Tj ET';
add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);

const header = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
let body = '';
const offsets: number[] = [];
for (let i = 0; i < objects.length; i++) {
  offsets.push(Buffer.byteLength(header) + Buffer.byteLength(body));
  body += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
}
const xrefStart = Buffer.byteLength(header) + Buffer.byteLength(body);
let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
for (const off of offsets) {
  xref += `${off.toString().padStart(10, '0')} 00000 n \n`;
}
const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

const pdf = Buffer.concat([
  Buffer.from(header, 'binary'),
  Buffer.from(body, 'binary'),
  Buffer.from(xref, 'binary'),
  Buffer.from(trailer, 'binary'),
]);

const out = resolve(import.meta.dirname, 'hello.pdf');
await writeFile(out, pdf);
console.log(`wrote ${out} (${pdf.byteLength} bytes)`);
