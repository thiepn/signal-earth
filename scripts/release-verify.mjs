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

const precacheMatch = sw.match(/const GENERATED_PRECACHE = (\[[^;]*\]);/);
if (!precacheMatch) throw new Error('Production service worker does not expose a generated precache list.');
const precache = JSON.parse(precacheMatch[1]);
if (!Array.isArray(precache) || precache.length === 0) throw new Error('Production service-worker precache is empty.');

for (const entry of precache) {
  if (typeof entry !== 'string' || !entry.startsWith('./')) throw new Error(`Invalid precache entry: ${String(entry)}`);
  const relative = entry.slice(2);
  const segments = relative.split('/');
  if (segments.some((segment) => segment.startsWith('.'))) throw new Error(`Hidden file must not be precached: ${entry}`);
  if (/\.map$/i.test(relative) || /\.md$/i.test(relative) || relative === 'sw.js') throw new Error(`Non-runtime file must not be precached: ${entry}`);
  await access(path.join(dist, relative));
}

for (const requiredEntry of ['./index.html', './manifest.webmanifest']) {
  if (!precache.includes(requiredEntry)) throw new Error(`Required application-shell asset missing from precache: ${requiredEntry}`);
}
if (!precache.some((entry) => /^\.\/assets\/.*\.js$/.test(entry))) throw new Error('Production JavaScript entry missing from precache.');
if (!precache.some((entry) => /^\.\/assets\/.*\.css$/.test(entry))) throw new Error('Production stylesheet bundle missing from precache.');
if (precache.some((entry) => /worker.*\.js$/i.test(entry))) throw new Error('Async orbit worker must be runtime-cached, not startup-precached.');
if (precache.some((entry) => /(?:Impl|GlobeViewportBase).*\.js$/i.test(entry))) throw new Error('Lazy feature chunk leaked into startup precache.');
if (precache.length > 16) throw new Error(`Startup precache contains ${precache.length} assets; Phase 25 budget is 16.`);

const assetFiles = await readdir(path.join(dist, 'assets'));
if (!assetFiles.some((name) => /^orbit\.worker-.*\.js$/i.test(name))) throw new Error('Production orbit worker bundle is missing.');

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
console.log(`Release verification passed: ${(bytes / 1024 / 1024).toFixed(2)} MB production site with ${precache.length} startup-shell precache entries.`);
