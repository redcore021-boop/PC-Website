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
const byDef = new Map(words.map((w) => [w.def, w]));
const fail = (m) => { console.error('FAIL:', m); process.exitCode = 1; };
const ok = (m) => console.log('ok -', m);

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

await page.goto(URL);
await page.getByText("Today's session", { exact: true }).waitFor();
await page.screenshot({ path: `${out}/01-home.png`, fullPage: true });
const newWords = Number(await page.getByText('new words', { exact: true }).locator('xpath=preceding-sibling::div').textContent());
newWords === 10 ? ok('home shows 10 new words') : fail(`expected 10 new words, got ${newWords}`);

let typed = 0, retries = 0, wrongOnPurpose = 0;
const sawTypes = new Set();
async function runSession(tag) {
  await page.getByRole('button', { name: /today's session/ }).click();
  await page.locator('.session-top').waitFor();
  await page.locator('.prompt-kind, .empty').first().waitFor();
  let steps = 0, intros = 0, answered = 0;
  while (steps++ < 150) {
    if (await page.getByText('Session complete').isVisible()) break;
    if (await page.getByRole('button', { name: /Got it/ }).isVisible()) {
      if (intros === 0 && tag === 'day1') {
        await page.screenshot({ path: `${out}/02-intro.png`, fullPage: true });
        const he = page.locator('.he-reveal');
        await he.click();
        (await he.textContent()).match(/[\u0590-\u05FF]/) ? ok('Hebrew revealed on tap') : fail('Hebrew not revealed');
      }
      intros++;
      await page.getByRole('button', { name: /Got it/ }).click();
      await page.waitForTimeout(120);
      continue;
    }
    const kind = ((await page.locator('.prompt-kind').first().textContent()) ?? '').replace(/ ·.*/, '');
    const isRetry = ((await page.locator('.prompt-kind').first().textContent()) ?? '').includes('another try');
    sawTypes.add(kind);
    if (isRetry) retries++;
    const promptText = (await page.locator('.prompt-text, .gap-sentence').first().textContent())?.trim() ?? '';
    const norm = (x) => x.replace(/\s+/g, ' ').trim();
    let target = byDef.get(promptText);
    if (!target) {
      const shown = norm(promptText.replace(/\u00a0/g, ''));
      target = words.find((w) => w.ex.some((e) => norm(plain(e.replace(/\[[^\]]+\]/, ''))) === shown));
    }
    if (!target) { fail('could not identify question: ' + promptText); await page.screenshot({ path: `${out}/fail.png` }); break; }

    if (await page.locator('.answer-input').count()) {
      typed++;
      const answer = typed === 1 ? target.word.slice(0, -1) + (target.word.endsWith('e') ? 'a' : 'e') : target.word;
      await page.locator('.answer-input').fill(answer);
      if (typed === 1) await page.screenshot({ path: `${out}/04-typing.png`, fullPage: true });
      await page.getByRole('button', { name: 'Check' }).click();
      if (typed === 1) {
        await page.locator('.feedback').waitFor();
        (await page.locator('.feedback.typo').count()) ? ok('typo accepted with a spelling note') : fail('typo not recognised');
        await page.screenshot({ path: `${out}/04b-typo.png`, fullPage: true });
      }
    } else {
      const goWrong = wrongOnPurpose === 0 && answered >= 2 && !isRetry;
      const texts = await page.locator('.option').allTextContents();
      if (!texts.includes(target.word)) { fail(`answer ${target.word} not among ${texts}`); break; }
      if (kind === 'Fill the gap' && !sawTypes.has('gap-shot')) { sawTypes.add('gap-shot'); await page.screenshot({ path: `${out}/03b-gap.png`, fullPage: true }); }
      if (answered === 0 && tag === 'day1') await page.screenshot({ path: `${out}/03-choice.png`, fullPage: true });
      if (await page.locator('.option.correct').count()) fail('answer shown before committing');
      const pick = goWrong ? texts.find((t) => t !== target.word) : target.word;
      await page.locator('.option').nth(texts.indexOf(pick)).click();
      if (goWrong) { wrongOnPurpose++; await page.screenshot({ path: `${out}/05-wrong.png`, fullPage: true }); }
    }
    answered++;
    await page.locator('.feedback').waitFor();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.waitForTimeout(120);
  }
  if (tag === 'day1') await page.screenshot({ path: `${out}/06-summary.png`, fullPage: true });
  (await page.getByText('Session complete').isVisible()) ? ok(`${tag}: session complete (${intros} intros, ${answered} answers)`) : fail(`${tag}: session did not complete`);
  await page.getByRole('button', { name: 'Done' }).click();
}

await runSession('day1');
retries >= 1 ? ok('missed word came back for another try') : fail('missed word was not repeated');

await page.getByText('words started').waitFor();
await page.waitForTimeout(200);
const started = await page.locator('.stat .num').first().textContent();
started === '10' ? ok('home shows 10 words started') : fail(`words started = ${started}`);
(await page.getByText('All done for today').isVisible()) ? ok('daily goal shows as done') : fail('expected all-done state');
await page.screenshot({ path: `${out}/07-home-done.png`, fullPage: true });

// persistence across reload
await page.reload();
await page.getByText('words started').waitFor();
(await page.locator('.stat .num').first().textContent()) === '10' ? ok('progress persists after reload') : fail('progress lost on reload');

// later days: reviews climb to gap-fill and typed cards
const DAY = 864e5;
for (let d = 1; d <= 30; d++) {
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
  await page.reload();
  try {
    await page.getByText('words started').waitFor({ timeout: 8000 });
  } catch (e) {
    console.log('BODY:', (await page.locator('body').innerText()).slice(0, 300), 'ERRORS:', errors.join(' | '));
    throw e;
  }
  if (await page.getByRole('button', { name: /today's session/ }).isVisible()) await runSession('day' + (d + 1));
  if (sawTypes.has('Type the word') && sawTypes.has('Fill the gap') && d > 8) break;
}
for (const t of ['Choose the word', 'Fill the gap', 'Type the word']) sawTypes.has(t) ? ok(`card type seen: ${t}`) : fail(`never saw card type: ${t}`);
const mastered = await page.evaluate(() => new Promise((res) => { const r = indexedDB.open('lexicon'); r.onsuccess = () => { const q = r.result.transaction('progress').objectStore('progress').getAll(); q.onsuccess = () => res(q.result.filter((p) => p.mastered).length); }; }));
console.log(`info - mastered after simulated weeks: ${mastered}`);

// browse + word page
await page.getByRole('button', { name: 'Words', exact: true }).click();
await page.locator('.search').fill('mitig');
await page.locator('.list-item').first().click();
await page.getByText('Collocations').waitFor();
await page.screenshot({ path: `${out}/08-word.png`, fullPage: true });
ok('word page renders');

// backup export + import
await page.getByRole('button', { name: 'Settings', exact: true }).click();
const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export backup' }).click()]);
const path = `${out}/backup.json`;
await dl.saveAs(path);
const backup = JSON.parse(readFileSync(path, 'utf8'));
backup.tables.progress.length >= 10 ? ok(`backup contains ${backup.tables.progress.length} words`) : fail('backup content wrong');
page.once('dialog', (d) => d.accept());
await page.locator('input[type=file]').setInputFiles(path);
await page.getByText(/Restored \d+ words/).waitFor({ timeout: 5000 }).then(() => ok('backup imports'), () => fail('import failed'));
await page.screenshot({ path: `${out}/09-settings.png`, fullPage: true });

// offline after the service worker installed
await page.waitForTimeout(1500);
await page.goto(URL);
await page.evaluate(() => navigator.serviceWorker.ready);
await ctx.setOffline(true);
await page.reload();
await page.getByText('words started').waitFor({ timeout: 5000 }).then(() => ok('works offline'), () => fail('offline reload failed'));
await ctx.setOffline(false);

errors.length ? fail('page errors: ' + errors.join(' | ')) : ok('no console errors');
await browser.close();
