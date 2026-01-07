import type { ResumeJson } from '@muicv/shared';

import { getResumeSnapshotRetentionLimit } from '@/src/server/resume-snapshot-retention';
import { getResumeStore } from '@/src/server/resume-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEMO_USER_ID = 'demo';

type ResumeRouteContext = {
  params: Promise<{ resumeId: string }>;
};

type GetResumeResponse = {
  resume: {
    id: string;
    userId: string;
    title: string;
    sourceConversationId: string | null;
    createdAt: string;
    updatedAt: string;
  };
  current: ResumeJson | null;
  currentVersionId?: string;
  versions: Array<{
    id: string;
    resumeId: string;
    userId: string;
    createdAt: string;
  }>;
  retentionLimit: number;
};

export async function GET(_request: Request, context: ResumeRouteContext) {
  const { resumeId } = await context.params;

  const store = await getResumeStore();
  const resume = await store.getResume(DEMO_USER_ID, resumeId);
  if (!resume) {
    return Response.json({ message: '简历不存在' }, { status: 404 });
  }

  const retentionLimit = getResumeSnapshotRetentionLimit();
  const currentVersion = await store.getCurrentResumeVersion(DEMO_USER_ID, resumeId);
  const versions = await store.listResumeVersions(DEMO_USER_ID, resumeId);

  const response: GetResumeResponse = {
    current: currentVersion?.resume ?? null,
    retentionLimit,
    resume: {
      createdAt: resume.createdAt,
      id: resume.id,
      sourceConversationId: resume.sourceConversationId,
      title: resume.title,
      updatedAt: resume.updatedAt,
      userId: resume.userId,
    },
    versions: versions.map((version) => ({
      createdAt: version.createdAt,
      id: version.id,
      resumeId: version.resumeId,
      userId: version.userId,
    })),
    ...(currentVersion?.id ? { currentVersionId: currentVersion.id } : {}),
  };

  return Response.json(response);
}

type PatchResumeBody = {
  title?: string;
};

export async function PATCH(request: Request, context: ResumeRouteContext) {
  const { resumeId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as PatchResumeBody;
  const title = body.title?.trim() ?? '';
  if (!title) {
    return Response.json({ message: 'title 不能为空' }, { status: 400 });
  }

  const store = await getResumeStore();
  const resume = await store.getResume(DEMO_USER_ID, resumeId);
  if (!resume) {
    return Response.json({ message: '简历不存在' }, { status: 404 });
  }

  const updated = await store.renameResume(DEMO_USER_ID, resumeId, title);
  return Response.json(updated);
}

export async function DELETE(_request: Request, context: ResumeRouteContext) {
  const { resumeId } = await context.params;
  const store = await getResumeStore();
  const resume = await store.getResume(DEMO_USER_ID, resumeId);
  if (!resume) {
    return Response.json({ message: '简历不存在' }, { status: 404 });
  }

  await store.deleteResume(DEMO_USER_ID, resumeId);
  return Response.json({ ok: true });
}
