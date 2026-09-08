#!/usr/bin/env node
// Zips the files needed to load/publish the extension (manifest.json,
// options.html, src/) into dist/<name>-<version>.zip. Requires the system
// `zip` CLI (present on macOS/Linux by default).

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(rootDir, 'manifest.json'), 'utf8'));

const distDir = path.join(rootDir, 'dist');
const zipName = `github-jira-pr-linker-${manifest.version}.zip`;
const zipPath = path.join(distDir, zipName);

fs.mkdirSync(distDir, { recursive: true });
fs.rmSync(zipPath, { force: true });

const filesToInclude = ['manifest.json', 'options.html', 'src'];

try {
  execFileSync('zip', ['-r', zipPath, ...filesToInclude], { cwd: rootDir, stdio: 'inherit' });
} catch (err) {
  console.error(
    '\nFailed to create zip. Ensure the `zip` CLI is installed (standard on macOS/Linux).'
  );
  process.exit(1);
}

console.log(`\nCreated ${path.relative(rootDir, zipPath)}`);
