import { cp, mkdir, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'dist');
await mkdir(output, { recursive: true });
// Publish only the public website, not Git metadata or editor settings.
for (const name of await readdir(root)) {
  if (/\.(html|css|js)$/.test(name) || ['images', 'media'].includes(name)) {
    await cp(path.join(root, name), path.join(output, name), { recursive: true });
  }
}
console.log('Static portfolio built in dist/');
