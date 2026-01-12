'use client';

import type { MemoryEntry } from '@muicv/shared';
import { Button } from '@muicv/ui';

export type MemorySidebarProps = {
  entries: MemoryEntry[];
  activeConversationId: string | undefined;
  isLoading: boolean;
  isOrganizing: boolean;
  errorMessage: string | undefined;
  lastOrganizeSummary:
    | {
        created: number;
        skipped: number;
      }
    | undefined;
  onReload(conversationId: string | undefined): Promise<void>;
  onOrganize(conversationId: string | undefined): Promise<void>;
};

function formatTimestamp(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN');
}

function formatMemoryEntryKind(value: string) {
  if (value === 'career_event') return '经历';
  if (value === 'skill') return '技能';
  if (value === 'project') return '项目';
  if (value === 'education') return '教育';
  if (value === 'preference') return '偏好';
  if (value === 'contact') return '联系方式';
  return '其它';
}

export function MemorySidebar(props: MemorySidebarProps) {
  async function handleOrganizeMemory() {
    const shouldProceed = window.confirm('整理会调用 AI 并可能产生新的「用户记录」，确定继续吗？');
    if (!shouldProceed) return;
    await props.onOrganize(props.activeConversationId);
  }

  return (
    <aside className="col-span-3 rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold">用户记录</h2>
      <div className="mt-3 space-y-3 text-sm">
        {props.isLoading && <div className="text-sm text-muted-foreground">加载记录中...</div>}
        {props.isOrganizing && <div className="text-sm text-muted-foreground">整理记录中...</div>}

        {props.errorMessage && (
          <div className="rounded-lg border border-destructive/24 bg-destructive/8 px-3 py-2 text-sm text-destructive-foreground">
            {props.errorMessage}
          </div>
        )}

        <div className="rounded-md border border-border bg-background p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground">
              {props.activeConversationId ? '当前对话记录' : '全部记录'}
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="xs"
                variant="secondary"
                type="button"
                onClick={() => void props.onReload(props.activeConversationId)}
                disabled={props.isLoading || props.isOrganizing}
              >
                刷新
              </Button>
              <Button
                size="xs"
                variant="secondary"
                type="button"
                onClick={() => void handleOrganizeMemory()}
                disabled={props.isLoading || props.isOrganizing}
              >
                {props.isOrganizing ? '整理中...' : '整理'}
              </Button>
            </div>
          </div>

          {props.lastOrganizeSummary && (
            <div className="mt-2 text-xs text-muted-foreground">
              最近一次整理：新增 {props.lastOrganizeSummary.created} 条，跳过 {props.lastOrganizeSummary.skipped} 条
            </div>
          )}

          <div className="mt-2 space-y-2">
            {props.entries.length === 0 && <div className="text-muted-foreground">暂无记录</div>}

            {props.entries.map((entry) => (
              <div key={entry.id} className="rounded-md border border-border p-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate text-xs">{formatTimestamp(entry.createdAt)}</div>
                  <div className="shrink-0 text-[11px] text-muted-foreground">{formatMemoryEntryKind(entry.kind)}</div>
                </div>

                <div className="mt-1 whitespace-pre-wrap text-sm">{entry.title}</div>

                {entry.detail && (
                  <div className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{entry.detail}</div>
                )}

                {entry.tags && entry.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {entry.tags.map((tag) => (
                      <span key={tag} className="rounded-md border border-border bg-card px-2 py-0.5 text-[11px]">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
