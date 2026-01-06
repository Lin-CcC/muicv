import { tryGetCloudflareEnv } from './cloudflare-bindings.ts';

type EnvRecord = Record<string, unknown>;

function readFromProcessEnv(name: string): string | undefined {
  const value = process.env[name];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function readFromCloudflareEnv(name: string): string | undefined {
  const env = tryGetCloudflareEnv() as unknown as EnvRecord | undefined;
  if (!env) return undefined;

  const value = env[name];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export function getRuntimeEnvValue(name: string): string | undefined {
  return readFromCloudflareEnv(name) ?? readFromProcessEnv(name);
}

export function requireRuntimeEnvValue(name: string): string {
  const value = getRuntimeEnvValue(name);
  if (!value) {
    throw new Error(`缺少环境变量：${name}`);
  }
  return value;
}
