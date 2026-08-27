/**
 * Boot and routing.
 *
 * Holds no business logic — it wires the shell to the screens, guards a running Grand Test against
 * accidental exit, and makes sure a failure anywhere surfaces as a readable message rather than a
 * white page.
 */

import * as ui from './ui.js';
import * as data from './data.js';
import * as store from './store.js';
import { el, clear } from './dom.js';

import * as home from './screens/home.js';
import * as browse from './screens/browse.js';
import * as practiceScreen from './screens/practice-screen.js';
import * as gtScreen from './screens/gt-screen.js';
import * as analysis from './screens/analysis.js';
import * as review from './screens/review.js';
import * as stats from './screens/stats.js';

const TAB_SCREENS = new Set(['home', 'practice', 'tests', 'cases', 'stats']);

/**
 * The clinical case simulator is a separate bundle served from ./simulator/, not a screen in this
 * app. It keeps its own React runtime and its own question index; sharing the palette, the theme
 * key and the navigation is what makes the two read as one product. A real navigation is correct
 * here — there is nothing to preserve in this app's memory while a case is being worked.
 */
const SIMULATOR_PATH = 'simulator/';

function openSimulator() {
  location.assign(SIMULATOR_PATH);
}

let root = null;
let catalog = null;
let currentScreen = null;
let gtRunning = false;
let navSeq = 0;

export async function boot() {
  root = document.getElementById('app');
  ui.mount(root);
  ui.initTheme();

  wireChrome();
  ui.onNavigate(handleNavigate);

  // A tiny navigation hook for the end-to-end test, which needs to reach screens that no longer
  // have a tab of their own.
  window.__pyqNav = (screen, params) => ui.navigate(screen, params || {});

  catalog = await data.loadCatalog();

  if (!store.isAvailable()) {
    ui.toast('Private mode: progress will not be saved');
  }

  registerServiceWorker();

  const initial = parseHash() || { screen: 'home', params: {} };
  ui.navigate(initial.screen, initial.params, { replace: true });
}

function parseHash() {
  const raw = location.hash || '';
  if (!raw.startsWith('#/')) return null;
  const [path, query] = raw.slice(2).split('?');
  const screen = decodeURIComponent(path || '');
  if (!screen) return null;
  const params = {};
  if (query) for (const [k, v] of new URLSearchParams(query)) params[k] = v;
  return { screen, params };
}

function wireChrome() {
  const themeBtn = document.getElementById('theme-btn');
  if (themeBtn) themeBtn.addEventListener('click', () => ui.toggleTheme());

  const backBtn = document.getElementById('back-btn');
  if (backBtn) backBtn.addEventListener('click', () => history.back());

  for (const btn of document.querySelectorAll('.tabbar__item')) {
    btn.addEventListener('click', () => {
      if (btn.dataset.screen === 'cases') openSimulator();
      else ui.navigate(btn.dataset.screen);
    });
  }
}

function paintChrome(screen) {
  const backBtn = document.getElementById('back-btn');
  if (backBtn) backBtn.hidden = TAB_SCREENS.has(screen);

  // A sitting or a practice run needs the full viewport, a stray tab tap mid-exam is a trap, and
  // both runners put their own action bar where the tab bar sits.
  const RUNNERS = new Set(['gt', 'group', 'practice-resume']);
  const tabbar = document.getElementById('tabbar');
  if (tabbar) tabbar.hidden = RUNNERS.has(screen);

  for (const btn of document.querySelectorAll('.tabbar__item')) {
    if (btn.dataset.screen === screen) btn.setAttribute('aria-current', 'page');
    else btn.removeAttribute('aria-current');
  }

  const title = document.getElementById('appbar-title');
  if (title && TAB_SCREENS.has(screen)) {
    title.textContent = { home: 'PYQ', practice: 'Practice', tests: 'Grand Tests', cases: 'Cases', stats: 'Stats' }[screen] || 'PYQ';
  }
}

/**
 * Leaving a running Grand Test is guarded, but the History API has already moved by the time a
 * popstate reaches us — so the guard works by asking, and pushing the exam back on if declined.
 */
async function handleNavigate(screen, params, meta) {
  if (gtRunning && screen !== 'gt' && screen !== 'analysis') {
    const allowed = await gtScreen.confirmLeave();
    if (!allowed) {
      ui.navigate('gt', { resume: '1' }, { replace: meta && meta.source === 'popstate' });
      return;
    }
    gtRunning = false;
  }

  const seq = ++navSeq;

  // Tear down the screen being left, so no timer or listener outlives it.
  if (currentScreen && currentScreen !== screen) {
    if (currentScreen === 'group' || currentScreen === 'practice-resume') practiceScreen.stop();
    if (currentScreen === 'gt' && screen !== 'gt') gtScreen.stop();
  }

  // Action bars and sheets live on <body>, not inside the screen container, so clearing the
  // container does not remove them. A leftover bar would sit over the next screen's content.
  for (const stale of document.querySelectorAll('.actions, .sheet-backdrop')) stale.remove();

  currentScreen = screen;
  paintChrome(screen);

  clear(root).appendChild(el('div', { class: 'spinner', role: 'status', 'aria-label': 'Loading' }));

  try {
    await routeTo(screen, params);
  } catch (err) {
    if (seq !== navSeq) return; // a newer navigation superseded this one
    console.error(`Screen "${screen}" failed`, err);
    showScreenError(err);
  }
}

async function routeTo(screen, params) {
  switch (screen) {
    case 'home':
      return home.show(root);

    case 'practice':
      return browse.showPractice(root, params);

    case 'subject':
      return browse.showSubject(root, params);

    case 'group':
      return practiceScreen.start(root, params);

    case 'practice-resume': {
      const session = await store.get('sessions', params.sessionId);
      if (!session) return home.show(root);
      return practiceScreen.resume(root, session);
    }

    case 'tests':
      return browse.showTests(root);

    case 'gt': {
      if (params.resume === '1' || params.sessionId) {
        const session = params.sessionId
          ? await store.get('sessions', params.sessionId)
          : await mostRecentRunningGt();
        if (session) {
          gtRunning = true;
          return gtScreen.resume(root, session);
        }
      }
      const paper = data.findPaper(catalog, params.paperId);
      if (!paper) throw new Error(`No paper "${params.paperId}" in the catalog`);
      gtRunning = true;
      return gtScreen.start(root, {
        paper,
        scheme: params.scheme ? JSON.parse(params.scheme) : undefined,
        durationMs: params.durationMs ? Number(params.durationMs) : undefined,
      });
    }

    case 'analysis':
      gtRunning = false;
      return analysis.show(root, params);

    case 'cases':
      openSimulator();
      return;

    case 'review':
      return review.show(root);

    case 'stats':
      return stats.show(root);

    default:
      return home.show(root);
  }
}

async function mostRecentRunningGt() {
  try {
    const all = await store.getAll('sessions');
    return (
      all
        .filter((s) => s.kind === 'gt' && s.status === 'running')
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0] || null
    );
  } catch {
    return null;
  }
}

function showScreenError(err) {
  clear(root).appendChild(
    el('div', { class: 'boot-error' }, [
      el('h2', { text: 'This screen could not load' }),
      el('p', { text: 'The rest of the app still works. If it keeps happening, resetting clears cached data.' }),
      el('p', {}, [el('code', { text: (err && err.message) || String(err) })]),
      el('div', { style: { display: 'flex', gap: '10px', marginTop: '4px' } }, [
        el('button', { class: 'btn btn--ghost', type: 'button', text: 'Home', onclick: () => ui.navigate('home') }),
        el('a', { class: 'btn btn--primary', href: '?reset', text: 'Reset' }),
      ]),
    ])
  );
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js', { scope: './' }).catch((err) => {
      console.warn('Offline support unavailable', err);
    });
  });
}
