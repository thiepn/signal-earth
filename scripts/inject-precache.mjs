import { access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const dist = path.resolve('dist');
const swPath = path.join(dist, 'sw.js');
const indexPath = path.join(dist, 'index.html');
const manifestPath = path.join(dist, 'manifest.webmanifest');

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
const manifestAssets = [
  ...(Array.isArray(manifest.icons) ? manifest.icons.map((icon) => icon?.src) : []),
  ...(Array.isArray(manifest.screenshots) ? manifest.screenshots.map((shot) => shot?.src) : []),
].map(normalizeRuntimePath).filter(Boolean);

// Phase 25: precache only the application/install shell. Async feature chunks,
// workers and secondary observatory tools are cached on first real use by the
// service worker's runtime cache instead of competing with initial startup.
const candidates = [
  './index.html',
  './manifest.webmanifest',
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

const sw = await readFile(swPath, 'utf8');
const marker = '/*__SIGNAL_EARTH_PRECACHE__*/[]';
if (!sw.includes(marker)) throw new Error('Service-worker precache marker not found.');
await writeFile(swPath, sw.replace(marker, JSON.stringify(assets)), 'utf8');
console.log(`Injected ${assets.length} shell assets into service-worker precache; async chunks remain runtime-cached.`);
