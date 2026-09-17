import EmbeddedPostgres from 'embedded-postgres';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createConnection } from 'node:net';

async function isListening(port) {
  return new Promise((resolve) => {
    const socket = createConnection({ host: '127.0.0.1', port });
    const finish = (listening) => {
      socket.destroy();
      resolve(listening);
    };
    socket.setTimeout(2000);
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.once('timeout', () => finish(false));
  });
}

export async function startLocal(test = false) {
  const directory = path.resolve('.local', test ? 'test' : 'dev');
  await mkdir(directory, { recursive: true });
  const credentialsFile = path.join(directory, 'credentials.json');
  let credentials;
  try {
    credentials = JSON.parse(await readFile(credentialsFile, 'utf8'));
  } catch {
    credentials = { password: randomBytes(24).toString('hex') };
    await writeFile(credentialsFile, JSON.stringify(credentials), { mode: 0o600 });
  }
  const port = test ? 55433 : 55432;
  const startupLogs = [];
  const pg = new EmbeddedPostgres({
    databaseDir: path.join(directory, 'data'),
    user: 'postgres',
    password: credentials.password,
    port,
    persistent: true,
    authMethod: 'scram-sha-256',
    postgresFlags: ['-h', '127.0.0.1'],
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
    onLog: (message) => {
      startupLogs.push(String(message));
      if (startupLogs.length > 15) startupLogs.shift();
    },
    onError: (message) => console.error(String(message)),
  });
  const database = test ? 'atelier_test' : 'atelier';
  const url = `postgresql://postgres:${credentials.password}@127.0.0.1:${port}/${database}?schema=public`;
  if (await isListening(port)) {
    if (test)
      throw new Error(
        `Test database port ${port} is already in use. Wait for the other test run to finish.`,
      );
    const existing = pg.getPgClient(database, '127.0.0.1');
    try {
      await existing.connect();
      const result = await existing.query('SHOW data_directory');
      const normalize = (value) => {
        const resolved = path.resolve(value);
        return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
      };
      if (normalize(result.rows[0].data_directory) !== normalize(path.join(directory, 'data')))
        throw new Error('Different data directory');
    } catch {
      throw new Error(
        `Port ${port} is in use, but this project's database could not be verified. Stop the conflicting service or check the local credentials.`,
      );
    } finally {
      await existing.end();
    }
    return { pg, url, alreadyRunning: true };
  }
  // Graceful native shutdown avoids the package's unreliable taskkill path on Windows.
  if (process.platform === 'win32') {
    const { pg_ctl } = await import('@embedded-postgres/windows-x64');
    pg.stop = async () => {
      if (!pg.process || pg.process.exitCode !== null) return;
      const result = spawnSync(
        pg_ctl,
        ['stop', '-D', path.join(directory, 'data'), '-m', 'fast', '-w'],
        { windowsHide: true, encoding: 'utf8' },
      );
      if (result.status !== 0) throw new Error(`Could not stop local PostgreSQL: ${result.stderr}`);
      pg.process = undefined;
    };
  }
  try {
    await access(path.join(directory, 'data', 'PG_VERSION'));
  } catch {
    await pg.initialise();
  }
  try {
    await pg.start();
  } catch {
    throw new Error(
      `Local PostgreSQL startup failed: ${startupLogs.join('\n')}\nStop the original database terminal with Ctrl+C, or run npm run db:stop from backend, then retry. Do not delete .local/dev/data. If shared memory remains locked after PostgreSQL has stopped, restart Windows and retry.`,
    );
  }
  const client = pg.getPgClient('postgres', '127.0.0.1');
  try {
    await client.connect();
    const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [database]);
    if (!existing.rowCount)
      await client.query(`CREATE DATABASE ${client.escapeIdentifier(database)}`);
  } finally {
    await client.end();
  }
  return {
    pg,
    url,
    alreadyRunning: false,
  };
}
