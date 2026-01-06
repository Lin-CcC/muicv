import { getResumeStore } from '@/src/server/resume-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEMO_USER_ID = 'demo';

type RollbackRouteContext = {
  params: Promise<{ snapshotId: string }>;
};

export async function POST(_request: Request, context: RollbackRouteContext) {
  const { snapshotId } = await context.params;
  const store = await getResumeStore();
  const snapshot = await store.rollbackResumeSnapshot(DEMO_USER_ID, snapshotId);
  return Response.json(snapshot, { status: 201 });
}
