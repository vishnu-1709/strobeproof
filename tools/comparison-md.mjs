// Writes the feature-comparison table from lab/comparison.json into README.md and DEVPOST.md
// (between <!-- comparison:start --> and <!-- comparison:end -->), so all three always agree.
// Usage: node tools/comparison-md.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const c = JSON.parse(fs.readFileSync(path.join(root, 'lab', 'comparison.json'), 'utf8'));
const cell = (s) => String(s).replace(/\|/g, '\\|');
const head = `| Feature | ${c.tools.map((t) => `**${t.name}**`).join(' | ')} |`;
const sep = `|---|${c.tools.map(() => '---').join('|')}|`;
const rows = c.rows.map(([k, label]) => `| ${label} | ${c.tools.map((t) => cell(t[k])).join(' | ')} |`);
const sources = c.tools.map((t) => `[${t.name}](${t.source})`).join(' · ');
const md = [
  `Other tools: only what each tool's public store listing states, checked ${c.checked}. "?" means the listing doesn't say. Strobeproof: this repo. Other tools weren't run through the benchmark.`,
  '',
  head, sep, ...rows,
  '',
  `Sources: ${sources}.`,
  '',
  c.footnote ? c.footnote.text.replace(c.footnote.name, `[${c.footnote.name}](${c.footnote.source})`) : '',
].join('\n');

for (const f of ['README.md', 'DEVPOST.md']) {
  const p = path.join(root, f);
  const s = fs.readFileSync(p, 'utf8');
  const re = /<!-- comparison:start -->[\s\S]*?<!-- comparison:end -->/;
  if (!re.test(s)) throw new Error(`${f}: comparison markers not found`);
  fs.writeFileSync(p, s.replace(re, `<!-- comparison:start -->\n${md}\n<!-- comparison:end -->`));
  console.log('updated', f);
}
