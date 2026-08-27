/**
 * End-to-end smoke test.
 *
 * Drives the real app in Chromium against the real generated data: boots it, walks into a Grand Test,
 * answers questions, opens the palette, submits, and reads the analysis. Fails on any console error or
 * page exception, because those are exactly the faults that reach a phone as a white screen.
 *
 * Usage: node tests/smoke.mjs [--headed] [--shots <dir>]
 */

import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PW = '/opt/node22/lib/node_modules/playwright/index.js';

const args = process.argv.slice(2);
const HEADED = args.includes('--headed');
const SHOT_DIR = args.includes('--shots') ? args[args.indexOf('--shots') + 1] : join(ROOT, '.shots');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function serve() {
  const server = createServer(async (req, res) => {
    try {
      let path = decodeURIComponent(req.url.split('?')[0]);
      if (path === '/') path = '/index.html';
      const full = join(ROOT, normalize(path).replace(/^(\.\.[/\\])+/, ''));
      if (!existsSync(full)) {
        res.writeHead(404).end('not found');
        return;
      }
      const body = await readFile(full);
      res.writeHead(200, { 'Content-Type': MIME[extname(full)] || 'application/octet-stream' });
      res.end(body);
    } catch (err) {
      res.writeHead(500).end(String(err));
    }
  });
  return new Promise((resolve) => server.listen(0, () => resolve(server)));
}

const failures = [];
const steps = [];

function ok(label) {
  steps.push(`  ok   ${label}`);
}
function bad(label, detail) {
  failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
  steps.push(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

async function main() {
  if (!existsSync(join(ROOT, 'data', 'catalog.json'))) {
    console.error('No data/catalog.json — run build/build_index.py first.');
    process.exit(2);
  }

  const { chromium } = await import(PW);
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  await mkdir(SHOT_DIR, { recursive: true });

  const browser = await chromium.launch({
    headless: !HEADED,
    executablePath: '/opt/pw-browsers/chromium/chrome-linux/chrome',
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));

  const shot = async (name) => {
    await page.screenshot({ path: join(SHOT_DIR, `${name}.png`) });
  };

  try {
    // ---- boot -------------------------------------------------------------
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);

    const bootError = await page.locator('.boot-error').count();
    if (bootError > 0) {
      const msg = await page.locator('.boot-error code').textContent().catch(() => '');
      bad('app boots', `boot-error shown: ${msg}`);
    } else ok('app boots');

    const bodyText = (await page.locator('body').innerText()).trim();
    if (bodyText.length < 20) bad('home screen renders content', `only ${bodyText.length} chars visible`);
    else ok('home screen renders content');
    await shot('01-home');

    // ---- theme ------------------------------------------------------------
    await page.click('#theme-btn');
    await page.waitForTimeout(250);
    const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    if (!theme) bad('theme toggle sets data-theme');
    else ok(`theme toggle sets data-theme=${theme}`);
    await shot('02-theme');
    await page.click('#theme-btn');
    await page.waitForTimeout(200);

    // ---- practice browse --------------------------------------------------
    await page.click('.tabbar__item[data-screen="practice"]');
    await page.waitForTimeout(500);
    const practiceRows = await page.locator('.row').count();
    if (practiceRows === 0) bad('practice lists subjects');
    else ok(`practice lists ${practiceRows} subjects`);
    await shot('03-practice');

    // ---- tests list -------------------------------------------------------
    await page.click('.tabbar__item[data-screen="tests"]');
    await page.waitForTimeout(600);
    const paperRows = await page.locator('.row').count();
    if (paperRows === 0) bad('tests lists papers');
    else ok(`tests lists ${paperRows} papers`);
    await shot('04-tests');

    // ---- start a grand test ----------------------------------------------
    await page.locator('.row').first().click();
    await page.waitForTimeout(400);
    await shot('05-test-sheet');

    const startBtn = page.locator('.sheet button', { hasText: /start/i }).first();
    if ((await startBtn.count()) === 0) {
      bad('paper sheet offers Start');
    } else {
      ok('paper sheet offers Start');
      await startBtn.click();
      await page.waitForTimeout(1500);

      const optionCount = await page.locator('.option').count();
      if (optionCount < 3) bad('GT renders a question with options', `saw ${optionCount}`);
      else ok(`GT renders a question with ${optionCount} options`);

      const clock = await page.locator('#gt-clock').textContent().catch(() => null);
      if (!clock || !/\d/.test(clock)) bad('GT shows a running clock');
      else ok(`GT clock reads ${clock}`);

      // The answer key must not be anywhere in the page before submit.
      const leak = await page.evaluate(() => {
        const html = document.documentElement.outerHTML;
        return /"correct"\s*:/.test(html) || /data-correct/.test(html);
      });
      if (leak) bad('answer key absent from the DOM before submit');
      else ok('answer key absent from the DOM before submit');
      await shot('06-gt-question');

      // Answer a few, mark one, then open the palette.
      for (let i = 0; i < 4; i++) {
        const opts = page.locator('.option');
        if ((await opts.count()) === 0) break;
        await opts.nth(i % (await opts.count())).click();
        await page.waitForTimeout(120);
        const nextBtn = page.locator('#gt-actions button', { hasText: /^(Next|Review)$/ }).first();
        if ((await nextBtn.count()) > 0) {
          await nextBtn.click();
          await page.waitForTimeout(180);
        }
      }
      ok('answered several questions without error');

      const markBtn = page.locator('#gt-actions button', { hasText: /^Mark$/ }).first();
      if ((await markBtn.count()) > 0) {
        await markBtn.click();
        await page.waitForTimeout(150);
        ok('mark for review works');
      }

      await page.locator('#gt-actions button').first().click(); // palette
      await page.waitForTimeout(400);
      const cells = await page.locator('.pcell').count();
      if (cells === 0) bad('palette renders cells');
      else ok(`palette renders ${cells} cells`);

      const answeredCells = await page.locator('.pcell[data-state="answered"]').count();
      if (answeredCells === 0) bad('palette shows answered state');
      else ok(`palette shows ${answeredCells} answered`);
      await shot('07-palette');

      // ---- submit ---------------------------------------------------------
      await page.locator('.sheet button', { hasText: /submit/i }).first().click();
      await page.waitForTimeout(400);
      await shot('08-submit-confirm');
      const confirmBtn = page.locator('button', { hasText: /^Submit$/ }).last();
      await confirmBtn.click();
      await page.waitForTimeout(2000);

      // ---- analysis -------------------------------------------------------
      const heroText = await page.locator('.hero__title').first().textContent().catch(() => '');
      if (!heroText || !/\d+\s*\/\s*\d+/.test(heroText)) bad('analysis shows a score', `hero read "${heroText}"`);
      else ok(`analysis shows score ${heroText.trim()}`);

      const reviewItems = await page.locator('.review__item').count();
      if (reviewItems === 0) bad('analysis lists reviewable questions');
      else ok(`analysis lists ${reviewItems} reviewable questions`);

      const nan = (await page.locator('body').innerText()).includes('NaN');
      if (nan) bad('no NaN anywhere in the analysis');
      else ok('no NaN anywhere in the analysis');
      await shot('09-analysis');

      // Every explanation panel must have either real content or the honest stub label.
      const emptyExplain = await page.evaluate(() =>
        Array.from(document.querySelectorAll('.explain')).filter((e) => e.innerText.trim().length < 12).length
      );
      if (emptyExplain > 0) bad('no empty explanation panels', `${emptyExplain} blank`);
      else ok('no empty explanation panels');
    }

    // ---- review and stats -------------------------------------------------
    for (const screen of ['review', 'stats']) {
      await page.evaluate((s) => location.assign(`#/${s}`), screen);
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(900);
      const text = (await page.locator('body').innerText()).trim();
      if (text.length < 10) bad(`${screen} screen renders`);
      else ok(`${screen} screen renders`);
      await shot(`10-${screen}`);
    }

    if (consoleErrors.length > 0) {
      bad('no console errors', `${consoleErrors.length}: ${consoleErrors.slice(0, 4).join(' | ')}`);
    } else ok('no console errors');
  } catch (err) {
    bad('smoke run completed', err.message);
    await shot('99-crash');
  } finally {
    await browser.close();
    server.close();
  }

  console.log('\nSmoke test');
  console.log(steps.join('\n'));
  await writeFile(join(SHOT_DIR, 'report.txt'), steps.join('\n'));

  if (failures.length > 0) {
    console.log(`\n${failures.length} failure(s):`);
    for (const f of failures) console.log(`  - ${f}`);
    console.log(`\nScreenshots: ${SHOT_DIR}`);
    process.exit(1);
  }
  console.log(`\nAll ${steps.length} checks passed. Screenshots: ${SHOT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
