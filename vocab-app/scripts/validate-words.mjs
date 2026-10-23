// Checks every word batch for missing fields and broken card data. Run: npm run validate-words
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data');
const roots = new Set(JSON.parse(readFileSync(join(root, 'roots.json'), 'utf8')).map((r) => r.key));
const themes = new Set(JSON.parse(readFileSync(join(root, 'themes.json'), 'utf8')).map((t) => t.key));
const REGISTERS = new Set(['formal', 'neutral', 'informal', 'literary', 'academic']);
const slug = (w) => w.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Simple English: every word in a plain definition must be an everyday word
const everyday = new Set([
  ...JSON.parse(readFileSync(join(root, 'common-words.json'), 'utf8')).words,
  ...JSON.parse(readFileSync(join(root, 'basic-words.json'), 'utf8')).words,
]);
const lemmas = (t) => {
  const whole = t.toLowerCase().replace(/^'|'$/g, '');
  t = whole.replace(/'(s|re|ll|m|ve|d|t)$/, '');
  const out = new Set([whole, t]);
  for (const [suf, rep] of [['ies', 'y'], ['ied', 'y'], ['es', ''], ['s', ''], ['ed', ''], ['ed', 'e'], ['d', ''], ['ing', ''], ['ing', 'e'], ['ly', ''], ['er', ''], ['est', '']]) {
    if (t.endsWith(suf) && t.length > suf.length + 2) out.add(t.slice(0, -suf.length) + rep);
  }
  const m = t.match(/^(.*([bdgmnprt]))\2(ed|ing)$/);
  if (m) out.add(m[1]);
  return out;
};
const hardWords = (text) =>
  (text.match(/[A-Za-z][A-Za-z'-]*/g) ?? [])
    .flatMap((tok) => tok.split('-'))
    .filter((p) => p && ![...lemmas(p)].some((l) => everyday.has(l)) && !['i', 'don', 'won', 'can', 'isn', 'didn', 'doesn'].includes(p.toLowerCase()));

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
    // the learner-facing layer: short Hebrew, Simple English, an everyday example
    if (!w.simple?.trim()) err('missing simple (Simple English definition)');
    else {
      const hard = hardWords(w.simple);
      if (hard.length) err(`simple definition uses harder words: ${hard.join(', ')}`);
      if (w.simple.split(/\s+/).length > 14) err('simple definition longer than 14 words');
      const head = w.word.toLowerCase().replace(/^(a|an|the) /, '');
      if (!head.includes(' ') && new RegExp('\\b' + head.replace(/(e|y|s)$/, '').slice(0, 6)).test(w.simple.toLowerCase())) err('simple definition gives the word away');
    }
    if (!w.hs?.trim()) err('missing hs (short Hebrew)');
    else if (w.hs.split(/\s+/).length > 4) err('short Hebrew longer than 4 words');
    if (!w.easy?.trim()) err('missing easy (everyday example)');
    else {
      if ((w.easy.match(/\[[^\]]+\]/g) ?? []).length !== 1) err('everyday example needs exactly one [target]');
      if (w.easy.split(/\s+/).length > 13) err('everyday example longer than 13 words');
      const hard = hardWords(w.easy.replace(/\[[^\]]+\]/, ''));
      if (hard.length) warnings.push(`${at} — everyday example uses: ${hard.join(', ')}`);
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
