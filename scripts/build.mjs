// Copies src/ into dist/chrome and dist/firefox, each with its own manifest, and zips them for the
// stores. No bundler: what the stores review is the code in this repository, file for file.
import { execFileSync } from 'node:child_process';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const src = `${root}src`;
const dist = `${root}dist`;
const pkg = JSON.parse(await readFile(`${root}package.json`, 'utf8'));
const base = JSON.parse(await readFile(`${src}/manifest.json`, 'utf8'));

if (base.version !== pkg.version) {
  throw new Error(`manifest.json says ${base.version} but package.json says ${pkg.version}`);
}

const firefox = {
  ...base,
  browser_specific_settings: {
    gecko: {
      id: 'coursemark@rootx22.github.io',
      strict_min_version: '140.0', // the first Firefox that asks for data consent itself
      data_collection_permissions: { required: ['none'], optional: ['authenticationInfo'] },
    },
    gecko_android: { strict_min_version: '142.0' },
  },
};

await rm(dist, { recursive: true, force: true });
for (const [browser, manifest] of [
  ['chrome', base],
  ['firefox', firefox],
]) {
  const out = `${dist}/${browser}`;
  await mkdir(out, { recursive: true });
  await cp(src, out, { recursive: true, filter: (path) => !path.endsWith('icon.svg') });
  await writeFile(`${out}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
  execFileSync('zip', ['-qrX', `${dist}/coursemark-${pkg.version}-${browser}.zip`, '.'], { cwd: out });
}
console.log(`built ${pkg.version} into dist/`);
