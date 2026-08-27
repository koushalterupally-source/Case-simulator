/**
 * Static module-graph check.
 *
 * Most of the app touches `document` and so cannot be imported in Node, which means a mistyped import
 * name would otherwise surface only as a runtime crash in the browser. This parses every module's
 * imports and exports and checks them against each other — cheap, and it catches the integration bug
 * that a 13-module app with no bundler is most likely to have.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../src', import.meta.url));

async function jsFiles(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await jsFiles(full)));
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

function parseExports(source) {
  const names = new Set();
  const re = /^export\s+(?:async\s+)?(?:function\*?|class|const|let|var)\s+([A-Za-z_$][\w$]*)/gm;
  let m;
  while ((m = re.exec(source))) names.add(m[1]);

  // export { a, b as c }
  const braced = /^export\s*\{([^}]*)\}/gm;
  while ((m = braced.exec(source))) {
    for (const part of m[1].split(',')) {
      const piece = part.trim();
      if (!piece) continue;
      const as = piece.split(/\s+as\s+/);
      names.add((as[1] || as[0]).trim());
    }
  }
  return names;
}

function parseImports(source) {
  const out = [];
  const re = /^import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/gm;
  let m;
  while ((m = re.exec(source))) {
    const clause = m[1].trim();
    const spec = m[2];
    if (clause.startsWith('*')) {
      out.push({ spec, namespace: true, names: [] });
      continue;
    }
    const braceMatch = clause.match(/\{([^}]*)\}/);
    const names = braceMatch
      ? braceMatch[1]
          .split(',')
          .map((s) => s.trim().split(/\s+as\s+/)[0].trim())
          .filter(Boolean)
      : [];
    out.push({ spec, namespace: false, names });
  }
  return out;
}

const files = await jsFiles(SRC);
const exportsByFile = new Map();
for (const file of files) {
  exportsByFile.set(file, parseExports(await readFile(file, 'utf8')));
}

test('the source tree has the modules the architecture describes', () => {
  const expected = [
    'app.js', 'data.js', 'dom.js', 'gt.js', 'net.js', 'practice.js', 'sanitize.js',
    'store.js', 'ui.js',
    'screens/analysis.js', 'screens/browse.js', 'screens/gt-screen.js',
    'screens/home.js', 'screens/practice-screen.js', 'screens/review.js', 'screens/stats.js',
  ];
  for (const rel of expected) {
    assert.ok(existsSync(join(SRC, rel)), `missing module: src/${rel}`);
  }
});

test('every relative import resolves to a file that exists', async () => {
  const problems = [];
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    for (const imp of parseImports(source)) {
      if (!imp.spec.startsWith('.')) continue;
      const target = resolve(dirname(file), imp.spec);
      if (!existsSync(target)) {
        problems.push(`${relative(SRC, file)} imports "${imp.spec}" which does not exist`);
      }
    }
  }
  assert.deepEqual(problems, []);
});

test('every named import is actually exported by its target', async () => {
  const problems = [];
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    for (const imp of parseImports(source)) {
      if (!imp.spec.startsWith('.') || imp.namespace) continue;
      const target = resolve(dirname(file), imp.spec);
      const available = exportsByFile.get(target);
      if (!available) continue;
      for (const name of imp.names) {
        if (!available.has(name)) {
          problems.push(
            `${relative(SRC, file)} imports { ${name} } from "${imp.spec}", which does not export it`
          );
        }
      }
    }
  }
  assert.deepEqual(problems, []);
});

test('the service worker precaches every module in the source tree', async () => {
  // A module missing from the precache list is a screen that fails to open offline.
  const sw = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  const missing = files
    .map((f) => `./src/${relative(SRC, f).split('\\').join('/')}`)
    .filter((rel) => !sw.includes(rel));
  assert.deepEqual(missing, [], 'add these to the SHELL list in sw.js');
});

test('no module reaches for fetch() on a local path', async () => {
  // fetch() against file:// fails silently in Android WebView; net.js exists to avoid exactly that.
  const problems = [];
  for (const file of files) {
    if (file.endsWith('net.js')) continue;
    const source = await readFile(file, 'utf8');
    const stripped = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    if (/\bfetch\s*\(/.test(stripped)) {
      problems.push(`${relative(SRC, file)} calls fetch() directly — use loadJSON from net.js`);
    }
  }
  assert.deepEqual(problems, []);
});

test('corpus markup only reaches the DOM through the sanitizer', async () => {
  // dom.js owns the one sanctioned innerHTML assignment; ui.js builds its own trusted chrome.
  const problems = [];
  for (const file of files) {
    if (file.endsWith('dom.js') || file.endsWith('sanitize.js') || file.endsWith('ui.js')) continue;
    const source = await readFile(file, 'utf8');
    const stripped = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const matches = stripped.match(/\.innerHTML\s*=\s*(.+)/g) || [];
    for (const line of matches) {
      // Clearing a node is fine; assigning anything else is not.
      if (!/=\s*['"`]\s*['"`]\s*;?\s*$/.test(line)) {
        problems.push(`${relative(SRC, file)}: ${line.trim()}`);
      }
    }
  }
  assert.deepEqual(problems, []);
});

test('the service worker bypasses the case simulator with or without trailing slash', async () => {
  const sw = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  assert.ok(
    sw.includes('/\\/simulator(?:\\/|$)/.test(url.pathname)'),
    'sw.js must use regex to bypass /simulator with or without trailing slash'
  );
  const regex = /\/simulator(?:\/|$)/;
  assert.equal(regex.test('/simulator'), true);
  assert.equal(regex.test('/simulator/'), true);
  assert.equal(regex.test('/simulator/index.html'), true);
  assert.equal(regex.test('/simulator/assets/index.js'), true);
  assert.equal(regex.test('/other'), false);
});

test('index.html supports prefers-color-scheme light/dark theme-color meta tags', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(
    html.includes('<meta name="theme-color" content="#f3f4f6" media="(prefers-color-scheme: light)">'),
    'missing light theme-color meta tag'
  );
  assert.ok(
    html.includes('<meta name="theme-color" content="#0f172a" media="(prefers-color-scheme: dark)">'),
    'missing dark theme-color meta tag'
  );
});

test('ui.js uses pyq-theme as THEME_KEY aligning with index.html and simulator', async () => {
  const uiSrc = await readFile(new URL('../src/ui.js', import.meta.url), 'utf8');
  const indexHtml = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(uiSrc.includes("THEME_KEY = 'pyq-theme'"), "ui.js must use 'pyq-theme'");
  assert.ok(indexHtml.includes("localStorage.getItem('pyq-theme')"), "index.html must check 'pyq-theme'");
});

test('TAB_SCREENS in app.js excludes review so review screen gets a back button', async () => {
  const appSrc = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');
  const match = appSrc.match(/const TAB_SCREENS = new Set\(\[(.*?)\]\);/);
  assert.ok(match, 'TAB_SCREENS definition found');
  assert.ok(!match[1].includes("'review'"), 'TAB_SCREENS must not include review');
});

test('gt-screen.js only triggers 10 minutes remaining toast if durationMs > WARN_SOON_MS', async () => {
  const gtScreenSrc = await readFile(new URL('../src/screens/gt-screen.js', import.meta.url), 'utf8');
  assert.ok(
    gtScreenSrc.includes('state.session.durationMs > WARN_SOON_MS && left <= WARN_SOON_MS && !marks.soon'),
    'gt-screen.js must check session.durationMs > WARN_SOON_MS before toasting 10 min warning'
  );
});

test('gt-screen.js restarts ticker if finishing/scoring fails', async () => {
  const gtScreenSrc = await readFile(new URL('../src/screens/gt-screen.js', import.meta.url), 'utf8');
  assert.ok(
    gtScreenSrc.includes('if (state && !state.ticker) state.ticker = setInterval(tick, TICK_MS);'),
    'gt-screen.js must restart state.ticker on submit failure'
  );
});

test('dom.js triggers image fallback immediately if img is already complete with naturalWidth === 0', async () => {
  const domSrc = await readFile(new URL('../src/dom.js', import.meta.url), 'utf8');
  assert.ok(
    domSrc.includes('if (img.complete && img.naturalWidth === 0)'),
    'dom.js must check img.complete && img.naturalWidth === 0'
  );
});


