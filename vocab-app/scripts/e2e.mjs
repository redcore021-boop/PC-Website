// End-to-end smoke test against a running build (npm run build && npx vite preview --port 4173).
// Run: NODE_PATH=$(npm root -g) node scripts/e2e.mjs [outDir]
import { createRequire } from 'node:module';
import { readFileSync, readdirSync, mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');

const URL = process.env.APP_URL ?? 'http://localhost:4173/';
const out = process.argv[2] ?? 'e2e-shots';
mkdirSync(out, { recursive: true });
const words = readdirSync('src/data/words').flatMap((f) => JSON.parse(readFileSync('src/data/words/' + f, 'utf8')).words);
const plain = (s) => s.replace(/\[([^\]]+)\]/g, '$1');
const byDef = new Map(words.map((w) => [w.simple ?? w.def, w]));
const norm = (x) => x.replace(/\s+/g, ' ').trim();
const fail = (m) => { console.error('FAIL:', m); process.exitCode = 1; };
const ok = (m) => console.log('ok -', m);

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

await page.goto(URL);
// first launch: welcome, how it works, pace
await page.getByRole('button', { name: 'בואו נתחיל' }).click();
await page.getByText('כל מילה מתחילה בקטן.').waitFor();
await page.screenshot({ path: `${out}/00-onboarding-ladder.png`, fullPage: true });
await page.getByRole('button', { name: 'הבא' }).click();
await page.getByRole('radio', { name: /רגיל/ }).click();
await page.screenshot({ path: `${out}/00-onboarding-pace.png`, fullPage: true });
await page.getByRole('button', { name: 'להתחיל ללמוד' }).click();
ok('onboarding completes');
await page.getByText(/זה האימון של היום/).waitFor();
await page.screenshot({ path: `${out}/01-home.png`, fullPage: true });
const newWords = Number(await page.getByText('מילים חדשות', { exact: true }).locator('xpath=preceding-sibling::div').textContent());
newWords === 5 ? ok('warm-up: 5 new words on day one') : fail(`expected 5 new words, got ${newWords}`);
(await page.getByText(/שבוע חימום: היום 5 מילים חדשות, ובהדרגה עד 10 ביום/).count()) ? ok('warm-up explained on home') : fail('warm-up note missing');

let typed = 0, retries = 0, wrongOnPurpose = 0;
const sawTypes = new Set();
async function runSession(tag) {
  await page.getByRole('button', { name: /(להתחיל|להמשיך) את האימון/ }).click();
  await page.locator('.session-top').waitFor();
  await page.locator('.q-head, .empty').first().waitFor();
  let steps = 0, intros = 0, answered = 0;
  while (steps++ < 150) {
    if (await page.getByText('סיימת את האימון!').isVisible()) break;
    if (await page.getByRole('button', { name: 'הבנתי, אפשר להמשיך' }).isVisible()) {
      if (intros === 0 && tag === 'day1') {
        await page.screenshot({ path: `${out}/02-intro.png`, fullPage: true });
        const he = (await page.locator('.he-main').textContent()) ?? '';
        const simple = (await page.locator('.simple').first().textContent()) ?? '';
        he.match(/[\u0590-\u05FF]/) && simple.length > 5 ? ok(`intro shows Hebrew and Simple English: ${he} — ${simple}`) : fail('intro card missing Hebrew or Simple English');
      }
      intros++;
      await page.getByRole('button', { name: 'הבנתי, אפשר להמשיך' }).click();
      await page.waitForTimeout(120);
      continue;
    }
    if (await page.locator('.explainer').count()) {
      const t = await page.locator('.explainer strong').textContent();
      if (!sawTypes.has('explained:' + t)) { sawTypes.add('explained:' + t); console.log('info - explained ' + t); }
    }
    const KINDS = {
      'איזו מילה מתאימה להסבר?': 'Choose the word',
      'איזו מילה משלימה את המשפט?': 'Fill the gap',
      'הקלידו את המילה': 'Type the word',
      'איזו מילה מדויקת יותר כאן?': 'Precision',
      'השתמשו במילה במשפט משלכם': 'Use it',
    };
    const kind = KINDS[((await page.locator('.q-head .prompt-kind').first().textContent()) ?? '').trim()] ?? 'unknown';
    const isRetry = ((await page.locator('.q-head').first().textContent()) ?? '').includes('ניסיון נוסף');
    sawTypes.add(kind);
    if (isRetry) retries++;
    const promptText = kind === 'Use it' ? '' : ((await page.locator('.prompt-text, .gap-sentence').first().textContent())?.trim() ?? '');
    let target = byDef.get(promptText);
    let answerText;
    if (kind === 'Precision') {
      const shown = norm(promptText.replace(/\u00a0/g, ''));
      target = words.find((w) => w.prec && norm(w.prec.s.replace(/_{3,}/, '')) === shown);
      answerText = target && (target.prec.ans ?? target.word);
    }
    if (kind === 'Use it') {
      const head = (await page.locator('.headword').first().textContent()).trim();
      target = words.find((w) => w.word === head);
      await page.locator('textarea').fill(`Honestly, "${target.word}" sums up my week at work rather well.`);
      if (!sawTypes.has('use-shot')) { sawTypes.add('use-shot'); await page.screenshot({ path: `${out}/11-use-it.png`, fullPage: true }); }
      await page.getByRole('button', { name: 'להשוות' }).click();
      await page.getByRole('button', { name: /^טוב/ }).waitFor();
      if (!sawTypes.has('use-shot2')) { sawTypes.add('use-shot2'); await page.screenshot({ path: `${out}/12-use-it-compare.png`, fullPage: true }); }
      await page.getByRole('button', { name: /^טוב/ }).click();
      answered++;
      await page.locator('.feedback').waitFor();
      await page.getByRole('button', { name: 'המשך' }).click();
      await page.waitForTimeout(120);
      continue;
    }
    if (!target) {
      const shown = norm(promptText.replace(/\u00a0/g, ''));
      target = words.find((w) => [w.easy, ...w.ex].filter(Boolean).some((e) => norm(plain(e.replace(/\[[^\]]+\]/, ''))) === shown));
    }
    if (!target) { fail('could not identify question: ' + promptText); await page.screenshot({ path: `${out}/fail.png` }); break; }

    if (await page.locator('.answer-input').count()) {
      typed++;
      if (typed === 1) {
        const before = await page.locator('.hint').textContent();
        await page.getByRole('button', { name: 'רמז' }).click();
        const after = await page.locator('.hint').textContent();
        after !== before && after.replace(/_/g, '').length > before.replace(/_/g, '').length ? ok(`hint reveals a letter: ${before} → ${after}`) : fail('hint did nothing');
      }
      const answer = typed === 1 ? target.word.slice(0, -1) + (target.word.endsWith('e') ? 'a' : 'e') : target.word;
      await page.locator('.answer-input').fill(answer);
      if (typed === 1) await page.screenshot({ path: `${out}/04-typing.png`, fullPage: true });
      await page.getByRole('button', { name: 'בדיקה' }).click();
      if (typed === 1) {
        await page.locator('.feedback').waitFor();
        (await page.locator('.feedback.typo').count()) ? ok('typo accepted with a spelling note') : fail('typo not recognised');
        await page.screenshot({ path: `${out}/04b-typo.png`, fullPage: true });
      }
    } else {
      const goWrong = wrongOnPurpose === 0 && answered >= 2 && !isRetry;
      const texts = await page.locator('.option').allTextContents();
      const correctText = answerText ?? target.word;
      if (!texts.includes(correctText)) { fail(`answer ${correctText} not among ${texts}`); break; }
      if (kind === 'Precision' && !sawTypes.has('prec-shot')) { sawTypes.add('prec-shot'); await page.screenshot({ path: `${out}/10-precision.png`, fullPage: true }); }
      if (kind === 'Fill the gap' && !sawTypes.has('gap-shot')) { sawTypes.add('gap-shot'); await page.screenshot({ path: `${out}/03b-gap.png`, fullPage: true }); }
      if (answered === 0 && tag === 'day1') await page.screenshot({ path: `${out}/03-choice.png`, fullPage: true });
      if (await page.locator('.option.correct').count()) fail('answer shown before committing');
      const pick = goWrong ? texts.find((t) => t !== correctText) : correctText;
      await page.locator('.option').nth(texts.indexOf(pick)).click();
      if (goWrong) { wrongOnPurpose++; await page.screenshot({ path: `${out}/05-wrong.png`, fullPage: true }); }
    }
    answered++;
    await page.locator('.feedback').waitFor();
    await page.getByRole('button', { name: 'המשך' }).click();
    await page.waitForTimeout(120);
  }
  if (tag === 'day1') await page.screenshot({ path: `${out}/06-summary.png`, fullPage: true });
  (await page.getByText('סיימת את האימון!').isVisible()) ? ok(`${tag}: session complete (${intros} intros, ${answered} answers)`) : fail(`${tag}: session did not complete`);
  await page.getByRole('button', { name: 'סיום', exact: true }).click();
}

await runSession('day1');
retries >= 1 ? ok('missed word came back for another try') : fail('missed word was not repeated');

await page.getByText('מילים בלמידה').waitFor();
await page.waitForTimeout(200);
const started = await page.locator('.stat .num').first().textContent();
started === '5' ? ok('home shows 5 words started') : fail(`words started = ${started}`);
(await page.locator('.ladder-count').count()) === 4 ? ok('stage ladder shows counts') : fail('stage ladder missing');
(await page.getByText('סיימת להיום, כל הכבוד!').isVisible()) ? ok('daily goal shows as done') : fail('expected all-done state');
await page.screenshot({ path: `${out}/07-home-done.png`, fullPage: true });

// persistence across reload
await page.reload();
await page.getByText('מילים בלמידה').waitFor();
(await page.locator('.stat .num').first().textContent()) === '5' ? ok('progress persists after reload') : fail('progress lost on reload');

// later days: reviews climb through all card types. Fewer new words keeps sessions short.
await page.getByRole('button', { name: 'הגדרות', exact: true }).click();
for (let i = 0; i < 8; i++) await page.getByRole('button', { name: 'פחות מילים חדשות' }).click();
await page.getByRole('button', { name: 'היום', exact: true }).click();
const DAY = 864e5;
for (let d = 1; d <= 60; d++) {
  // move every stored date one day into the past, as if a day had gone by
  await page.evaluate((DAY) => new Promise((res) => {
    const r = indexedDB.open('lexicon');
    r.onsuccess = () => {
      const tx = r.result.transaction(['progress', 'reviews'], 'readwrite');
      const ps = tx.objectStore('progress');
      ps.getAll().onsuccess = (e) => e.target.result.forEach((p) => {
        p.card.due = new Date(+p.card.due - DAY);
        if (p.card.last_review) p.card.last_review = new Date(+p.card.last_review - DAY);
        p.introducedAt -= DAY;
        ps.put(p);
      });
      const rs = tx.objectStore('reviews');
      rs.getAll().onsuccess = (e) => e.target.result.forEach((x) => { x.at -= DAY; x.day = 'past'; rs.put(x); });
      tx.oncomplete = res;
    };
  }), DAY);
  if (d === 3) {
    // the sentence card is the last step of a long path; place one word there directly to exercise it
    await page.evaluate(() => new Promise((res) => {
      const r = indexedDB.open('lexicon');
      r.onsuccess = () => {
        const tx = r.result.transaction('progress', 'readwrite');
        tx.objectStore('progress').put({ wordId: 'salient', level: 3, production: 2, mistakes: 0, introducedAt: Date.now() - 30 * 864e5, mastered: false,
          card: { due: new Date(Date.now() - 1000), stability: 20, difficulty: 5, elapsed_days: 0, scheduled_days: 20, learning_steps: 0, reps: 4, lapses: 0, state: 2, last_review: new Date(Date.now() - 20 * 864e5) } });
        tx.oncomplete = res;
      };
    }));
  }
  await page.reload();
  try {
    await page.getByText('מילים בלמידה').waitFor({ timeout: 8000 });
  } catch (e) {
    console.log('BODY:', (await page.locator('body').innerText()).slice(0, 300), 'ERRORS:', errors.join(' | '));
    throw e;
  }
  if (await page.getByRole('button', { name: /(להתחיל|להמשיך) את האימון/ }).isVisible()) await runSession('day' + (d + 1));
  if (['Fill the gap', 'Type the word', 'Precision', 'Use it'].every((t) => sawTypes.has(t)) && d > 20) break;
}
for (const t of ['Choose the word', 'Fill the gap', 'Type the word', 'Precision', 'Use it']) sawTypes.has(t) ? ok(`card type seen: ${t}`) : fail(`never saw card type: ${t}`);
const mastered = await page.evaluate(() => new Promise((res) => { const r = indexedDB.open('lexicon'); r.onsuccess = () => { const q = r.result.transaction('progress').objectStore('progress').getAll(); q.onsuccess = () => res(q.result.filter((p) => p.mastered).length); }; }));
console.log(`info - mastered after simulated weeks: ${mastered}`);

// stats, themes, roots, weak-word practice
await page.getByRole('button', { name: 'התקדמות', exact: true }).click();
await page.getByText('חזרות צפויות', { exact: false }).waitFor();
(await page.locator('.fc-bar').count()) === 14 ? ok('forecast chart shows 14 days') : fail('forecast chart missing');
await page.locator('.fc-col').nth(1).click();
await page.screenshot({ path: `${out}/13-stats.png`, fullPage: true });
const retention = await page.locator('text=/\\d+%/').first().textContent();
ok('stats render, retention ' + retention);
if (await page.getByRole('button', { name: 'לתרגל אותן עכשיו' }).isVisible()) {
  await page.getByRole('button', { name: 'לתרגל אותן עכשיו' }).click();
  await page.locator('.q-head').first().waitFor();
  ok('weak-word practice starts');
  await page.getByRole('button', { name: 'סיום האימון' }).click();
}
await page.getByRole('button', { name: 'מילים', exact: true }).click();
await page.getByRole('button', { name: 'לפי שורש' }).click();
await page.getByText('-loqu-, -locu-').click();
await page.getByText('loquacious').waitFor();
await page.screenshot({ path: `${out}/14-root.png`, fullPage: true });
ok('root page lists its words: ' + (await page.locator('.list-item .w').allTextContents()).join(', '));
await page.goto(URL + '#/browse/themes');
await page.getByText('רגשות ועמדות').click();
await page.getByText('equanimity').waitFor();
ok('theme page works');
await page.locator('.list-item').filter({ hasText: 'equanimity' }).click();
await page.locator('.he-main').waitFor();
if (await page.evaluate(() => 'speechSynthesis' in window)) {
  (await page.getByRole('button', { name: /הגייה בריטית/ }).count()) ? ok('US/UK audio buttons present') : fail('audio buttons missing');
  await page.getByRole('button', { name: /הגייה אמריקאית/ }).click();
} else {
  (await page.getByRole('button', { name: /הגייה (בריטית|אמריקאית)/ }).count()) === 0 ? ok('no speech engine here, audio buttons correctly hidden') : fail('audio buttons shown without speech support');
}

// browse + word page
await page.getByRole('button', { name: 'מילים', exact: true }).click();
await page.locator('.search').fill('mitig');
await page.locator('.list-item').first().click();
await page.locator('.he-main').waitFor();
await page.locator('.more summary').click();
await page.getByText('Common phrases').waitFor();
await page.screenshot({ path: `${out}/08-word.png`, fullPage: true });
ok('word page renders');

// add from reading (dictionary API mocked: it rate-limits CI machines)
const entry = (word, def, example) => [{ word, phonetic: `/${word}ɪt/`, phonetics: [], meanings: [{ partOfSpeech: 'verb', definitions: [{ definition: def, example }], synonyms: ['base'] }] }];
await page.route('https://api.dictionaryapi.dev/**', (route) => {
  const w = decodeURIComponent(route.request().url().split('/').pop());
  if (w === 'predicated') return route.fulfill({ json: entry('predicated', 'simple past tense and past participle of predicate') });
  if (w === 'predicate') return route.fulfill({ json: entry('predicate', 'To base something on a particular belief or idea.', 'The plan is predicated on growth.') });
  if (w === 'obfuscatory') return route.abort();
  return route.fulfill({ status: 404, json: { title: 'No Definitions Found' } });
});
await page.getByRole('button', { name: 'קריאה', exact: true }).click();
await page.locator('textarea').fill('The committee said its decision was predicated on flawed data. Mitigating the risks proved hard, and the obfuscatory report helped nobody.');
await page.getByRole('button', { name: 'לסמן מילים חדשות' }).click();
const newToks = await page.locator('.tok.new').allTextContents();
const knownToks = await page.locator('.tok.known').allTextContents();
newToks.includes('predicated') && !newToks.includes('committee') ? ok('reading highlights unfamiliar words only: ' + newToks.join(', ')) : fail('highlighting wrong: ' + newToks);
knownToks.includes('Mitigating') ? ok('inflected list word recognised (Mitigating → mitigate)') : fail('known words: ' + knownToks);
await page.screenshot({ path: `${out}/15-reading.png`, fullPage: true });
await page.locator('.tok.new', { hasText: 'predicated' }).click();
await page.locator('.sheet .headword', { hasText: 'predicate' }).waitFor();
ok('lookup followed the inflected form to "predicate"');
await page.locator('.sheet input[lang=he]').fill('לבסס על');
await page.screenshot({ path: `${out}/16-add-word.png`, fullPage: true });
await page.getByRole('button', { name: 'להוסיף למילים שלי' }).click();
await page.getByText(/„predicate” נוספה/).waitFor();
ok('custom word saved');
await page.locator('.tok.new', { hasText: 'obfuscatory' }).click();
await page.getByText(/לא הצלחנו להגיע למילון|אין חיבור/).waitFor();
await page.locator('.sheet textarea').fill('Making something deliberately unclear.');
await page.getByRole('button', { name: 'להוסיף למילים שלי' }).click();
await page.getByText(/„obfuscatory” נוספה/).waitFor();
ok('offline fallback lets you type your own definition');
await page.getByRole('button', { name: 'מילים', exact: true }).click();
await page.locator('.search').fill('predicate');
await page.locator('.list-item').first().click();
await page.locator('.more summary').click();
await page.getByText('הוספת בעצמך').waitFor();
(await page.locator('.example-main mark').first().textContent()) === 'predicated' ? ok('example sentence from the text is kept, with the target marked') : fail('example not bracketed');

// backup export + import
await page.getByRole('button', { name: 'הגדרות', exact: true }).click();
const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'ייצוא גיבוי' }).click()]);
const path = `${out}/backup.json`;
await dl.saveAs(path);
const backup = JSON.parse(readFileSync(path, 'utf8'));
backup.tables.progress.length >= 10 ? ok(`backup contains ${backup.tables.progress.length} words`) : fail('backup content wrong');
page.once('dialog', (d) => d.accept());
await page.locator('input[type=file]').setInputFiles(path);
await page.getByText(/שוחזרו \d+ מילים/).waitFor({ timeout: 5000 }).then(() => ok('backup imports'), () => fail('import failed'));
await page.screenshot({ path: `${out}/09-settings.png`, fullPage: true });

// offline after the service worker installed
await page.waitForTimeout(1500);
await page.goto(URL);
await page.evaluate(() => navigator.serviceWorker.ready);
await ctx.setOffline(true);
await page.reload();
await page.getByText('מילים בלמידה').waitFor({ timeout: 5000 }).then(() => ok('works offline'), () => fail('offline reload failed'));
await ctx.setOffline(false);

// the deliberately aborted dictionary request logs one ERR_FAILED; anything else is a real error
const real = errors.filter((e) => !/ERR_FAILED/.test(e));
real.length ? fail('page errors: ' + real.join(' | ')) : ok('no console errors');
await browser.close();
