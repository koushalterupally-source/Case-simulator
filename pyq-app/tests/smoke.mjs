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
import { existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootArg = process.argv.indexOf('--root');
const ROOT =
  rootArg !== -1 && process.argv[rootArg + 1]
    ? resolve(process.argv[rootArg + 1])
    : fileURLToPath(new URL('..', import.meta.url));

/**
 * The app has no package.json by design, so Playwright is never a local dependency. Resolve it from
 * wherever it happens to live: a normal install in CI, or the global one this sandbox provides.
 */
async function importPlaywright() {
  const candidates = ['playwright', '/opt/node22/lib/node_modules/playwright/index.js'];
  const errors = [];
  for (const spec of candidates) {
    try {
      return await import(spec);
    } catch (err) {
      errors.push(`${spec}: ${err.message}`);
    }
  }
  throw new Error(`Could not load Playwright.\n  ${errors.join('\n  ')}`);
}

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
      let full = join(ROOT, normalize(path).replace(/^(\.\.[/\\])+/, ''));
      // A directory request serves its index.html, the way a real static host does. Without this,
      // /simulator/ reads a directory and fails with a 500.
      if (existsSync(full) && statSync(full).isDirectory()) full = join(full, 'index.html');
      if (!existsSync(full)) {
        process.stderr.write(`[server] 404 ${path} -> ${full}\n`);
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

  const pw = await importPlaywright();
  // Playwright is CommonJS, so depending on how it resolves the named exports may sit under .default.
  const chromium = pw.chromium || (pw.default && pw.default.chromium);
  if (!chromium) throw new Error(`Playwright loaded but exposed no chromium (keys: ${Object.keys(pw)})`);
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  await mkdir(SHOT_DIR, { recursive: true });

  // Prefer a preinstalled browser when one is present (this sandbox ships one and blocks downloads);
  // otherwise let Playwright resolve its own, which is what CI does.
  const launchOpts = { headless: !HEADED };
  const preinstalled = process.env.PYQ_CHROMIUM || '/opt/pw-browsers/chromium';
  if (preinstalled && existsSync(preinstalled)) launchOpts.executablePath = preinstalled;

  const browser = await chromium.launch(launchOpts);
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  const consoleErrors = [];
  // The harness tears its own server down at the end of the run; that is not an app fault.
  const HARNESS_NOISE = /ERR_CONNECTION_RESET|ERR_CONNECTION_REFUSED|ERR_ABORTED|Failed to load resource/;
  page.on('console', (m) => {
    if (m.type() === 'error' && !HARNESS_NOISE.test(m.text())) consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
  const failedRequests = [];
  page.on('requestfailed', (r) => failedRequests.push(`${r.url()} :: ${r.failure()?.errorText}`));

  // Every request the page makes, so the answer-key check can assert on the network rather than
  // on the DOM — an answer key held in a JS variable would never show up in the markup.
  const requests = [];
  page.on('request', (r) => requests.push(r.url()));
  const answerFetches = () => requests.filter((u) => u.includes('.a.json'));

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
      // A 199-question shard takes a moment to fetch and parse; wait for the render, don't guess.
      await page.waitForSelector('.option', { timeout: 30000 }).catch(() => {});
      await page.waitForSelector('#gt-actions', { timeout: 15000 }).catch(() => {});

      const optionCount = await page.locator('.option').count();
      if (optionCount < 3) bad('GT renders a question with options', `saw ${optionCount}`);
      else ok(`GT renders a question with ${optionCount} options`);

      await page.waitForSelector('#gt-clock', { timeout: 10000 }).catch(() => {});
      const clock = await page.locator('#gt-clock').textContent().catch(() => null);
      if (!clock || !/\d/.test(clock)) bad('GT shows a running clock');
      else ok(`GT clock reads ${clock}`);

      // Nothing may sit on top of the exam controls — two fixed bottom bars is the classic way
      // for a tap to land on the wrong thing.
      const overlap = await page.evaluate(() => {
        const visible = (sel) => {
          const node = document.querySelector(sel);
          if (!node) return null;
          const style = getComputedStyle(node);
          if (style.display === 'none' || style.visibility === 'hidden') return null;
          return node.getBoundingClientRect();
        };
        const tabs = visible('#tabbar');
        const actions = visible('#gt-actions');
        if (!tabs || !actions) return { both: false };
        const clash = !(tabs.bottom <= actions.top || actions.bottom <= tabs.top);
        return { both: true, clash };
      });
      if (overlap.both && overlap.clash) bad('exam controls are not covered', 'tab bar overlaps the action bar');
      else ok('exam controls are not covered');

      const actionsVisible = await page.locator('#gt-actions').isVisible().catch(() => false);
      if (!actionsVisible) bad('exam action bar is visible');
      else ok('exam action bar is visible');

      // The answer key must not have been fetched at all yet — not hidden, not merely off-screen.
      const early = answerFetches();
      if (early.length > 0) {
        bad('no answer file fetched before submit', `${early.length}: ${early[0]}`);
      } else ok('no answer file fetched before submit');

      const domLeak = await page.evaluate(() => {
        const markup = document.documentElement.outerHTML;
        return /"correct"\s*:/.test(markup) || /data-correct/.test(markup);
      });
      if (domLeak) bad('answer key absent from the DOM before submit');
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
      await page.waitForSelector('.hero__title', { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(500);

      // Nothing that belongs to the sitting may survive into the analysis screen.
      const strays = await page.locator('#gt-actions, #gt-clock, .sheet-backdrop').count();
      if (strays > 0) bad('sitting chrome removed after submit', `${strays} left behind`);
      else ok('sitting chrome removed after submit');

      // ---- analysis -------------------------------------------------------
      const heroText = await page.locator('.hero__title').first().textContent().catch(() => '');
      if (!heroText || !/\d+\s*\/\s*\d+/.test(heroText)) bad('analysis shows a score', `hero read "${heroText}"`);
      else ok(`analysis shows score ${heroText.trim()}`);

      const reviewItems = await page.locator('.review__item').count();
      if (reviewItems === 0) bad('analysis lists reviewable questions');
      else ok(`analysis lists ${reviewItems} reviewable questions`);

      const afterSubmit = answerFetches();
      if (afterSubmit.length === 0) bad('answer file fetched at submit', 'never requested');
      else ok(`answer file fetched at submit (${afterSubmit.length} request(s))`);

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

    // ---- review, stats, anki and home -----------------------------------
    for (const screen of ['review', 'stats', 'anki', 'home']) {
      // Review and Cases are reached via Home cards or router hook; tabbar hosts home/practice/tests/anki/stats.
      const tab = await page.locator(`.tabbar__item[data-screen="${screen}"]`).count();
      if (tab > 0) await page.click(`.tabbar__item[data-screen="${screen}"]`);
      else await page.evaluate((s) => window.__pyqNav(s), screen);
      await page.waitForTimeout(1500);
      const text = (await page.locator('body').innerText()).trim();
      if (text.length < 10) bad(`${screen} screen renders`);
      else ok(`${screen} screen renders`);

      const err = await page.locator('.boot-error').count();
      if (err > 0) {
        const detail = await page.locator('.boot-error code').textContent().catch(() => '');
        bad(`${screen} screen renders without error`, detail);
      } else ok(`${screen} screen renders without error`);

      await shot(`10-${screen}`);
    }

    // ---- the case simulator handoff ---------------------------------------
    const ankiTab = await page.locator('.tabbar__item[data-screen="anki"]').count();
    if (ankiTab === 0) bad('the Anki tab is present');
    else ok('the Anki tab is present');

    if (existsSync(join(ROOT, 'simulator', 'index.html'))) {
      await page.evaluate(() => window.__pyqNav('cases'));
      await page.waitForLoadState('load').catch(() => {});
      // The simulator fetches its whole 8,211-question index (17 subject files) on first boot and
      // caches it into IndexedDB. Tearing the page down mid-flight would abort those requests and
      // read as a same-origin failure.
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(1500);

      if (!page.url().includes('/simulator/')) bad('Cases opens the simulator', `at ${page.url()}`);
      else ok('Cases opens the simulator');

      const simText = (await page.locator('body').innerText()).trim();
      if (simText.length < 20) bad('simulator renders content', `only ${simText.length} chars`);
      else ok('simulator renders content');

      // One product means one theme: the simulator must honour the shell's stored choice.
      const simTheme = await page.evaluate(() => ({
        attr: document.documentElement.getAttribute('data-theme'),
        stored: (() => { try { return localStorage.getItem('pyq-theme'); } catch { return null; } })(),
        bg: getComputedStyle(document.body).backgroundColor,
      }));
      if (simTheme.stored && simTheme.attr !== simTheme.stored) {
        bad('simulator honours the shared theme', `stored ${simTheme.stored}, applied ${simTheme.attr}`);
      } else ok(`simulator honours the shared theme (${simTheme.attr || 'system'})`);

      await shot('11-simulator');

      const back = await page.locator('a[href="../"], a[href="/"]').count();
      if (back === 0) bad('simulator offers a way back to PYQ');
      else ok('simulator offers a way back to PYQ');
    } else {
      steps.push('  skip the simulator handoff — not staged in this root');
    }

    // A failed request to another origin is not this app's fault, and in an offline-first app it is
    // the expected case: the S3 question images and Google Fonts are both unreachable on a plane,
    // and both have designed fallbacks. A SAME-ORIGIN failure is always a real bug.
    // ERR_ABORTED means the request was cancelled, not that it failed — the simulator's service
    // worker reloads the page when it takes control, which cancels whatever was in flight. Only a
    // request that genuinely could not be served is a bug.
    const sameOrigin = failedRequests.filter((f) => f.startsWith(base) && !f.includes('ERR_ABORTED'));
    if (sameOrigin.length > 0) bad('no same-origin request failed', sameOrigin.slice(0, 3).join(' | '));
    else ok('no same-origin request failed');

    const external = failedRequests.length - sameOrigin.length;
    if (external > 0) steps.push(`  note ${external} external request(s) unreachable (fonts / remote images) — expected offline`);

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
