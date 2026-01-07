'use client';

import { useState } from 'react';

import Link from 'next/link';

import { Button } from '@muicv/ui';
import { setConversationResumeContext } from '@/src/api-client/chat-api';

export type ResumeContextBarProps = {
  conversationId: string | undefined;
  contextResumeId: string | null;
  onUpdated(): Promise<void> | void;
};

function formatResumeId(value: string) {
  return value.length <= 12 ? value : `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export function ResumeContextBar(props: ResumeContextBarProps) {
  const [isClearing, setIsClearing] = useState(false);

  async function handleClear() {
    if (!props.conversationId) return;
    if (!props.contextResumeId) return;

    const ok = window.confirm('确定移除该对话的简历上下文吗？');
    if (!ok) return;

    setIsClearing(true);
    try {
      await setConversationResumeContext(props.conversationId, null);
      await props.onUpdated();
    } finally {
      setIsClearing(false);
    }
  }

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      {!props.conversationId && <span>未选择对话</span>}

      {props.conversationId && !props.contextResumeId && <span>未关联简历</span>}

      {props.conversationId && props.contextResumeId && (
        <span className="truncate">已关联简历：{formatResumeId(props.contextResumeId)}</span>
      )}

      <Link href="/resume" className="rounded-md px-2 py-1 hover:bg-accent hover:text-accent-foreground">
        管理简历
      </Link>

      {props.conversationId && props.contextResumeId && (
        <Button size="xs" variant="ghost" type="button" onClick={() => void handleClear()} disabled={isClearing}>
          {isClearing ? '移除中…' : '移除'}
        </Button>
      )}
    </div>
  );
}
