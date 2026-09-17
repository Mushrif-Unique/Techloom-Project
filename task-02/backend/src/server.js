import { app } from './app.js';
import { db } from './db.js';
import { config } from './config.js';
import { cleanup } from './services/inventory.js';
await db.$connect();
const server = app.listen(config.PORT, () => console.info(`API listening on port ${config.PORT}`));
let cleaning = false;
async function sweep() {
  if (cleaning) return;
  cleaning = true;
  try {
    await cleanup();
  } catch {
    console.error('Reservation cleanup failed; will retry.');
  } finally {
    cleaning = false;
  }
}
const timer = setInterval(sweep, config.CLEANUP_INTERVAL_SECONDS * 1000);
timer.unref();
void sweep();
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    clearInterval(timer);
    server.close(async () => {
      await db.$disconnect();
      process.exit(0);
    });
  });
