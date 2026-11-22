// Guards the copies the extension needs: extension/core must equal core/, and calm.css must use CALM_FILTER.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { CALM_FILTER } from '../constants.js';

const root = path.resolve(new URL('../..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const list = (dir, base = dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name);
  if (e.name === '__tests__' || e.name === 'fixtures.js') return [];
  return e.isDirectory() ? list(p, base) : [path.relative(base, p)];
});
const norm = (s) => s.replace(/\r\n/g, '\n');

describe('extension mirrors', () => {
  it('extension/core matches core/ (run: node tools/sync-ext.mjs)', () => {
    const src = path.join(root, 'core'), dst = path.join(root, 'extension', 'core');
    expect(fs.existsSync(dst)).toBe(true);
    const files = list(src);
    expect(list(dst).sort()).toEqual(files.sort());
    for (const f of files) expect(norm(fs.readFileSync(path.join(dst, f), 'utf8')), f).toBe(norm(fs.readFileSync(path.join(src, f), 'utf8')));
  });
  it('calm.css uses exactly CALM_FILTER from constants.js', () => {
    const css = fs.readFileSync(path.join(root, 'extension', 'calm.css'), 'utf8');
    expect(css).toContain(`filter: ${CALM_FILTER} !important`);
  });
});
