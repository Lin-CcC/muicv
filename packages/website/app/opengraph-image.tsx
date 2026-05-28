import { ImageResponse } from 'next/og';

/**
 * 全站默认 OG 分享图。Next.js 约定：app/opengraph-image.tsx 会在构建期生成
 * /opengraph-image，并由 metadata 系统自动写到 <meta property="og:image">。
 *
 * 字体说明：edge runtime 的 ImageResponse 默认走 sans-serif，CJK 字符渲染不稳定，
 * 所以这张默认图先用 ASCII 文字 + 品牌色。要做按页面定制（如 post 标题）时，
 * 在对应目录加 opengraph-image.tsx，并嵌入字体子集。
 */

export const alt = 'Mui简历 — AI Job Search Platform';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'center',
        background: '#FFF6E3',
        color: '#1F1A14',
        padding: '80px 96px',
        fontFamily: 'sans-serif',
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 80,
          right: 96,
          fontSize: 24,
          fontWeight: 700,
          color: '#7A6242',
          textTransform: 'uppercase',
          letterSpacing: 4,
        }}
      >
        muicv.com
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 16,
        }}
      >
        <div style={{ fontSize: 168, fontWeight: 900, lineHeight: 1 }}>MuiCV</div>
        <div style={{ fontSize: 48, fontWeight: 700, color: '#E0A93D' }}>·</div>
      </div>

      <div
        style={{
          marginTop: 28,
          fontSize: 56,
          fontWeight: 700,
          color: '#3F3527',
          maxWidth: 920,
          lineHeight: 1.15,
        }}
      >
        AI Job Search Platform
      </div>

      <div
        style={{
          marginTop: 24,
          fontSize: 28,
          fontWeight: 500,
          color: '#7A6242',
          maxWidth: 920,
          lineHeight: 1.4,
        }}
      >
        Smart resumes · Job discovery · Mock interviews · Career coaching
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 64,
          left: 96,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          fontSize: 22,
          fontWeight: 700,
          color: '#1F1A14',
          padding: '10px 20px',
          background: '#FFD23F',
          borderRadius: 8,
          border: '3px solid #1F1A14',
        }}
      >
        Download · Free 10K tokens
      </div>
    </div>,
    { ...size },
  );
}
