import type { ResumeJson } from '@muicv/shared';

import { getResumeStore } from '@/src/server/resume-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEMO_USER_ID = 'demo';

type ResumeVersionsRouteContext = {
  params: Promise<{ resumeId: string }>;
};

function isResumeJson(value: unknown): value is ResumeJson {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return record.version === 1 && typeof record.lastUpdatedAt === 'string' && typeof record.basicInfo === 'object';
}

export async function GET(_request: Request, context: ResumeVersionsRouteContext) {
  const { resumeId } = await context.params;
  const store = await getResumeStore();

  const resume = await store.getResume(DEMO_USER_ID, resumeId);
  if (!resume) {
    return Response.json({ message: '简历不存在' }, { status: 404 });
  }

  const versions = await store.listResumeVersions(DEMO_USER_ID, resumeId);
  return Response.json(versions);
}

type SaveResumeVersionBody = {
  resume?: unknown;
};

export async function POST(request: Request, context: ResumeVersionsRouteContext) {
  const { resumeId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as SaveResumeVersionBody;
  if (!body.resume || !isResumeJson(body.resume)) {
    return Response.json({ message: 'resume 格式不正确' }, { status: 400 });
  }

  const store = await getResumeStore();
  const resume = await store.getResume(DEMO_USER_ID, resumeId);
  if (!resume) {
    return Response.json({ message: '简历不存在' }, { status: 404 });
  }

  const version = await store.saveResumeVersion({
    resume: body.resume,
    resumeId,
    userId: DEMO_USER_ID,
  });

  return Response.json(version, { status: 201 });
}
