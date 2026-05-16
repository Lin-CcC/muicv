import * as migration_20260516_031843_initial_cms_schema from './20260516_031843_initial_cms_schema';

export const migrations = [
  {
    up: migration_20260516_031843_initial_cms_schema.up,
    down: migration_20260516_031843_initial_cms_schema.down,
    name: '20260516_031843_initial_cms_schema',
  },
];
