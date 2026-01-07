import type { MemoryEntry } from '@muicv/shared';

import type { AiProviderId } from '@/src/server/ai/ai-service';
import { organizeMemoryEntries } from '@/src/server/ai/memory-organizer';
import { getMemoryStore } from '@/src/server/memory-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEMO_USER_ID = 'demo';

type OrganizeMemoriesBody = {
  conversationId?: string;
  provider?: AiProviderId;
  model?: string;
  limit?: number;
};

type OrganizeMemoriesResponse = {
  createdEntries: MemoryEntry[];
  skipped: number;
};

function normalizeLimit(value: number | undefined) {
  if (value === undefined) return 30;
  if (!Number.isFinite(value)) return 30;
  const normalized = Math.floor(value);
  if (normalized <= 0) return 30;
  return Math.min(80, normalized);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as OrganizeMemoriesBody;
    const conversationId = body.conversationId?.trim();
    const limit = normalizeLimit(body.limit);

    const store = await getMemoryStore();
    const existing = await store.listMemoryEntries(DEMO_USER_ID, {
      ...(conversationId ? { conversationId } : {}),
      limit,
    });

    if (existing.length === 0) {
      const empty: OrganizeMemoriesResponse = { createdEntries: [], skipped: 0 };
      return Response.json(empty);
    }

    const result = await organizeMemoryEntries({
      entries: existing,
      maxInputEntries: limit,
      nowIso: new Date().toISOString(),
      ...(body.provider ? { provider: body.provider } : {}),
      ...(body.model?.trim() ? { model: body.model.trim() } : {}),
    });

    const existingKeys = new Set(existing.map((entry) => `${entry.kind}::${entry.title}`));
    const draftsToCreate = result.entries.filter((draft) => {
      const key = `${draft.kind}::${draft.title}`;
      if (existingKeys.has(key)) return false;
      existingKeys.add(key);
      return true;
    });

    if (draftsToCreate.length === 0) {
      const empty: OrganizeMemoriesResponse = { createdEntries: [], skipped: result.entries.length };
      return Response.json(empty);
    }

    const createdEntries = await store.addMemoryEntries(
      draftsToCreate.map((draft) => ({
        ...draft,
        userId: DEMO_USER_ID,
        ...(conversationId ? { conversationId } : {}),
      })),
    );

    const response: OrganizeMemoriesResponse = {
      createdEntries,
      skipped: result.entries.length - draftsToCreate.length,
    };
    return Response.json(response, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '整理失败';
    return Response.json({ message }, { status: 500 });
  }
}
