import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const dist = path.resolve('dist');
const swPath = path.join(dist, 'sw.js');

function shouldPrecacheFile(name) {
  if (name === 'sw.js' || name.endsWith('.map')) return false;
  // GitHub Pages packaging omits dotfiles such as .gitkeep. Referencing one in
  // cache.addAll() would reject the entire service-worker install.
  if (name.startsWith('.')) return false;
  // Source/docs files are not runtime dependencies and do not belong in the
  // application shell cache.
  if (/\.md$/i.test(name)) return false;
  return true;
}

async function filesUnder(directory, prefix = '') {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;

    const relative = path.posix.join(prefix, entry.name);
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      output.push(...await filesUnder(absolute, relative));
    } else if (shouldPrecacheFile(entry.name)) {
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
