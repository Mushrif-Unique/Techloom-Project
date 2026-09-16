import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
function create(path, content) {
  if (existsSync(path)) return console.log(`Kept existing ${path}`);
  writeFileSync(path, content);
  console.log(`Created ${path}`);
}
const password = randomBytes(24).toString('hex');
const url = `postgresql://pos:${password}@127.0.0.1:5439/pos?schema=public&connection_limit=30&pool_timeout=30`;
create(
  'backend/.env',
  readFileSync('backend/.env.example', 'utf8')
    .replace(/^DATABASE_URL=.*$/m, `DATABASE_URL=${url}`)
    .replace(
      /^TEST_DATABASE_URL=.*$/m,
      `TEST_DATABASE_URL=${url.replace('/pos?', '/pos_test?')}`,
    ),
);
create('frontend/.env', readFileSync('frontend/.env.example', 'utf8'));
console.log('Configuration ready. Run npm run db:start for local PostgreSQL.');
