import { CONVERSATION_TYPE_META, type ConversationType } from '../../shared/types.ts';
import { CorgiMascot } from './corgi-mascot';

export function CenteredCard({
  title,
  body,
  ctaLabel,
  onCta,
}: {
  title: string;
  body: string;
  ctaLabel: string;
  onCta: () => void;
}) {
  return (
    <div className="flex h-full items-center justify-center px-6">
      <div className="max-w-md rounded-2xl border-2 border-ink bg-cream p-7 text-center shadow-[0_4px_0_0_var(--color-ink)]">
        <CorgiMascot className="mx-auto h-16 w-16" />
        <h2 className="mt-3 text-2xl font-extrabold text-ink">{title}</h2>
        <p className="mt-2 text-[13px] text-ink-soft">{body}</p>
        <button
          type="button"
          onClick={onCta}
          className="press mt-5 inline-flex rounded-lg bg-yellow px-5 py-2 text-[14px] font-bold text-ink"
        >
          {ctaLabel}
        </button>
      </div>
    </div>
  );
}

export function NoConversationCard() {
  return (
    <div className="flex h-full items-center justify-center px-6">
      <div className="max-w-md text-center">
        <CorgiMascot className="mx-auto h-16 w-16" />
        <h2 className="mt-4 text-2xl font-extrabold text-ink">还没选对话</h2>
        <p className="mt-2 text-[13px] leading-[1.7] text-ink-soft">
          左栏点 <strong>+ 新建</strong> 选一种对话类型开始，或者点列表里某个对话切过去。
        </p>
      </div>
    </div>
  );
}

export function EmptyConversation({ type }: { type: ConversationType }) {
  const meta = CONVERSATION_TYPE_META[type];
  return (
    <div className="mt-10 flex flex-col items-center text-center">
      <span className="text-[40px]">{meta.emoji}</span>
      <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-ink">{meta.label}</h2>
      <p className="mt-2 max-w-md text-[13px] leading-[1.7] text-ink-soft">{meta.tagline}</p>
      <p className="mt-4 max-w-md text-[12px] text-mute">下面输入框直接说就行 —— 例：</p>
      <p className="mt-1 max-w-md text-[12px] text-ink-soft">
        "{meta.placeholder.replace(/^比如：/, '').replace(/^\「|\」$/g, '')}"
      </p>
    </div>
  );
}

export function AiSetupCard({ onGoSettings, onDismiss }: { onGoSettings: () => void; onDismiss: () => void }) {
  return (
    <div className="rounded-2xl border-2 border-ink bg-fluff p-5 shadow-[0_4px_0_0_var(--color-ink)]">
      <div className="flex items-start gap-3">
        <CorgiMascot className="h-10 w-10 shrink-0" />
        <div className="flex-1">
          <h3 className="text-[16px] font-extrabold text-ink">AI 服务还没连上</h3>
          <p className="mt-1.5 text-[13px] leading-[1.6] text-ink-soft">
            Mui 需要联网调用 AI 才能帮你写简历。免费版当前需要连一下你自己的 AI 余额（叫
            muirouter，类似话费充值），或升级 Pro 会员后由我们提供。
          </p>
          <div className="mt-3.5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onGoSettings}
              className="press inline-flex items-center justify-center rounded-lg bg-yellow px-4 py-2 text-[13px] font-bold text-ink"
            >
              去设置完成 →
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-lg px-3 py-2 text-[12px] text-mute hover:text-ink"
            >
              先关掉
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
