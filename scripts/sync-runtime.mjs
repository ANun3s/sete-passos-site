import { build } from 'vite';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';

const rootRequire = createRequire(import.meta.url);

async function packageRoot(entry, packageName) {
  let directory = dirname(entry);
  while (true) {
    try {
      const metadata = JSON.parse(await readFile(resolve(directory, 'package.json'), 'utf8'));
      if (metadata.name === packageName) return directory;
    } catch { /* Continue toward the package root. */ }
    const parent = dirname(directory);
    if (parent === directory) throw new Error(`Could not locate the ${packageName} package root.`);
    directory = parent;
  }
}

// Reproducible local ESM for both Vite and VS Code Go Live.
await mkdir('src/vendor', { recursive: true });
await mkdir('public/licenses', { recursive: true });
async function save(path, content) {
  const previous = await readFile(path, 'utf8').catch(() => '');
  if (previous !== content) await writeFile(path, content);
  console.log(`${path}: ${Buffer.byteLength(content)} bytes`);
}
for (const runtime of ['motion', 'gsap', 'ogl']) {
  const result = await build({ configFile: false, logLevel: 'error', build: {
    write: false, copyPublicDir: false, minify: true,
    lib: { entry: resolve(`src/vendor/${runtime}-entry.js`), formats: ['es'], fileName: () => `${runtime}.mjs` },
  } });
  const bundles = Array.isArray(result) ? result : [result];
  for (const chunk of bundles.flatMap(bundle => bundle.output)) {
    if (chunk.type === 'chunk') await save(`src/vendor/${chunk.fileName}`, chunk.code);
  }
}
const motionEntry = rootRequire.resolve('motion');
for (const [pkg, resolver] of [
  ['motion', rootRequire],
  ['motion-dom', createRequire(motionEntry)],
  ['motion-utils', createRequire(createRequire(motionEntry).resolve('motion-dom'))],
]) {
  const entry = resolver.resolve(pkg);
  const root = await packageRoot(entry, pkg);
  await save(`public/licenses/${pkg}.txt`, await readFile(resolve(root, 'LICENSE.md'), 'utf8'));
}
const gsapRoot = await packageRoot(rootRequire.resolve('gsap'), 'gsap');
const oglRoot = await packageRoot(rootRequire.resolve('ogl'), 'ogl');
const gsapPackage = JSON.parse(await readFile(resolve(gsapRoot, 'package.json'), 'utf8'));
const oglReadme = await readFile(resolve(oglRoot, 'README.md'), 'utf8');
await save('public/licenses/ogl.txt', oglReadme.slice(oglReadme.indexOf('This is free and unencumbered software')));
await save('public/licenses/gsap.txt', `GSAP ${gsapPackage.version}\nLicense: ${gsapPackage.license}\n\n${await readFile(resolve(gsapRoot, 'README.md'), 'utf8')}`);
