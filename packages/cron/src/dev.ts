import { setTimeout as sleep } from 'node:timers/promises';

async function main() {
  console.log('[cron] dev 占位脚本：后续接入 Cloudflare Cron Trigger');
  await sleep(50);
  console.log('[cron] done');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
