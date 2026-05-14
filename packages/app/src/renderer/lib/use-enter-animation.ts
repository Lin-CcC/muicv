import { useEffect, useState } from 'react';

/**
 * 双 RAF 入场 / setTimeout 出场的通用抽屉 + 对话框动画。
 *
 *   target truthy → 立即 setMounted(target)，然后第一帧让浏览器 paint 一次「关闭」
 *                   样式快照，第二帧再 setVisible(true)，CSS transition 才有「前一帧
 *                   旧样式 → 当前帧新样式」的差值可以演——单 RAF 时 React 18 偶尔
 *                   合并两次 setState 到同一次 commit，浏览器只看到打开态，动画丢失。
 *   target falsy → 先 setVisible(false) 触发出场过渡，等 transitionMs 后再 setMounted(null)
 *                  把 DOM 卸载。caller 想跑的副作用（关闭外部资源等）单独 useEffect 写。
 */
export function useEnterAnimation<T>(target: T | null, transitionMs: number): { mounted: T | null; visible: boolean } {
  const [mounted, setMounted] = useState<T | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (target) {
      setMounted(target);
      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setVisible(true));
      });
      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
      };
    }
    setVisible(false);
    const t = setTimeout(() => setMounted(null), transitionMs);
    return () => clearTimeout(t);
  }, [target, transitionMs]);

  return { mounted, visible };
}
