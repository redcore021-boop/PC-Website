/** Possible dictionary forms of an inflected token: "mitigated" → mitigate, "ubiquities" → ubiquity. */
export function lemmaCandidates(token: string): string[] {
  const t = token.toLowerCase().replace(/[’']s$/, '').replace(/[’']/g, "'");
  const out = [t];
  const add = (s: string) => s.length > 1 && !out.includes(s) && out.push(s);
  const undouble = (s: string) => (/([bdgklmnprt])\1$/.test(s) ? s.slice(0, -1) : s);
  if (t.endsWith('ies')) add(t.slice(0, -3) + 'y');
  if (t.endsWith('ied')) add(t.slice(0, -3) + 'y');
  if (t.endsWith('es')) add(t.slice(0, -2));
  if (t.endsWith('s') && !t.endsWith('ss')) add(t.slice(0, -1));
  if (t.endsWith('ed')) {
    add(t.slice(0, -1));
    add(t.slice(0, -2));
    add(undouble(t.slice(0, -2)));
  }
  if (t.endsWith('ing')) {
    add(t.slice(0, -3) + 'e');
    add(t.slice(0, -3));
    add(undouble(t.slice(0, -3)));
  }
  if (t.endsWith('ly')) {
    add(t.slice(0, -2));
    if (t.endsWith('ily')) add(t.slice(0, -3) + 'y');
    if (t.endsWith('ally')) add(t.slice(0, -4));
  }
  if (t.endsWith('er')) add(t.slice(0, -2));
  if (t.endsWith('est')) add(t.slice(0, -3));
  return out;
}
