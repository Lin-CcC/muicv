import { type RefObject, useEffect } from 'react';

/**
 * 仅当 active = true 时挂 mousedown 监听；点击 ref 外部 → onOutside()。
 * ref 内部、以及任意 [role="dialog"]（confirm 弹窗）不算外部。
 *
 * 用于关闭下拉菜单 / 弹层。约定 ref 是包裹"触发按钮 + dropdown"那一层
 * relative 容器，dropdown 用 absolute 定位 —— DOM 上仍在 ref 子树内，
 * 所以"点 dropdown 内部"也不会触发关闭。
 */
export function useClickOutside(ref: RefObject<HTMLElement | null>, active: boolean, onOutside: () => void): void {
  useEffect(() => {
    if (!active) return;
    function onMouseDown(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[role="dialog"]')) return;
      if (ref.current && !ref.current.contains(target)) onOutside();
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [ref, active, onOutside]);
}
