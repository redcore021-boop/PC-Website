// Checks every word batch for missing fields and broken card data. Run: npm run validate-words
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data');
const roots = new Set(JSON.parse(readFileSync(join(root, 'roots.json'), 'utf8')).map((r) => r.key));
const themes = new Set(JSON.parse(readFileSync(join(root, 'themes.json'), 'utf8')).map((t) => t.key));
const REGISTERS = new Set(['formal', 'neutral', 'informal', 'literary', 'academic']);
const slug = (w) => w.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const errors = [];
const warnings = [];
const ids = new Map();
const usedRoots = new Set();
let total = 0;

for (const file of readdirSync(join(root, 'words')).filter((f) => f.endsWith('.json')).sort()) {
  const data = JSON.parse(readFileSync(join(root, 'words', file), 'utf8'));
  for (const w of data.words) {
    total++;
    const at = `${file}: ${w.word}`;
    const err = (m) => errors.push(`${at} — ${m}`);
    for (const f of ['word', 'ipa', 'pos', 'def', 'he', 'nuance', 'ety', 'reg']) if (!w[f]?.trim?.()) err(`missing ${f}`);
    for (const f of ['family', 'ex', 'col', 'syn', 'themes']) if (!Array.isArray(w[f])) err(`${f} must be an array`);
    const id = slug(w.word);
    if (ids.has(id)) err(`duplicate of ${ids.get(id)}`);
    ids.set(id, at);
    if (w.ipa?.includes('/')) err('ipa should not include slashes');
    if (!REGISTERS.has(w.reg)) err(`bad register ${w.reg}`);
    if (![1, 2, 3].includes(w.tier)) err(`bad tier ${w.tier}`);
    if ((w.ex ?? []).length < 3) err('needs at least 3 examples');
    for (const e of w.ex ?? []) {
      const n = (e.match(/\[[^\]]+\]/g) ?? []).length;
      if (n !== 1) err(`example needs exactly one [target]: "${e}"`);
    }
    if ((w.col ?? []).length < 2) err('needs at least 2 collocations');
    for (const t of w.themes ?? []) if (!themes.has(t)) err(`unknown theme ${t}`);
    if (!w.themes?.length) err('needs a theme');
    if (w.root) {
      if (!roots.has(w.root)) err(`unknown root ${w.root}`);
      usedRoots.add(w.root);
    }
    if (!w.prec) warnings.push(`${at} — no precision card`);
    else {
      const blanks = (w.prec.s.match(/_{3,}/g) ?? []).length;
      if (blanks !== 1) err(`precision sentence needs exactly one ___ (has ${blanks})`);
      const answer = (w.prec.ans ?? w.word).toLowerCase();
      if (!Array.isArray(w.prec.opts) || w.prec.opts.length < 2) err('precision needs 2+ options');
      if (w.prec.opts?.some((o) => o.toLowerCase() === answer)) err('precision options include the answer');
      if (new Set(w.prec.opts.map((o) => o.toLowerCase())).size !== w.prec.opts.length) err('duplicate precision options');
      if (!w.prec.why?.trim()) err('precision needs an explanation');
      if (/\bhmm\b|\bwait —|\bTODO\b/i.test(w.prec.why)) err('precision explanation contains a drafting note');
      if (w.prec.s.toLowerCase().includes(answer)) err('precision sentence gives away the answer');
    }
  }
}
for (const r of roots) if (!usedRoots.has(r)) warnings.push(`root "${r}" is not used by any word`);

console.log(`${total} words checked.`);
if (warnings.length) console.log(`\n${warnings.length} warnings:\n  ` + warnings.join('\n  '));
if (errors.length) {
  console.error(`\n${errors.length} errors:\n  ` + errors.join('\n  '));
  process.exit(1);
}
console.log('No errors.');
