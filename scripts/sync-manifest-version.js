#!/usr/bin/env node
// Runs as npm's "version" lifecycle hook (see package.json). Keeps
// manifest.json's version in sync with package.json whenever
// `npm version <patch|minor|major>` is run, so both are bumped together
// and included in the same version commit/tag.

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const pkgPath = path.join(rootDir, 'package.json');
const manifestPath = path.join(rootDir, 'manifest.json');

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

manifest.version = pkg.version;

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

console.log(`Synced manifest.json version to ${pkg.version}`);
