import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { DatabaseSync } from 'node:sqlite';

type AppliedMigrationRow = {
  id: string;
};

export type ApplySqliteMigrationsParams = {
  database: DatabaseSync;
  migrationsDirectoryPath: string;
};

export function applySqliteMigrations(params: ApplySqliteMigrationsParams) {
  params.database.exec(`
    CREATE TABLE IF NOT EXISTS __muicv_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedRows = params.database
    .prepare('SELECT id FROM __muicv_migrations ORDER BY id')
    .all() as AppliedMigrationRow[];
  const applied = new Set(appliedRows.map((row) => row.id));

  const migrationFileNames = readdirSync(params.migrationsDirectoryPath)
    .filter((name) => name.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));

  const insert = params.database.prepare('INSERT INTO __muicv_migrations (id, applied_at) VALUES (?, ?)');

  for (const name of migrationFileNames) {
    if (applied.has(name)) continue;

    const fullPath = resolve(params.migrationsDirectoryPath, name);
    const sql = readFileSync(fullPath, 'utf8');
    params.database.exec(sql);
    insert.run(name, new Date().toISOString());
  }
}
