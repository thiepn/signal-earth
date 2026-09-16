import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'dist');
const packageMetadata = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const versionSource = await readFile(path.join(root, 'src/app/version.ts'), 'utf8');
const versionMatch = versionSource.match(/APP_VERSION\s*=\s*['"]([^'"]+)['"]/);

if (!versionMatch) throw new Error('Could not read APP_VERSION from src/app/version.ts.');
if (versionMatch[1] !== packageMetadata.version) {
  throw new Error(`Package version ${packageMetadata.version} does not match APP_VERSION ${versionMatch[1]}.`);
}

const commit = (process.env.SIGNAL_EARTH_COMMIT || process.env.GITHUB_SHA || 'local').trim();
if (commit !== 'local' && !/^[0-9a-f]{40}$/i.test(commit)) {
  throw new Error(`Release commit must be a full 40-character Git SHA, received ${commit}.`);
}

const release = {
  name: 'Signal Earth',
  version: packageMetadata.version,
  commit,
};

await writeFile(path.join(dist, 'release.json'), `${JSON.stringify(release, null, 2)}\n`, 'utf8');
console.log(`Wrote deterministic release metadata for Signal Earth ${release.version} (${release.commit}).`);
