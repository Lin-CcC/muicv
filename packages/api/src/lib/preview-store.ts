import type { TemplateLang, TemplateResumeData } from '@muicv/shared';

export type PreviewShareMode = 'link' | 'public';
export const PREVIEW_SHARE_MODES: readonly PreviewShareMode[] = ['link', 'public'] as const;
export function isPreviewShareMode(value: unknown): value is PreviewShareMode {
  return value === 'link' || value === 'public';
}

export const PREVIEW_TTL_DAYS_OPTIONS = [1, 7, 30] as const;
export type PreviewTtlDays = (typeof PREVIEW_TTL_DAYS_OPTIONS)[number];
export function isPreviewTtlDays(value: unknown): value is PreviewTtlDays {
  return value === 1 || value === 7 || value === 30;
}

export type PreviewRecord = {
  token: string;
  userId: string;
  resume: TemplateResumeData;
  template: string;
  lang: TemplateLang;
  accent: string | null;
  shareMode: PreviewShareMode;
  pdfCredit: number;
  createdAt: number;
  expiresAt: number;
  revokedAt: number | null;
};

export type PreviewStoreEnv = {
  MUICV_API_DB: D1Database;
};

type DbRow = {
  token: string;
  userId: string;
  resumeJson: string;
  template: string;
  lang: string;
  accent: string | null;
  shareMode: string;
  pdfCredit: number;
  createdAt: number;
  expiresAt: number;
  revokedAt: number | null;
};

function rowToRecord(row: DbRow): PreviewRecord {
  return {
    token: row.token,
    userId: row.userId,
    resume: JSON.parse(row.resumeJson) as TemplateResumeData,
    template: row.template,
    lang: row.lang === 'en' ? 'en' : 'zh',
    accent: row.accent,
    shareMode: row.shareMode === 'public' ? 'public' : 'link',
    pdfCredit: row.pdfCredit,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
  };
}

export type CreatePreviewInput = {
  userId: string;
  resume: TemplateResumeData;
  template: string;
  lang: TemplateLang;
  accent?: string;
  shareMode: PreviewShareMode;
  ttlDays: PreviewTtlDays;
};

export async function createPreview(env: PreviewStoreEnv, input: CreatePreviewInput): Promise<PreviewRecord> {
  const token = crypto.randomUUID();
  const now = Date.now();
  const expiresAt = now + input.ttlDays * 24 * 60 * 60 * 1000;
  await env.MUICV_API_DB.prepare(
    `INSERT INTO preview (token, userId, resumeJson, template, lang, accent, shareMode, pdfCredit, createdAt, expiresAt, revokedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, NULL)`,
  )
    .bind(
      token,
      input.userId,
      JSON.stringify(input.resume),
      input.template,
      input.lang,
      input.accent ?? null,
      input.shareMode,
      now,
      expiresAt,
    )
    .run();
  return {
    token,
    userId: input.userId,
    resume: input.resume,
    template: input.template,
    lang: input.lang,
    accent: input.accent ?? null,
    shareMode: input.shareMode,
    pdfCredit: 0,
    createdAt: now,
    expiresAt,
    revokedAt: null,
  };
}

export async function getPreview(env: PreviewStoreEnv, token: string): Promise<PreviewRecord | null> {
  const row = await env.MUICV_API_DB.prepare(
    `SELECT token, userId, resumeJson, template, lang, accent, shareMode, pdfCredit, createdAt, expiresAt, revokedAt
     FROM preview WHERE token = ? LIMIT 1`,
  )
    .bind(token)
    .first<DbRow>();
  return row ? rowToRecord(row) : null;
}

export async function incrementPdfCredit(env: PreviewStoreEnv, token: string): Promise<void> {
  await env.MUICV_API_DB.prepare('UPDATE preview SET pdfCredit = pdfCredit + 1 WHERE token = ?').bind(token).run();
}

export async function revokePreview(env: PreviewStoreEnv, token: string, userId: string): Promise<boolean> {
  const result = await env.MUICV_API_DB.prepare(
    'UPDATE preview SET revokedAt = ? WHERE token = ? AND userId = ? AND revokedAt IS NULL',
  )
    .bind(Date.now(), token, userId)
    .run();
  return (result.meta?.changes ?? 0) > 0;
}

export type PreviewListItem = {
  token: string;
  template: string;
  lang: 'zh' | 'en';
  shareMode: PreviewShareMode;
  pdfCredit: number;
  createdAt: number;
  expiresAt: number;
  revokedAt: number | null;
};

export async function listPreviewsByUser(env: PreviewStoreEnv, userId: string, limit = 50): Promise<PreviewListItem[]> {
  const result = await env.MUICV_API_DB.prepare(
    `SELECT token, template, lang, shareMode, pdfCredit, createdAt, expiresAt, revokedAt
     FROM preview WHERE userId = ? ORDER BY createdAt DESC LIMIT ?`,
  )
    .bind(userId, limit)
    .all<{
      token: string;
      template: string;
      lang: string;
      shareMode: string;
      pdfCredit: number;
      createdAt: number;
      expiresAt: number;
      revokedAt: number | null;
    }>();
  return (result.results ?? []).map((r) => ({
    token: r.token,
    template: r.template,
    lang: r.lang === 'en' ? 'en' : 'zh',
    shareMode: r.shareMode === 'public' ? 'public' : 'link',
    pdfCredit: r.pdfCredit,
    createdAt: r.createdAt,
    expiresAt: r.expiresAt,
    revokedAt: r.revokedAt,
  }));
}

export async function setPreviewShareMode(
  env: PreviewStoreEnv,
  token: string,
  userId: string,
  shareMode: PreviewShareMode,
): Promise<boolean> {
  const result = await env.MUICV_API_DB.prepare('UPDATE preview SET shareMode = ? WHERE token = ? AND userId = ?')
    .bind(shareMode, token, userId)
    .run();
  return (result.meta?.changes ?? 0) > 0;
}

export type SetPreviewTemplateInput = {
  template: string;
  lang?: TemplateLang;
  accent?: string | null;
};

/**
 * owner 在预览页切模板时调用——更新 preview.template，可选同时切 lang / accent。
 * 不动 resumeJson / pdfCredit / expiresAt。只允许 owner 操作。
 */
export async function setPreviewTemplate(
  env: PreviewStoreEnv,
  token: string,
  userId: string,
  input: SetPreviewTemplateInput,
): Promise<boolean> {
  const sets: string[] = ['template = ?'];
  const values: Array<string | null> = [input.template];
  if (input.lang) {
    sets.push('lang = ?');
    values.push(input.lang);
  }
  if (input.accent !== undefined) {
    sets.push('accent = ?');
    values.push(input.accent);
  }
  values.push(token, userId);
  const result = await env.MUICV_API_DB.prepare(`UPDATE preview SET ${sets.join(', ')} WHERE token = ? AND userId = ?`)
    .bind(...values)
    .run();
  return (result.meta?.changes ?? 0) > 0;
}

export async function extendPreview(
  env: PreviewStoreEnv,
  token: string,
  userId: string,
  ttlDays: PreviewTtlDays,
): Promise<number | null> {
  const newExpiresAt = Date.now() + ttlDays * 24 * 60 * 60 * 1000;
  const result = await env.MUICV_API_DB.prepare(
    'UPDATE preview SET expiresAt = ?, revokedAt = NULL WHERE token = ? AND userId = ?',
  )
    .bind(newExpiresAt, token, userId)
    .run();
  return (result.meta?.changes ?? 0) > 0 ? newExpiresAt : null;
}

export function isPreviewActive(rec: PreviewRecord, now = Date.now()): boolean {
  return rec.revokedAt == null && rec.expiresAt > now;
}
