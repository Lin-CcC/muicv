import type { ResumeJson } from '@muicv/shared';
import { getResumeSnapshotRetentionLimit } from '@/src/server/resume-snapshot-retention';
import { getResumeStore } from '@/src/server/resume-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEMO_USER_ID = 'demo';

type ResumeApiResponse = {
  current: ResumeJson | null;
  currentSnapshotId?: string;
  snapshots: Array<{
    id: string;
    conversationId: string | null;
    createdAt: string;
  }>;
  retentionLimit: number;
};

function isResumeJson(value: unknown): value is ResumeJson {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return record.version === 1 && typeof record.lastUpdatedAt === 'string' && typeof record.basicInfo === 'object';
}

export async function GET() {
  const store = await getResumeStore();
  const retentionLimit = getResumeSnapshotRetentionLimit();

  const currentSnapshot = await store.getCurrentResume(DEMO_USER_ID);
  const snapshots = await store.listResumeSnapshots(DEMO_USER_ID);

  const response: ResumeApiResponse = {
    current: currentSnapshot?.resume ?? null,
    retentionLimit,
    snapshots: snapshots.map((snapshot) => ({
      conversationId: snapshot.conversationId,
      createdAt: snapshot.createdAt,
      id: snapshot.id,
    })),
    ...(currentSnapshot?.id ? { currentSnapshotId: currentSnapshot.id } : {}),
  };

  return Response.json(response);
}

type SaveResumeBody = {
  resume?: unknown;
  conversationId?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as SaveResumeBody;
  if (!body.resume || !isResumeJson(body.resume)) {
    return Response.json({ message: 'resume 格式不正确' }, { status: 400 });
  }

  const store = await getResumeStore();
  const conversationId = body.conversationId?.trim();
  const snapshot = await store.saveResumeSnapshot({
    resume: body.resume,
    userId: DEMO_USER_ID,
    ...(conversationId ? { conversationId } : {}),
  });

  return Response.json(snapshot, { status: 201 });
}
