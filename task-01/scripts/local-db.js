import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  chmodSync,
} from 'node:fs';
import { resolve, normalize } from 'node:path';
import { execFileSync } from 'node:child_process';
import dotenv from 'dotenv';
import pg from 'pg';

const action = process.argv[2];
if (!['start', 'stop', 'status'].includes(action))
  throw new Error('Use start, stop or status.');
const dataDir = resolve('.local/postgres/data');
const env = dotenv.parse(readFileSync('backend/.env'));
const url = new URL(env.DATABASE_URL);
const canonical = (path) =>
  process.platform === 'win32'
    ? normalize(path).toLowerCase()
    : normalize(path);
const connection = {
  host: '127.0.0.1',
  port: Number(url.port || 5432),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: 'postgres',
  connectionTimeoutMillis: 2000,
};
const platform = process.platform === 'win32' ? 'windows' : process.platform;
const {
  pg_ctl: pgCtl,
  initdb,
  postgres,
} = await import(`@embedded-postgres/${platform}-${process.arch}`);
function control(args) {
  return (
    execFileSync(pgCtl, ['-D', dataDir, ...args], {
      encoding: 'utf8',
      windowsHide: true,
      // A Windows server can inherit pipe handles from pg_ctl. Inherit the
      // terminal streams for startup so Node does not wait on those open pipes.
      ...(args[0] === 'start' ? { stdio: 'inherit' } : {}),
    }) || ''
  );
}
// Query the server first: process visibility can differ between Windows shells.
// Never launch a second server merely because pg_ctl cannot see the first PID.
async function isRunning() {
  const probe = new pg.Client(connection);
  try {
    await probe.connect();
    const actual = (await probe.query('SHOW data_directory')).rows[0]
      .data_directory;
    if (canonical(actual) !== canonical(dataDir))
      throw new Error(
        'Port belongs to another PostgreSQL cluster. Check backend/.env.',
      );
    return true;
  } catch (error) {
    if (error.code !== 'ECONNREFUSED') throw error;
  } finally {
    await probe.end();
  }
  if (!existsSync(resolve(dataDir, 'postmaster.pid'))) return false;
  try {
    control(['status']);
    return true;
  } catch (error) {
    // pg_ctl reports exit code 3 when no server is running.
    // PostgreSQL itself handles stale PID files when starting.
    if (error.status === 3) return false;
    throw error;
  }
}
if (action === 'stop' || action === 'status') {
  if (!(await isRunning())) {
    console.log('Local PostgreSQL is stopped.');
  } else {
    console.log(
      action === 'stop'
        ? control(['stop', '-m', 'fast', '-w'])
        : 'Local PostgreSQL is running (verified database connection).',
    );
  }
} else {
  const test = new URL(env.TEST_DATABASE_URL);
  if (
    !['localhost', '127.0.0.1'].includes(url.hostname) ||
    url.host !== test.host ||
    url.username !== test.username ||
    url.password !== test.password ||
    !test.pathname.endsWith('_test') ||
    test.pathname === url.pathname
  ) {
    throw new Error(
      'Native startup requires matching local database URLs and a separate _test database.',
    );
  }
  const port = Number(url.port || 5432);
  mkdirSync(resolve('.local/postgres'), { recursive: true });
  if (process.platform !== 'win32') {
    for (const binary of [pgCtl, initdb, postgres]) chmodSync(binary, 0o755);
  }
  if (!existsSync(resolve(dataDir, 'PG_VERSION'))) {
    mkdirSync(dataDir, { recursive: true });
    const passwordFile = resolve('.local/postgres/init-password');
    writeFileSync(passwordFile, decodeURIComponent(url.password) + '\n', {
      mode: 0o600,
    });
    try {
      execFileSync(
        initdb,
        [
          '-D',
          dataDir,
          '--auth=scram-sha-256',
          '--username=' + decodeURIComponent(url.username),
          '--pwfile=' + passwordFile,
          '--encoding=UTF8',
          '--locale=C',
        ],
        { stdio: 'inherit', windowsHide: true },
      );
    } finally {
      unlinkSync(passwordFile);
    }
  }
  if (!(await isRunning())) {
    console.log(
      control([
        'start',
        '-l',
        resolve('.local/postgres/server.log'),
        '-o',
        `-h 127.0.0.1 -p ${port}`,
        '-w',
        '-t',
        '60',
      ]),
    );
  } else {
    console.log('Reusing the running local PostgreSQL server.');
  }
  const client = new pg.Client({
    host: '127.0.0.1',
    port,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: 'postgres',
  });
  let connected = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    const probe = new pg.Client({
      host: '127.0.0.1',
      port,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: 'postgres',
      connectionTimeoutMillis: 1000,
    });
    try {
      await probe.connect();
      connected = true;
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    } finally {
      await probe.end();
    }
  }
  if (!connected)
    throw new Error(
      'PostgreSQL did not become ready. See .local/postgres/server.log.',
    );
  await client.connect();
  try {
    const actual = (await client.query('SHOW data_directory')).rows[0]
      .data_directory;
    if (canonical(actual) !== canonical(dataDir))
      throw new Error(
        'Port belongs to another PostgreSQL cluster. Check backend/.env.',
      );
    for (const entry of [url, test]) {
      const name = decodeURIComponent(entry.pathname.slice(1));
      if (
        !(
          await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [
            name,
          ])
        ).rowCount
      ) {
        await client.query('CREATE DATABASE ' + client.escapeIdentifier(name));
      }
    }
    console.log(
      `Local PostgreSQL ready on 127.0.0.1:${port}. Data persists in .local/postgres/data.`,
    );
  } finally {
    await client.end();
  }
}
