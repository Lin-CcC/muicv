import { getCloudflareContext } from '@opennextjs/cloudflare';

export function tryGetCloudflareEnv(): CloudflareEnv | undefined {
  try {
    return getCloudflareContext().env;
  } catch {
    return undefined;
  }
}

export function getRequiredMuicvDatabase(env: CloudflareEnv) {
  if (!env.MUICV_DB) {
    throw new Error('缺少 Cloudflare D1 绑定：MUICV_DB（请检查 wrangler.jsonc 的 d1_databases 配置）');
  }

  return env.MUICV_DB;
}
