import { getResumeStore } from '@/src/server/resume-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEMO_USER_ID = 'demo';

export async function GET() {
  const store = await getResumeStore();
  const resumes = await store.listResumes(DEMO_USER_ID);
  return Response.json(resumes);
}

type CreateResumeBody = {
  title?: string;
  sourceConversationId?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as CreateResumeBody;
  const title = body.title?.trim();
  const sourceConversationId = body.sourceConversationId?.trim();

  const nowIso = new Date().toISOString();
  const store = await getResumeStore();
  const created = await store.createResumeWithVersion({
    resume: {
      basicInfo: {},
      lastUpdatedAt: nowIso,
      version: 1,
    },
    userId: DEMO_USER_ID,
    ...(title ? { title } : {}),
    ...(sourceConversationId ? { sourceConversationId } : {}),
  });

  return Response.json(created, { status: 201 });
}
