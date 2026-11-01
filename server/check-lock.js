const fs = require('node:fs');
const path = require('node:path');

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(__dirname, 'package-lock.json'), 'utf8'));
const errors = [];

for (const group of ['dependencies', 'devDependencies', 'optionalDependencies']) {
  for (const [name, spec] of Object.entries(manifest[group] || {})) {
    const rootSpec = lock.packages?.['']?.[group]?.[name];
    const lockedVersion = lock.packages?.[`node_modules/${name}`]?.version;
    if (rootSpec !== spec) errors.push(`${group}.${name}: manifest=${spec}, lock-root=${rootSpec ?? 'missing'}`);
    if (lockedVersion !== spec) errors.push(`${group}.${name}: manifest=${spec}, locked=${lockedVersion ?? 'missing'}`);
  }
}

if (errors.length) {
  console.error('Dependency manifest and lockfile are inconsistent:\n- ' + errors.join('\n- '));
  process.exitCode = 1;
} else {
  console.log('Dependency manifest and lockfile are consistent.');
}
