/** Mui 柯基 mascot —— meathill 的狗，本品牌精神图腾。共用组件。 */
export function CorgiMascot({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <span className={`relative inline-flex items-center justify-center overflow-visible ${className}`} aria-hidden>
      <img src="/brand/mui-logo.png" className="h-full w-[155%] max-w-none object-contain" alt="" />
    </span>
  );
}
