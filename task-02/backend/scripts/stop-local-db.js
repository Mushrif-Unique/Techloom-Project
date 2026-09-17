import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// Address only this checkout's development cluster, never all PostgreSQL processes.
const backend = fileURLToPath(new URL('../', import.meta.url));
const directory = path.join(backend, '.local', 'dev', 'data');
const platform = process.platform === 'win32' ? 'windows' : process.platform;
const { pg_ctl: binary } = await import(`@embedded-postgres/${platform}-${process.arch}`);
const options = { windowsHide: true, encoding: 'utf8' };
const status = spawnSync(binary, ['status', '-D', directory], options);
if (status.error) throw status.error;
if (status.status === 3 || status.status === 4) {
  console.info("This project's local PostgreSQL is not running. No data was changed.");
} else if (status.status !== 0) {
  throw new Error(status.stderr || 'Could not determine local PostgreSQL status.');
} else {
  const result = spawnSync(
    binary,
    ['stop', '-D', directory, '-m', 'fast', '-w', '-t', '30'],
    options,
  );
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || 'Could not stop local PostgreSQL.');
  console.info('Local PostgreSQL stopped gracefully. Existing data was preserved.');
}
