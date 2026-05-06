import { type KeyboardEvent, type RefObject, useEffect, useMemo, useRef, useState } from 'react';

import { matchesQuery, SKILL_COMMANDS, type SkillCommandMeta } from '../../shared/skill-commands.ts';

/**
 * chatbox 斜杠命令面板的状态机。
 *
 * 设计要点：
 * - 仅当 input.trimStart() 以 `/` 开头时打开，且 `/` 后没出现空格 / 换行；这样
 *   普通文本里的路径（`a/b`）和命令选完后继续打的内容都不会误开
 * - 选中后整段替换 input 为 promptTemplate，光标用 useEffect 在 React commit 后
 *   才设置（sync 调时 textarea.value 还是旧值）
 * - IME 防呆：handleKeyDown 在 isComposing 时直接返回 false，让中文上屏的 Enter
 *   不被误判为"选中"
 * - Cmd/Ctrl+Enter 在面板打开时也走 pick 而非发送，避免发出字面量 `/critique`
 */

type UseSlashCommandArgs = {
  value: string;
  onChange: (next: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
};

export type SlashCommandHandle = {
  menuOpen: boolean;
  items: readonly SkillCommandMeta[];
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  pick: (item: SkillCommandMeta) => void;
  /** 返回 true 表示事件被面板消费，调用方应短路。 */
  handleKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => boolean;
  closeAndKeep: () => void;
};

export function parseSlashState(value: string): { open: boolean; query: string } {
  const trimmed = value.trimStart();
  if (!trimmed.startsWith('/')) return { open: false, query: '' };
  const after = trimmed.slice(1);
  if (after.includes(' ') || after.includes('\n')) return { open: false, query: '' };
  return { open: true, query: after };
}

export function useSlashCommand({ value, onChange, textareaRef }: UseSlashCommandArgs): SlashCommandHandle {
  const parsed = useMemo(() => parseSlashState(value), [value]);
  const items = useMemo(
    () => (parsed.open ? SKILL_COMMANDS.filter((c) => matchesQuery(c, parsed.query)) : []),
    [parsed.open, parsed.query],
  );

  const [activeIndex, setActiveIndexRaw] = useState(0);
  const [manuallyClosed, setManuallyClosed] = useState(false);

  // 输入变化时（query 变了 / 不再以 / 开头）重置高亮 + 解除 Esc 关闭状态
  // biome-ignore lint/correctness/useExhaustiveDependencies: query 变化要重置高亮，effect 体没读但语义上必须 dep
  useEffect(() => {
    setActiveIndexRaw(0);
    if (!parsed.open) setManuallyClosed(false);
  }, [parsed.open, parsed.query]);

  // items 缩短时把高亮夹紧
  useEffect(() => {
    if (items.length === 0) return;
    setActiveIndexRaw((idx) => Math.min(idx, items.length - 1));
  }, [items.length]);

  const menuOpen = parsed.open && !manuallyClosed && items.length > 0;

  // pick 后的光标位置：sync 调 setSelectionRange 时 textarea.value 还是旧值，
  // 所以 ref 标记 → useEffect 在 value 提交后再 focus + 落光标
  const pendingCursorRef = useRef<number | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: ref 不入 deps（引用稳定，.current 不触发 re-render）
  useEffect(() => {
    const pos = pendingCursorRef.current;
    if (pos == null) return;
    pendingCursorRef.current = null;
    const ta = textareaRef.current;
    if (!ta) return;
    ta.focus();
    ta.setSelectionRange(pos, pos);
  }, [value]);

  function setActiveIndex(index: number): void {
    setActiveIndexRaw(index);
  }

  function pick(item: SkillCommandMeta): void {
    pendingCursorRef.current = item.promptTemplate.length;
    onChange(item.promptTemplate);
  }

  function closeAndKeep(): void {
    setManuallyClosed(true);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>): boolean {
    // IME 防呆：拼音输入中按 Enter 是上屏，不当选中
    if (e.nativeEvent.isComposing) return false;
    if (!menuOpen) return false;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndexRaw((idx) => (idx + 1) % items.length);
      return true;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndexRaw((idx) => (idx - 1 + items.length) % items.length);
      return true;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      const target = items[activeIndex] ?? items[0];
      if (target) pick(target);
      return true;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setManuallyClosed(true);
      return true;
    }
    return false;
  }

  return { menuOpen, items, activeIndex, setActiveIndex, pick, handleKeyDown, closeAndKeep };
}
