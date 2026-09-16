import { access, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'dist');
const packageMetadata = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const required = [
  'index.html',
  'manifest.webmanifest',
  'release.json',
  'sw.js',
  'icons/signal-earth-192.png',
  'icons/signal-earth-512.png',
  'icons/signal-earth-maskable-512.png',
  'earth/earth-day-2k.webp',
  'data/natural-earth-lowres.geojson',
];

for (const file of required) await access(path.join(dist, file));

async function listFiles(directory, prefix = '') {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await listFiles(target, relative));
    else output.push(relative);
  }
  return output;
}

const productionFiles = await listFiles(dist);
const sourceMaps = productionFiles.filter((file) => file.endsWith('.map'));
if (sourceMaps.length) throw new Error(`Production artifact contains source maps: ${sourceMaps.join(', ')}`);
if (productionFiles.some((file) => /(^|\/)\.DS_Store$/.test(file))) throw new Error('Production artifact contains .DS_Store.');

const index = await readFile(path.join(dist, 'index.html'), 'utf8');
if (/\/src\/main\.tsx/.test(index)) throw new Error('dist/index.html still references development source.');
if (/localhost|127\.0\.0\.1/.test(index)) throw new Error('dist/index.html contains a local development address.');
if (!/manifest\.webmanifest/.test(index)) throw new Error('PWA manifest link missing from production index.');
if (!/name=["']theme-color["']/i.test(index)) throw new Error('Theme-color metadata missing from production index.');
if (!/rel=["']apple-touch-icon["']/i.test(index)) throw new Error('Apple touch icon link missing from production index.');

const release = JSON.parse(await readFile(path.join(dist, 'release.json'), 'utf8'));
if (release.name !== 'Signal Earth') throw new Error('Unexpected release metadata product name.');
if (release.version !== packageMetadata.version) {
  throw new Error(`release.json version ${release.version} does not match package version ${packageMetadata.version}.`);
}
if (typeof release.commit !== 'string' || (release.commit !== 'local' && !/^[0-9a-f]{40}$/i.test(release.commit))) {
  throw new Error('release.json contains an invalid commit identifier.');
}
if (process.env.GITHUB_SHA && release.commit !== process.env.GITHUB_SHA) {
  throw new Error(`release.json commit ${release.commit} does not match GITHUB_SHA ${process.env.GITHUB_SHA}.`);
}

const sw = await readFile(path.join(dist, 'sw.js'), 'utf8');
if (sw.includes('__SIGNAL_EARTH_PRECACHE__')) throw new Error('Production service worker still contains the precache placeholder.');
if (sw.includes('__SIGNAL_EARTH_CACHE_VERSION__')) throw new Error('Production service worker still contains the cache-version placeholder.');
if (!sw.includes('./index.html')) throw new Error('Production service worker does not precache the application shell.');
if (!sw.includes('./release.json')) throw new Error('Production service worker does not include release metadata in its application shell.');

const cacheVersionMatch = sw.match(/const CACHE_VERSION = ['"]([^'"]+)['"]/);
if (!cacheVersionMatch) throw new Error('Production service worker does not expose CACHE_VERSION.');
const expectedCacheVersion = `signal-earth-${packageMetadata.version}`;
if (cacheVersionMatch[1] !== expectedCacheVersion) {
  throw new Error(`Service-worker cache version ${cacheVersionMatch[1]} does not match ${expectedCacheVersion}.`);
}

const precacheMatch = sw.match(/const GENERATED_PRECACHE = (\[[^;]*\]);/);
if (!precacheMatch) throw new Error('Production service worker does not expose a generated precache list.');
const precache = JSON.parse(precacheMatch[1]);
if (!Array.isArray(precache) || precache.length === 0) throw new Error('Production service-worker precache is empty.');

for (const entry of precache) {
  if (typeof entry !== 'string' || !entry.startsWith('./')) throw new Error(`Invalid precache entry: ${String(entry)}`);
  const relative = entry.slice(2);
  const segments = relative.split('/');
  if (segments.some((segment) => segment.startsWith('.'))) throw new Error(`Hidden or parent path must not be precached: ${entry}`);
  if (/\.map$/i.test(relative) || /\.md$/i.test(relative) || relative === 'sw.js') throw new Error(`Non-runtime file must not be precached: ${entry}`);
  await access(path.join(dist, relative));
}

for (const requiredEntry of ['./index.html', './manifest.webmanifest', './release.json']) {
  if (!precache.includes(requiredEntry)) throw new Error(`Required application-shell asset missing from precache: ${requiredEntry}`);
}
if (!precache.some((entry) => /^\.\/assets\/.*\.js$/.test(entry))) throw new Error('Production JavaScript entry missing from precache.');
if (!precache.some((entry) => /^\.\/assets\/.*\.css$/.test(entry))) throw new Error('Production stylesheet bundle missing from precache.');
if (precache.some((entry) => /worker.*\.js$/i.test(entry))) throw new Error('Async orbit worker must be runtime-cached, not startup-precached.');
if (precache.some((entry) => /(?:Impl|GlobeViewportBase).*\.js$/i.test(entry))) throw new Error('Lazy feature chunk leaked into startup precache.');
if (precache.length > 28) throw new Error(`Startup precache contains ${precache.length} assets; measured shell budget is 28.`);

const assetFiles = await readdir(path.join(dist, 'assets'));
if (!assetFiles.some((name) => /^orbit\.worker-.*\.js$/i.test(name))) throw new Error('Production orbit worker bundle is missing.');

const manifest = JSON.parse(await readFile(path.join(dist, 'manifest.webmanifest'), 'utf8'));
if (manifest.name !== 'Signal Earth' || manifest.short_name !== 'Signal Earth' || manifest.display !== 'standalone') {
  throw new Error('Unexpected PWA manifest identity/display metadata.');
}
if (manifest.id !== './' || manifest.start_url !== './' || manifest.scope !== './') {
  throw new Error('PWA id/start_url/scope must remain relative for GitHub Pages portability.');
}
if (!Array.isArray(manifest.icons) || manifest.icons.length < 3) throw new Error('PWA icon set is incomplete.');
const iconPurposes = manifest.icons.map((icon) => String(icon.purpose ?? ''));
if (!iconPurposes.includes('maskable')) throw new Error('PWA manifest is missing a maskable icon.');
for (const icon of manifest.icons) {
  if (typeof icon.src !== 'string' || !icon.src.startsWith('./')) throw new Error('PWA icon paths must remain relative.');
  await access(path.join(dist, icon.src.slice(2)));
}

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
const budget = 8 * 1024 * 1024;
if (bytes > budget) throw new Error(`Production site is ${(bytes / 1024 / 1024).toFixed(1)} MB; Phase 29 packaged-site budget is 8 MB.`);
console.log(
  `Release verification passed: Signal Earth ${packageMetadata.version}, ${(bytes / 1024 / 1024).toFixed(2)} MB production site, ` +
  `${precache.length} startup-shell precache entries, cache ${expectedCacheVersion}.`,
);
