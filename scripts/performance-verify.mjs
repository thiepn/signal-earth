import { readFile, readdir, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import path from 'node:path';

const dist = path.resolve('dist');
const assetsDir = path.join(dist, 'assets');
const index = await readFile(path.join(dist, 'index.html'), 'utf8');
const sw = await readFile(path.join(dist, 'sw.js'), 'utf8');

const referencedJs = [...new Set([...index.matchAll(/(?:src|href)=["'](\.\/assets\/[^"']+\.js)["']/g)].map((match) => match[1]))];
if (!referencedJs.length) throw new Error('Performance verification could not find the initial JavaScript entry graph in index.html.');

let initialRaw = 0;
let initialGzip = 0;
for (const reference of referencedJs) {
  const bytes = await readFile(path.join(dist, reference.slice(2)));
  initialRaw += bytes.byteLength;
  initialGzip += gzipSync(bytes).byteLength;
}

const INITIAL_RAW_BUDGET = 420 * 1024;
const INITIAL_GZIP_BUDGET = 125 * 1024;
if (initialRaw > INITIAL_RAW_BUDGET) {
  throw new Error(`Initial HTML-linked JS is ${(initialRaw / 1024).toFixed(1)} kB; Phase 25 budget is ${INITIAL_RAW_BUDGET / 1024} kB.`);
}
if (initialGzip > INITIAL_GZIP_BUDGET) {
  throw new Error(`Initial HTML-linked JS is ${(initialGzip / 1024).toFixed(1)} kB gzip; Phase 25 budget is ${INITIAL_GZIP_BUDGET / 1024} kB.`);
}

const assetNames = await readdir(assetsDir);
const jsAssets = assetNames.filter((name) => name.endsWith('.js') && !name.endsWith('.map'));
const initialNames = new Set(referencedJs.map((reference) => path.posix.basename(reference)));
const deferred = jsAssets.filter((name) => !initialNames.has(name));

const requiredDeferredPrefixes = [
  'GlobeViewportBase-',
  'SearchOverlayImpl-',
  'SettingsPanelImpl-',
  'BriefingLauncherImpl-',
  'AboveMeControlsImpl-',
  'InspectorPanelImpl-',
];
for (const prefix of requiredDeferredPrefixes) {
  const chunk = jsAssets.find((name) => name.startsWith(prefix));
  if (!chunk) throw new Error(`Expected deferred Phase 25 chunk is missing: ${prefix}`);
  if (initialNames.has(chunk)) throw new Error(`Deferred feature leaked into the HTML-linked startup graph: ${chunk}`);
  if (sw.includes(`./assets/${chunk}`)) throw new Error(`Deferred feature leaked into service-worker startup precache: ${chunk}`);
}

const worker = jsAssets.find((name) => name.startsWith('orbit.worker-'));
if (!worker) throw new Error('Orbit worker bundle is missing.');
if (sw.includes(`./assets/${worker}`)) throw new Error('Orbit worker must be runtime-cached rather than startup-precached.');

let deferredRaw = 0;
for (const name of deferred) deferredRaw += (await stat(path.join(assetsDir, name))).size;

console.log(
  `Performance verification passed: ${(initialRaw / 1024).toFixed(1)} kB raw / ${(initialGzip / 1024).toFixed(1)} kB gzip HTML-linked JS, ` +
  `${deferred.length} deferred JS chunks (${(deferredRaw / 1024).toFixed(1)} kB raw).`,
);
