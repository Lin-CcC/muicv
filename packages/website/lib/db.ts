import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';

import * as schema from './schema';

/** Drizzle DB client，绑定 Cloudflare D1（muicv 库）。 */
export async function getDb() {
  const { env } = await getCloudflareContext({ async: true });
  return drizzle(env.MUICV_DB, { schema });
}

export { schema };
