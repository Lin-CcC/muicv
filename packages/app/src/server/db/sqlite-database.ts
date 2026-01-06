import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { DatabaseSync } from 'node:sqlite';

import { applySqliteMigrations } from './sqlite-migrations.ts';

export function getAppPackageRootPath() {
  const envRoot = process.env.MUICV_APP_ROOT;
  if (envRoot) return envRoot;

  return findAppPackageRoot(process.cwd()) ?? process.cwd();
}

export function getDefaultMigrationsDirectoryPath() {
  return join(getAppPackageRootPath(), 'migrations');
}

export function getDefaultSqliteDatabaseFilePath() {
  return join(getAppPackageRootPath(), '.data', 'muicv.sqlite');
}

type PackageJson = {
  name?: unknown;
};

function looksLikeAppPackageRoot(directoryPath: string) {
  const packageJsonPath = join(directoryPath, 'package.json');
  if (!existsSync(packageJsonPath)) return false;

  try {
    const raw = readFileSync(packageJsonPath, 'utf8');
    const parsed = JSON.parse(raw) as PackageJson;
    return parsed.name === '@muicv/app';
  } catch {
    return false;
  }
}

function findAppPackageRoot(startDirectoryPath: string) {
  let currentDirectoryPath = startDirectoryPath;

  for (let i = 0; i < 10; i += 1) {
    if (looksLikeAppPackageRoot(currentDirectoryPath)) return currentDirectoryPath;

    const parentDirectoryPath = dirname(currentDirectoryPath);
    if (parentDirectoryPath === currentDirectoryPath) return undefined;

    currentDirectoryPath = parentDirectoryPath;
  }

  return undefined;
}

export type OpenSqliteDatabaseParams = {
  databaseFilePath: string;
  migrationsDirectoryPath: string;
};

export function openSqliteDatabase(params: OpenSqliteDatabaseParams) {
  mkdirSync(dirname(params.databaseFilePath), { recursive: true });

  const database = new DatabaseSync(params.databaseFilePath, {
    enableForeignKeyConstraints: true,
  });

  applySqliteMigrations({
    database,
    migrationsDirectoryPath: params.migrationsDirectoryPath,
  });

  return database;
}
