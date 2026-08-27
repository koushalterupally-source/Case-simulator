/**
 * Home screen — the app's front door.
 *
 * Reads only from the stores; loading a catalog or a shard belongs to the screens the grid links
 * to, not here. Every number on this screen must degrade to a sensible zero rather than NaN or a
 * thrown error, since this is the one screen guaranteed to render on a completely fresh install
 * with every store empty.
 *
 * Routing note: this screen navigates by name only ('tests', 'practice', 'gt', 'practice-resume')
 * and leaves resolving those names to app.js's router — exactly like gt-screen.js navigating to
 * 'analysis' with a bare sessionId. 'practice-resume' is the screen app.js's router already wires
 * to `store.get('sessions', sessionId)` followed by `practiceScreen.resume(root, session)`.
 */

import * as store from '../store.js';
import * as ui from '../ui.js';
import { el, clear, pct } from '../dom.js';

const APP_NAME = 'PYQ';
const TAGLINE = 'Previous-year questions, offline, on your terms.';

export async function show(root) {
  clear(root);
  setTitle(APP_NAME);

  const [sessions, results, attempts, mistakes] = await Promise.all([
    safeGetAll('sessions'),
    safeGetAll('results'),
    safeGetAll('attempts'),
    safeGetAll('mistakes'),
  ]);

  const unfinished = pickUnfinished(sessions);

  root.appendChild(
    el('div', { class: 'screen' }, [
      masthead(),
      statsStrip({ results, attempts, mistakes }),
      el('div', { class: 'grid' }, [
        heroTile(unfinished),
        navCard('📚', 'Practice', 'Subject-wise and topic-wise question banks.', 'practice'),
        navCard('🎯', 'Tests', 'Full-length mock papers under exam conditions.', 'tests'),
        navCard('🩺', 'Cases', 'Work a patient from presentation to diagnosis.', 'cases'),
        navCard('🧠', 'Review', 'Every mistake and bookmark, with the full explanation.', 'review'),
        navCard('📊', 'Stats', 'Accuracy by subject, test history, backups.', 'stats'),
      ]),
    ])
  );
}

function setTitle(text) {
  const t = document.getElementById('appbar-title');
  if (t) t.textContent = text;
}

async function safeGetAll(name) {
  try {
    return await store.getAll(name);
  } catch (err) {
    // Private browsing / quota failures degrade to "no data yet" rather than a broken home screen.
    console.warn(`home: could not read store "${name}"`, err);
    return [];
  }
}

function pickUnfinished(sessions) {
  const running = sessions.filter((s) => s && s.status === 'running');
  if (running.length === 0) return null;
  running.sort((a, b) => (b.updatedAt || b.startedAt || 0) - (a.updatedAt || a.startedAt || 0));
  return running[0];
}

function masthead() {
  return el('div', { class: 'masthead' }, [el('h1', { text: APP_NAME }), el('p', { text: TAGLINE })]);
}

function statsStrip({ results, attempts, mistakes }) {
  const gtAttempted = results.reduce((sum, r) => sum + (r.attempted || 0), 0);
  const gtCorrect = results.reduce((sum, r) => sum + (r.correct || 0), 0);
  const prAttempted = attempts.length;
  const prCorrect = attempts.filter((a) => a && a.isCorrect).length;

  const totalAnswered = gtAttempted + prAttempted;
  const totalCorrect = gtCorrect + prCorrect;
  // An all-zero fresh install must read 0%, never NaN%.
  const accuracy = totalAnswered > 0 ? totalCorrect / totalAnswered : 0;

  return el('div', { class: 'stats' }, [
    stat(totalAnswered, 'Answered'),
    stat(pct(accuracy), 'Accuracy'),
    stat(results.length, 'Tests taken'),
    stat(mistakes.length, 'Mistakes'),
  ]);
}

function stat(value, label) {
  return el('div', { class: 'stat' }, [
    el('div', { class: 'stat__value', text: String(value) }),
    el('div', { class: 'stat__label', text: label }),
  ]);
}

function heroTile(session) {
  if (!session) {
    return el(
      'button',
      { class: 'hero', type: 'button', onclick: () => ui.navigate('tests') },
      [
        el('div', {}, [
          el('div', { class: 'hero__title', text: 'Start a Grand Test' }),
          el('div', {
            class: 'hero__sub',
            text: 'Sit a full-length mock paper under exam conditions — timed, negative marking optional.',
          }),
        ]),
        el('div', { class: 'hero__icon', text: '🎯' }),
      ]
    );
  }

  const answered = Object.keys(session.answers || {}).length;
  const left = Math.max(0, (session.count || 0) - answered);
  const isGT = session.kind === 'gt';
  const label = isGT ? session.paperName || 'your test' : session.groupName || session.title || 'your set';

  return el(
    'button',
    {
      class: 'hero',
      type: 'button',
      onclick: () => ui.navigate(isGT ? 'gt' : 'practice-resume', { sessionId: session.id }),
    },
    [
      el('div', {}, [
        el('div', { class: 'hero__title', text: 'Resume where you left off' }),
        el('div', { class: 'hero__sub', text: `${label} · ${left} of ${session.count || 0} left` }),
      ]),
      el('div', { class: 'hero__icon', text: isGT ? '⏱️' : '📖' }),
    ]
  );
}

function navCard(icon, title, sub, screen) {
  return el('button', { class: 'card', type: 'button', onclick: () => ui.navigate(screen) }, [
    el('span', { class: 'card__icon', text: icon }),
    el('div', { class: 'card__title', text: title }),
    el('div', { class: 'card__sub', text: sub }),
  ]);
}
