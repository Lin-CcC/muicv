/** Mui 柯基 mascot —— meathill 的狗，本品牌精神图腾。共用组件。 */
export function CorgiMascot({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 80" className={className} aria-hidden role="img">
      {/* 左耳 */}
      <path d="M18 22 L24 6 L32 22 Z" fill="var(--color-yellow)" />
      <path d="M22.5 19 L25 12 L29 19 Z" fill="var(--color-tongue)" opacity="0.55" />
      {/* 右耳 */}
      <path d="M62 22 L56 6 L48 22 Z" fill="var(--color-yellow)" />
      <path d="M57.5 19 L55 12 L51 19 Z" fill="var(--color-tongue)" opacity="0.55" />
      {/* 头部 */}
      <ellipse cx="40" cy="44" rx="22" ry="20" fill="var(--color-yellow)" />
      {/* 脸颊奶油白 */}
      <ellipse cx="40" cy="52" rx="14" ry="11" fill="var(--color-fluff)" />
      {/* 眉毛上一抹更浅 */}
      <ellipse cx="40" cy="34" rx="14" ry="3" fill="var(--color-corgi)" opacity="0.6" />
      {/* 眼 */}
      <ellipse cx="30" cy="40" rx="2" ry="2.6" fill="var(--color-ink)" />
      <ellipse cx="50" cy="40" rx="2" ry="2.6" fill="var(--color-ink)" />
      {/* 眼神光 */}
      <circle cx="30.7" cy="39.2" r="0.7" fill="var(--color-cream)" />
      <circle cx="50.7" cy="39.2" r="0.7" fill="var(--color-cream)" />
      {/* 鼻 */}
      <ellipse cx="40" cy="46.5" rx="3.2" ry="2.4" fill="var(--color-ink)" />
      {/* 嘴笑 */}
      <path
        d="M40 49 Q40 56 35.5 55.5 M40 49 Q40 56 44.5 55.5"
        stroke="var(--color-ink)"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}
