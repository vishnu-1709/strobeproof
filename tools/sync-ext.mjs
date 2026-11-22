// Mirrors core/ (minus tests) and vendor/ into extension/ so "Load unpacked" works from a clone.
// An extension can't import files outside its own folder. core/ is the source of truth;
// core/__tests__/drift.test.js fails if the mirror is stale. Usage: node tools/sync-ext.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function copyDir(src, dst, skip = () => false) {
  fs.rmSync(dst, { recursive: true, force: true });
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (skip(e.name)) continue;
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d, skip); else fs.copyFileSync(s, d);
  }
}
copyDir(path.join(root, 'core'), path.join(root, 'extension', 'core'), (n) => n === '__tests__' || n === 'fixtures.js');
copyDir(path.join(root, 'vendor'), path.join(root, 'extension', 'vendor'));
console.log('synced core/ and vendor/ into extension/');
