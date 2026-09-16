import { access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const dist = path.resolve('dist');
const swPath = path.join(dist, 'sw.js');
const indexPath = path.join(dist, 'index.html');
const manifestPath = path.join(dist, 'manifest.webmanifest');
const releasePath = path.join(dist, 'release.json');
const packageMetadata = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));

function normalizeRuntimePath(value) {
  if (!value || /^(?:https?:|data:|blob:|#)/i.test(value)) return null;
  const clean = value.split('#')[0].split('?')[0];
  if (!clean) return null;
  if (clean.startsWith('./')) return clean;
  if (clean.startsWith('/')) return `.${clean}`;
  return `./${clean}`;
}

function referencesFromHtml(html) {
  const output = [];
  const pattern = /(?:src|href)=["']([^"']+)["']/gi;
  let match;
  while ((match = pattern.exec(html))) {
    const normalized = normalizeRuntimePath(match[1]);
    if (normalized) output.push(normalized);
  }
  return output;
}

const index = await readFile(indexPath, 'utf8');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
await access(releasePath);
const manifestAssets = [
  ...(Array.isArray(manifest.icons) ? manifest.icons.map((icon) => icon?.src) : []),
  ...(Array.isArray(manifest.screenshots) ? manifest.screenshots.map((shot) => shot?.src) : []),
].map(normalizeRuntimePath).filter(Boolean);

// Precache only the application/install shell. Async feature chunks, workers and
// secondary observatory tools are cached on first real use by the service worker.
const candidates = [
  './index.html',
  './manifest.webmanifest',
  './release.json',
  ...referencesFromHtml(index),
  ...manifestAssets,
];
const assets = [...new Set(candidates)]
  .filter((entry) => entry !== './sw.js' && !entry.endsWith('.map') && !/\.md$/i.test(entry))
  .sort();

for (const entry of assets) {
  const relative = entry.replace(/^\.\//, '');
  await access(path.join(dist, relative));
}

let sw = await readFile(swPath, 'utf8');
const precacheMarker = '/*__SIGNAL_EARTH_PRECACHE__*/[]';
const releaseMarker = '__SIGNAL_EARTH_CACHE_VERSION__';
if (!sw.includes(precacheMarker)) throw new Error('Service-worker precache marker not found.');
if (!sw.includes(releaseMarker)) throw new Error('Service-worker release-version marker not found.');

const cacheVersion = `signal-earth-${packageMetadata.version}`;
sw = sw.replace(precacheMarker, JSON.stringify(assets)).replaceAll(releaseMarker, cacheVersion);
await writeFile(swPath, sw, 'utf8');
console.log(`Injected ${assets.length} shell assets into ${cacheVersion}; async chunks remain runtime-cached.`);
