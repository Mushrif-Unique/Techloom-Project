import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
function parse(text) {
  return Object.fromEntries(
    text
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const at = line.indexOf('=');
        return [line.slice(0, at), line.slice(at + 1)];
      }),
  );
}
function create(path, content) {
  if (existsSync(path)) {
    console.log(`Kept existing ${path}`);
    return;
  }
  writeFileSync(path, content);
  console.log(`Created ${path}`);
}
let root = readFileSync('.env.example', 'utf8');
if (!existsSync('.env')) {
  const password = randomBytes(24).toString('hex');
  root = root
    .replace('replace-with-a-random-password', password)
    .replace('pos:REPLACE@', `pos:${password}@`)
    .replace(
      'replace-with-a-random-key-of-at-least-32-characters',
      randomBytes(24).toString('hex'),
    );
}
create('.env', root);
const values = parse(readFileSync('.env', 'utf8'));
const url = `postgresql://${encodeURIComponent(values.POSTGRES_USER)}:${encodeURIComponent(values.POSTGRES_PASSWORD)}@localhost:${values.POSTGRES_PORT}/${values.POSTGRES_DB}?schema=public&connection_limit=30&pool_timeout=30`;
let backend = readFileSync('backend/.env.example', 'utf8');
backend = backend
  .replace(/^DATABASE_URL=.*$/m, `DATABASE_URL=${url}`)
  .replace(
    /^TEST_DATABASE_URL=.*$/m,
    `TEST_DATABASE_URL=${url.replace('/' + values.POSTGRES_DB + '?', '/' + values.POSTGRES_DB + '_test?')}`,
  );
create('backend/.env', backend);
create('frontend/.env', readFileSync('frontend/.env.example', 'utf8'));
console.log(
  'Local configuration ready. Review ports in the generated files before starting services.',
);
