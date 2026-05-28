import type { ReactElement } from 'react';

/**
 * 把 schema.org JSON-LD 放进页面 <head>。
 *
 * 注意：JSON.stringify 后必须把 `<` 转义掉，否则恶意字符串可能造成 `</script>` 提前闭合。
 */
export function JsonLd({ data }: { data: unknown }): ReactElement {
  const payload = JSON.stringify(data).replace(/</g, '\\u003c');
  return (
    // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD 必须以原始文本注入 <script>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: payload }} />
  );
}
