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

export type PhotoUploadItem = {
  id: number;
  r2Key: string;
  url: string;
  contentType: string;
  sizeBytes: number;
  originalName: string | null;
  createdAt: number;
};

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
