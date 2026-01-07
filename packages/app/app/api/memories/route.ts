import type { MemoryEntry } from '@muicv/shared';
import { getMemoryStore } from '@/src/server/memory-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEMO_USER_ID = 'demo';

function parseLimit(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  const normalized = Math.floor(parsed);
  return normalized > 0 ? normalized : undefined;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const conversationId = url.searchParams.get('conversationId')?.trim() ?? '';
  const limit = parseLimit(url.searchParams.get('limit'));

  const store = await getMemoryStore();
  const entries: MemoryEntry[] = await store.listMemoryEntries(DEMO_USER_ID, {
    ...(limit ? { limit } : {}),
    ...(conversationId ? { conversationId } : {}),
  });

  return Response.json(entries);
}
