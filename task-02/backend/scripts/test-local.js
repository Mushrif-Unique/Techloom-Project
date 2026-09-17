import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { startLocal } from './local-postgres.js';
const { pg, url } = await startLocal(true);
const env = {
  ...process.env,
  DATABASE_URL: url,
  TEST_DATABASE_URL: url,
  JWT_SECRET: randomBytes(48).toString('hex'),
  FRONTEND_URL: 'http://localhost:5173',
  NODE_ENV: 'test',
};
function run(file, args) {
  const result = spawnSync(process.execPath, [file, ...args], {
    env,
    stdio: 'inherit',
    windowsHide: true,
  });
  if (result.status !== 0) throw new Error(`Command failed with code ${result.status}`);
}
try {
  run('node_modules/prisma/build/index.js', ['migrate', 'deploy']);
  run('node_modules/vitest/vitest.mjs', ['run']);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await pg.stop();
}
