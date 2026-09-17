import { startLocal } from './local-postgres.js';
import { access, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
const { pg, url, alreadyRunning } = await startLocal();
if (alreadyRunning) {
  console.info(
    "This project's PostgreSQL is already running at 127.0.0.1:55432. Reuse it and start the API/frontend in other terminals. To stop it, use Ctrl+C in its original terminal or npm run db:stop --prefix backend from the project root.",
  );
  process.exit(0);
}
try {
  await access('.env');
  console.info(
    'Existing .env preserved. Local database settings are saved in .local/dev/database.env.',
  );
} catch {
  await writeFile(
    '.env',
    `DATABASE_URL=${url}\nJWT_SECRET=${randomBytes(48).toString('hex')}\nFRONTEND_URL=http://localhost:5173\nPORT=4000\nRESERVATION_TTL_MINUTES=10\n`,
    { mode: 0o600 },
  );
  console.info('Created local .env with generated credentials.');
}
await writeFile('.local/dev/database.env', `DATABASE_URL=${url}\n`, { mode: 0o600 });
console.info('Native PostgreSQL running at 127.0.0.1:55432. Leave this terminal open.');
pg.process.once('exit', (code) => {
  console.info('Local PostgreSQL stopped.');
  process.exit(code === 0 ? 0 : 1);
});
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, async () => {
    await pg.stop();
    process.exit(0);
  });
setInterval(() => {}, 60000);
