import { getResumeStore } from '@/src/server/resume-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEMO_USER_ID = 'demo';

type RollbackRouteContext = {
  params: Promise<{ resumeId: string; versionId: string }>;
};

export async function POST(_request: Request, context: RollbackRouteContext) {
  const { resumeId, versionId } = await context.params;
  const store = await getResumeStore();

  const resume = await store.getResume(DEMO_USER_ID, resumeId);
  if (!resume) {
    return Response.json({ message: '简历不存在' }, { status: 404 });
  }

  const version = await store.rollbackResumeVersion(DEMO_USER_ID, resumeId, versionId);
  return Response.json(version, { status: 201 });
}
