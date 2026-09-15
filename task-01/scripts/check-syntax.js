import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
function check(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) check(path);
    else if (path.endsWith('.js'))
      execFileSync(process.execPath, ['--check', path], { stdio: 'inherit' });
  }
}
check('src');
console.log('Backend JavaScript syntax checks passed.');
