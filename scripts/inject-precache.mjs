import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const dist = path.resolve('dist');
const swPath = path.join(dist, 'sw.js');

async function filesUnder(directory, prefix = '') {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = path.posix.join(prefix, entry.name);
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '.vite') continue;
      output.push(...await filesUnder(absolute, relative));
    } else if (entry.name !== 'sw.js' && !entry.name.endsWith('.map')) {
      output.push(`./${relative}`);
    }
  }
  return output;
}

const assets = [...new Set(await filesUnder(dist))].sort();
const sw = await readFile(swPath, 'utf8');
const marker = '/*__SIGNAL_EARTH_PRECACHE__*/[]';
if (!sw.includes(marker)) throw new Error('Service-worker precache marker not found.');
await writeFile(swPath, sw.replace(marker, JSON.stringify(assets)), 'utf8');
console.log(`Injected ${assets.length} production assets into service-worker precache.`);
