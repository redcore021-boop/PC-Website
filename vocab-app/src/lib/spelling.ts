/** Accept British/American spelling variants when the learner types an answer. */
export function alternativeSpellings(word: string): string[] {
  const alts = new Set<string>();
  const swaps: [RegExp, string][] = [
    [/ize(d|s)?\b/g, 'ise$1'],
    [/ise(d|s)?\b/g, 'ize$1'],
    [/yze\b/g, 'yse'],
    [/or\b/g, 'our'],
    [/our\b/g, 'or'],
    [/er\b/g, 're'],
    [/re\b/g, 'er'],
    [/ogue\b/g, 'og'],
  ];
  for (const [re, rep] of swaps) {
    const v = word.replace(re, rep);
    if (v !== word) alts.add(v);
  }
  // 'grain of salt' (US) / 'pinch of salt' (UK)
  if (word.includes('grain of salt')) alts.add(word.replace('grain', 'pinch'));
  if (word.includes('around the bush')) alts.add(word.replace('around', 'about'));
  return [...alts];
}
