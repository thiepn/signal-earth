import { access, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'dist');
const required = [
  'index.html',
  'manifest.webmanifest',
  'sw.js',
  'icons/signal-earth-192.png',
  'icons/signal-earth-512.png',
  'earth/earth-day-2k.webp',
  'data/natural-earth-lowres.geojson',
];

for (const file of required) await access(path.join(dist, file));

const index = await readFile(path.join(dist, 'index.html'), 'utf8');
if (/\/src\/main\.tsx/.test(index)) throw new Error('dist/index.html still references development source.');
if (/localhost|127\.0\.0\.1/.test(index)) throw new Error('dist/index.html contains a local development address.');
if (!/manifest\.webmanifest/.test(index)) throw new Error('PWA manifest link missing from production index.');

const sw = await readFile(path.join(dist, 'sw.js'), 'utf8');
if (sw.includes('__SIGNAL_EARTH_PRECACHE__')) throw new Error('Production service worker still contains the precache placeholder.');
if (!sw.includes('./index.html')) throw new Error('Production service worker does not precache the application shell.');

const manifest = JSON.parse(await readFile(path.join(dist, 'manifest.webmanifest'), 'utf8'));
if (manifest.name !== 'Signal Earth' || manifest.display !== 'standalone') throw new Error('Unexpected PWA manifest metadata.');
if (!Array.isArray(manifest.icons) || manifest.icons.length < 2) throw new Error('PWA icon set is incomplete.');

async function directorySize(directory) {
  let total = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) total += await directorySize(target);
    else total += (await stat(target)).size;
  }
  return total;
}

const bytes = await directorySize(dist);
const budget = 25 * 1024 * 1024;
if (bytes > budget) throw new Error(`Production site is ${(bytes / 1024 / 1024).toFixed(1)} MB; V1 budget is 25 MB.`);
console.log(`Release verification passed: ${(bytes / 1024 / 1024).toFixed(2)} MB production site.`);
