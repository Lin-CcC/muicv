import { getRuntimeEnvValue } from './runtime-env.ts';

const DEFAULT_RESUME_SNAPSHOT_RETENTION = 10;
const MAX_RESUME_SNAPSHOT_RETENTION = 100;

export function getResumeSnapshotRetentionLimit(): number {
  const raw = getRuntimeEnvValue('MUICV_RESUME_SNAPSHOT_LIMIT');
  if (!raw) return DEFAULT_RESUME_SNAPSHOT_RETENTION;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return DEFAULT_RESUME_SNAPSHOT_RETENTION;

  const normalized = Math.floor(parsed);
  if (normalized < 1) return DEFAULT_RESUME_SNAPSHOT_RETENTION;
  if (normalized > MAX_RESUME_SNAPSHOT_RETENTION) return MAX_RESUME_SNAPSHOT_RETENTION;

  return normalized;
}
