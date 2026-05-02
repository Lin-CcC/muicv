/**
 * 行内加载小圆圈，给按钮 / 行级"正在处理"指示用。
 * 大小跟父级文字对齐（h-3.5 w-3.5），currentColor 接管颜色。
 */
export function Spinner({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg
      className={`${className} animate-spin`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      aria-label="处理中"
      role="status"
    >
      <circle cx="12" cy="12" r="9" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" strokeLinecap="round" />
    </svg>
  );
}
