import { config } from 'dotenv';
import { execFileSync } from 'node:child_process';
config({ path: 'backend/.env', quiet: true });
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_test'))
  throw new Error(
    'TEST_DATABASE_URL must reference a dedicated database ending in _test.',
  );
execFileSync(
  process.execPath,
  [
    'node_modules/prisma/build/index.js',
    'migrate',
    'deploy',
    '--schema',
    'backend/prisma/schema.prisma',
  ],
  { stdio: 'inherit', env: { ...process.env, DATABASE_URL: url } },
);
