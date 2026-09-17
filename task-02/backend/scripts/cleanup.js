import '../src/config.js';
import { cleanup } from '../src/services/inventory.js';
import { db } from '../src/db.js';
try {
  while ((await cleanup()) === 100) {
    /* Drain expired batches. */
  }
} finally {
  await db.$disconnect();
}
