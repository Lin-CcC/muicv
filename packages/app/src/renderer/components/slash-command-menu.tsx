import { Popover } from '@base-ui/react/popover';

import type { SkillCommandMeta } from '../../shared/skill-commands.ts';

type Props = {
  open: boolean;
  anchor: HTMLElement | null;
  items: readonly SkillCommandMeta[];
  activeIndex: number;
  onPick: (item: SkillCommandMeta) => void;
  onHover: (index: number) => void;
  onOpenChange: (open: boolean) => void;
};

/**
 * chatbox 斜杠命令面板。Popover 受控开关，不抢焦点（textarea 保留 focus 让用户继续打字过滤）。
 *
 * 不用 Popover.Trigger：开关由 useSlashCommand 解析 input 后通过 `open` prop 驱动。
 * 不用 Autocomplete / Combobox：那两个绑死单行 input，跟现有多行 textarea 不兼容。
 */
export function SlashCommandMenu({ open, anchor, items, activeIndex, onPick, onHover, onOpenChange }: Props) {
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <Popover.Portal>
        <Popover.Positioner anchor={anchor} side="top" align="start" sideOffset={8} className="z-50">
          <Popover.Popup
            initialFocus={false}
            finalFocus={false}
            className="w-[320px] overflow-hidden rounded-lg border-2 border-rule-strong bg-cream shadow-lg"
          >
            {items.length === 0 ? (
              <div className="px-3 py-2 text-[14px] text-mute">没找到匹配的命令</div>
            ) : (
              <div className="max-h-[280px] overflow-y-auto py-1">
                {items.map((item, i) => (
                  <button
                    type="button"
                    key={item.slash}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => onHover(i)}
                    onClick={() => onPick(item)}
                    className={`flex w-full cursor-pointer items-start gap-2 px-3 py-2 text-left transition ${
                      i === activeIndex ? 'bg-yellow/30' : 'hover:bg-rule/40'
                    }`}
                  >
                    <span className="text-[16px] leading-tight">{item.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[14px] font-bold text-ink">{item.label}</span>
                        <span className="ml-auto shrink-0 font-mono text-[12px] text-mute">/{item.slash}</span>
                      </div>
                      <div className="mt-0.5 truncate text-[12px] text-ink-soft">{item.tagline}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
