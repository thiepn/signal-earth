import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => readFile(path.join(root, relative), 'utf8');
const packageMetadata = JSON.parse(await read('package.json'));

if (!/^\d+\.\d+\.\d+$/.test(packageMetadata.version)) {
  throw new Error(`Final release version must be stable semantic versioning without a prerelease suffix: ${packageMetadata.version}`);
}
if (packageMetadata.packageManager !== 'npm@10.9.8') {
  throw new Error(`Release packageManager must be npm@10.9.8, received ${packageMetadata.packageManager ?? 'missing'}.`);
}
if (packageMetadata.scripts?.release !== 'npm run certify && npm run release:verify && npm run performance:verify && npm run release:integrity') {
  throw new Error('The release script no longer includes every Signal Earth 2.0 certification gate.');
}

const versionSource = await read('src/app/version.ts');
const versionMatch = versionSource.match(/APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
if (!versionMatch || versionMatch[1] !== packageMetadata.version) {
  throw new Error(`APP_VERSION must match package version ${packageMetadata.version}.`);
}

const nvmrc = (await read('.nvmrc')).trim();
if (nvmrc !== '22.23.2') throw new Error(`.nvmrc must pin Node 22.23.2, received ${nvmrc}.`);

await access(path.join(root, 'package-lock.json'));
const packageLock = JSON.parse(await read('package-lock.json'));
if (packageLock.lockfileVersion !== 3) throw new Error(`Expected npm lockfileVersion 3, received ${packageLock.lockfileVersion}.`);
if (packageLock.name !== packageMetadata.name || packageLock.version !== packageMetadata.version) {
  throw new Error('package-lock.json top-level identity/version does not match package.json.');
}
const lockedRoot = packageLock.packages?.[''];
if (!lockedRoot || lockedRoot.name !== packageMetadata.name || lockedRoot.version !== packageMetadata.version) {
  throw new Error('package-lock.json root package metadata does not match package.json.');
}
for (const [name, requested] of Object.entries({ ...packageMetadata.dependencies, ...packageMetadata.devDependencies })) {
  const locked = lockedRoot.dependencies?.[name] ?? lockedRoot.devDependencies?.[name];
  if (locked !== requested) throw new Error(`Lockfile root declaration for ${name} (${locked ?? 'missing'}) does not match package.json (${requested}).`);
}

const viteConfig = await read('vite.config.ts');
if (!/sourcemap:\s*false/.test(viteConfig)) throw new Error('Production Vite source maps must remain disabled.');

const swSource = await read('public/sw.js');
if (!swSource.includes('__SIGNAL_EARTH_CACHE_VERSION__')) throw new Error('Service-worker source is missing the build-time cache-version marker.');
if (!swSource.includes('await cache.put(request, response.clone())')) throw new Error('Service-worker runtime cache writes must be awaited.');
const installBlock = swSource.match(/self\.addEventListener\('install',[\s\S]*?\n\}\);/);
if (!installBlock) throw new Error('Service-worker install handler could not be audited.');
if (/skipWaiting\s*\(/.test(installBlock[0])) throw new Error('Service-worker install must not force-activate over an open release.');

const workflows = [
  '.github/workflows/test.yml',
  '.github/workflows/qa.yml',
  '.github/workflows/deploy.yml',
];
for (const workflow of workflows) {
  const source = await read(workflow);
  if (/npm install --legacy-peer-deps/.test(source)) throw new Error(`${workflow} still uses mutable npm install instead of npm ci.`);
  if (!/npm ci --legacy-peer-deps --no-audit --no-fund/.test(source)) throw new Error(`${workflow} does not use the certified npm ci install command.`);
  if (!/node-version-file:\s*\.nvmrc/.test(source)) throw new Error(`${workflow} does not use the pinned .nvmrc runtime.`);
  for (const match of source.matchAll(/uses:\s*([^\s#]+)/g)) {
    const action = match[1];
    if (!/@[0-9a-f]{40}$/i.test(action)) throw new Error(`${workflow} contains an unpinned action reference: ${action}`);
  }
}

const testWorkflow = await read('.github/workflows/test.yml');
const qaWorkflow = await read('.github/workflows/qa.yml');
const deployWorkflow = await read('.github/workflows/deploy.yml');
if (!/^name:\s*Verify Release\s*$/m.test(testWorkflow)) throw new Error('Verification workflow must be named Verify Release for the final release pipeline.');
if (/Release Candidate|Verify V1/.test(testWorkflow)) throw new Error('Verification workflow still carries prerelease/V1 naming.');
if (/name:\s*Deploy Signal Earth V1/.test(deployWorkflow)) throw new Error('Deployment workflow still carries stale V1 naming.');

if (!/[\"']v\*[\"']/.test(qaWorkflow)) throw new Error('Cross-browser QA must run on versioned maintenance branches.');
const uploadArtifactV7 = 'actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a';
if (!testWorkflow.includes(uploadArtifactV7) || !qaWorkflow.includes(uploadArtifactV7)) {
  throw new Error('Verification and QA must use the pinned Node-24-based upload-artifact v7.0.1 action.');
}
const navigationFallback = swSource.match(/async function navigationFallback\(request\) \{[\s\S]*?\n\}/);
if (!navigationFallback) throw new Error('Service-worker navigation fallback could not be audited.');
if (/cache\.put\s*\(/.test(navigationFallback[0])) throw new Error('Navigation URLs must not create query-specific runtime shell cache entries.');

const publishWorkflow = await read('.github/workflows/publish-release.yml');
if (!publishWorkflow.includes('workflows: ["Verify Release"]')) throw new Error('Release publisher must be gated by the Verify Release workflow.');
if (!publishWorkflow.includes('Cross-browser QA') || !publishWorkflow.includes('Deploy Signal Earth')) {
  throw new Error('Release publisher must wait for both Cross-browser QA and Deploy Signal Earth.');
}
if (!publishWorkflow.includes('gh run download')) throw new Error('Release publisher must package the certified verification artifact rather than rebuilding.');
if (/npm run build|npm run release|vite build/.test(publishWorkflow)) throw new Error('Release publisher must not rebuild the certified artifact.');
for (const match of publishWorkflow.matchAll(/uses:\s*([^\s#]+)/g)) {
  const action = match[1];
  if (!/@[0-9a-f]{40}$/i.test(action)) throw new Error(`Publish workflow contains an unpinned action reference: ${action}`);
}

console.log(`Stable release integrity verification passed for Signal Earth ${packageMetadata.version}.`);
