import { and, desc, eq } from 'drizzle-orm';

import { getDb, schema } from './db';

export type PreviewStatus = 'active' | 'expired' | 'revoked';

export type PreviewListItem = {
  token: string;
  template: string;
  lang: 'zh' | 'en';
  shareMode: 'link' | 'public';
  pdfCredit: number;
  createdAt: number;
  expiresAt: number;
  revokedAt: number | null;
  status: PreviewStatus;
  url: string;
};

const SITE_BASE = 'https://muicv.com';

function deriveStatus(row: { revokedAt: number | null; expiresAt: number }, now = Date.now()): PreviewStatus {
  if (row.revokedAt != null) return 'revoked';
  if (row.expiresAt <= now) return 'expired';
  return 'active';
}

export async function listUserPreviews(userId: string, limit = 50): Promise<PreviewListItem[]> {
  const db = await getDb();
  const rows = await db
    .select({
      token: schema.preview.token,
      template: schema.preview.template,
      lang: schema.preview.lang,
      shareMode: schema.preview.shareMode,
      pdfCredit: schema.preview.pdfCredit,
      createdAt: schema.preview.createdAt,
      expiresAt: schema.preview.expiresAt,
      revokedAt: schema.preview.revokedAt,
    })
    .from(schema.preview)
    .where(eq(schema.preview.userId, userId))
    .orderBy(desc(schema.preview.createdAt))
    .limit(limit);
  const now = Date.now();
  return rows.map((r) => ({
    token: r.token,
    template: r.template,
    lang: r.lang === 'en' ? 'en' : 'zh',
    shareMode: r.shareMode === 'public' ? 'public' : 'link',
    pdfCredit: r.pdfCredit,
    createdAt: r.createdAt,
    expiresAt: r.expiresAt,
    revokedAt: r.revokedAt,
    status: deriveStatus(r, now),
    url: `${SITE_BASE}/preview/${r.token}`,
  }));
}

export async function revokeUserPreview(userId: string, token: string): Promise<boolean> {
  const db = await getDb();
  const result = await db
    .update(schema.preview)
    .set({ revokedAt: Date.now() })
    .where(and(eq(schema.preview.token, token), eq(schema.preview.userId, userId)))
    .returning({ token: schema.preview.token });
  return result.length > 0;
}

export type PreviewTtlDays = 1 | 7 | 30;
export function isPreviewTtlDays(value: unknown): value is PreviewTtlDays {
  return value === 1 || value === 7 || value === 30;
}

export async function extendUserPreview(
  userId: string,
  token: string,
  ttlDays: PreviewTtlDays,
): Promise<number | null> {
  const db = await getDb();
  const newExpiresAt = Date.now() + ttlDays * 24 * 60 * 60 * 1000;
  const result = await db
    .update(schema.preview)
    .set({ expiresAt: newExpiresAt, revokedAt: null })
    .where(and(eq(schema.preview.token, token), eq(schema.preview.userId, userId)))
    .returning({ token: schema.preview.token });
  return result.length > 0 ? newExpiresAt : null;
}

export type PreviewShareMode = 'link' | 'public';
export function isPreviewShareMode(value: unknown): value is PreviewShareMode {
  return value === 'link' || value === 'public';
}

export async function setUserPreviewShareMode(
  userId: string,
  token: string,
  shareMode: PreviewShareMode,
): Promise<boolean> {
  const db = await getDb();
  const result = await db
    .update(schema.preview)
    .set({ shareMode })
    .where(and(eq(schema.preview.token, token), eq(schema.preview.userId, userId)))
    .returning({ token: schema.preview.token });
  return result.length > 0;
}

export type SetUserPreviewTemplateInput = {
  template: string;
  lang?: 'zh' | 'en';
  accent?: string | null;
};

/**
 * owner 在预览页切模板时调用，仅当 token 属于 userId 才更新。
 * 不动 resumeJson / expiresAt / pdfCredit，PDF 渲染才扣费。
 */
export async function setUserPreviewTemplate(
  userId: string,
  token: string,
  input: SetUserPreviewTemplateInput,
): Promise<boolean> {
  const db = await getDb();
  const patch: { template: string; lang?: 'zh' | 'en'; accent?: string | null } = { template: input.template };
  if (input.lang) patch.lang = input.lang;
  if (input.accent !== undefined) patch.accent = input.accent;
  const result = await db
    .update(schema.preview)
    .set(patch)
    .where(and(eq(schema.preview.token, token), eq(schema.preview.userId, userId)))
    .returning({ token: schema.preview.token });
  return result.length > 0;
}

/**
 * owner 在预览页换头像后调用：把 resumeJson 里的 photoUrl 字段更新成新 URL，
 * 其它字段不动。返回 true 表示更新了一行，false 表示 token 不属于这个 user。
 *
 * 设计：preview.resumeJson 是 TemplateResumeData 序列化，photoUrl 是顶层字段
 * （详见 packages/shared/src/domain/template-resume.ts）。我们读出来 → patch
 * → 写回，不用做 schema 校验（值已经在 R2，URL 由我们颁发）。
 */
export async function setUserPreviewPhotoUrl(userId: string, token: string, photoUrl: string | null): Promise<boolean> {
  const db = await getDb();
  const rows = await db
    .select({ resumeJson: schema.preview.resumeJson })
    .from(schema.preview)
    .where(and(eq(schema.preview.token, token), eq(schema.preview.userId, userId)))
    .limit(1);
  const row = rows[0];
  if (!row) return false;
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(row.resumeJson) as Record<string, unknown>;
  } catch {
    return false;
  }
  if (photoUrl) {
    parsed.photoUrl = photoUrl;
  } else {
    delete parsed.photoUrl;
  }
  const next = JSON.stringify(parsed);
  const updated = await db
    .update(schema.preview)
    .set({ resumeJson: next })
    .where(and(eq(schema.preview.token, token), eq(schema.preview.userId, userId)))
    .returning({ token: schema.preview.token });
  return updated.length > 0;
}

export type PhotoUploadItem = {
  id: number;
  r2Key: string;
  url: string;
  contentType: string;
  sizeBytes: number;
  originalName: string | null;
  createdAt: number;
};

/**
 * 删一行 photoUpload 审计（仅当属于此 userId）。返回被删的 r2Key 供调用方
 * 一并清 R2 对象；找不到或不属于 user 返回 null。
 */
export async function deleteUserPhotoUpload(userId: string, id: number): Promise<string | null> {
  const db = await getDb();
  const result = await db
    .delete(schema.photoUpload)
    .where(and(eq(schema.photoUpload.id, id), eq(schema.photoUpload.userId, userId)))
    .returning({ r2Key: schema.photoUpload.r2Key });
  return result[0]?.r2Key ?? null;
}

export async function insertUserPhotoUpload(input: {
  userId: string;
  r2Key: string;
  url: string;
  contentType: string;
  sizeBytes: number;
  originalName: string | null;
  createdAt: number;
}): Promise<PhotoUploadItem> {
  const db = await getDb();
  const result = await db.insert(schema.photoUpload).values(input).returning({ id: schema.photoUpload.id });
  const id = result[0]?.id ?? 0;
  return { id, ...input };
}

export async function listUserPhotoUploads(userId: string, limit = 50): Promise<PhotoUploadItem[]> {
  const db = await getDb();
  const rows = await db
    .select({
      id: schema.photoUpload.id,
      r2Key: schema.photoUpload.r2Key,
      url: schema.photoUpload.url,
      contentType: schema.photoUpload.contentType,
      sizeBytes: schema.photoUpload.sizeBytes,
      originalName: schema.photoUpload.originalName,
      createdAt: schema.photoUpload.createdAt,
    })
    .from(schema.photoUpload)
    .where(eq(schema.photoUpload.userId, userId))
    .orderBy(desc(schema.photoUpload.createdAt))
    .limit(limit);
  return rows;
}
