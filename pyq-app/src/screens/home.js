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
const TAGLINE = 'Previous-year questions & clinical cases, offline on your terms.';

const DAILY_QUOTES = [
  { quote: 'The good physician treats the disease; the great physician treats the patient who has the disease.', author: 'Sir William Osler' },
  { quote: 'Wherever the art of Medicine is loved, there is also a love of Humanity.', author: 'Hippocrates' },
  { quote: 'Medicine is a science of uncertainty and an art of probability.', author: 'Sir William Osler' },
  { quote: 'In the field of observation, chance favors only the prepared mind.', author: 'Louis Pasteur' },
  { quote: 'Better is possible. It does not take genius. It takes diligence and moral clarity.', author: 'Dr. Atul Gawande' },
  { quote: 'To study the phenomena of disease without books is to sail an uncharted sea; to study books without patients is not to go to sea at all.', author: 'Sir William Osler' },
  { quote: 'Observation, Reason, Human Understanding, Courage; these make the physician.', author: 'Dr. Martin H. Fischer' },
  { quote: 'The secret of the care of the patient is in caring for the patient.', author: 'Dr. Francis W. Peabody' },
  { quote: 'Cure sometimes, treat often, comfort always.', author: 'Dr. Edward L. Trudeau' },
  { quote: 'We are what we repeatedly do. Excellence, then, is not an act, but a habit.', author: 'Aristotle' },
  { quote: 'Every question practiced today is a patient saved tomorrow.', author: 'Clinical Adage' },
  { quote: 'Perseverance is not a long race; it is many short races one after the other.', author: 'Walter Elliot' },
];

let activeQuoteIndex = Math.floor((Date.now() / (1000 * 60 * 60 * 24)) % DAILY_QUOTES.length);

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
      quoteCard(),
      statsStrip({ results, attempts, mistakes }),
      el('div', { class: 'grid' }, [
        heroTile(unfinished),
        navCard('🎯', 'PYQ Papers', 'Previous year entrance exams (NEET-PG, INI-CET, AIIMS).', () => ui.navigate('practice', { source: 'PYQ' })),
        navCard('🧠', 'CEREB Topics', 'Topic-wise coaching question banks across 19 subjects.', () => ui.navigate('practice', { source: 'CEREB' })),
        navCard('🏹', 'ARROW High-Yield', 'Rapid-fire revision and high-yield concept questions.', () => ui.navigate('practice', { source: 'ARROW' })),
        navCard('📝', 'Grand Tests', '165 full-length mock papers with timer & review flags.', () => ui.navigate('tests')),
        navCard('🩺', 'Cases Simulator', 'Manage emergency admissions from vitals to discharge.', () => ui.navigate('cases')),
        navCard('🔍', 'Review & Mistakes', 'Every flagged item and mistake with full rationale.', () => ui.navigate('review')),
        navCard('📊', 'Stats & Backups', 'Subject-wise accuracy breakdown, test history & data export.', () => ui.navigate('stats')),
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

function quoteCard() {
  const q = DAILY_QUOTES[activeQuoteIndex % DAILY_QUOTES.length];
  const quoteText = el('p', { class: 'quote__text', text: `“${q.quote}”` });
  const quoteAuthor = el('span', { class: 'quote__author', text: `— ${q.author}` });

  const card = el('div', { class: 'quote-card' }, [
    el('div', { class: 'quote-card__header' }, [
      el('span', { class: 'quote-card__tag', text: '💡 QUOTE OF THE DAY' }),
      el('button', {
        class: 'quote-card__btn',
        type: 'button',
        'aria-label': 'Next Quote',
        title: 'Shuffle Quote',
        onclick: (e) => {
          e.stopPropagation();
          activeQuoteIndex = (activeQuoteIndex + 1) % DAILY_QUOTES.length;
          const next = DAILY_QUOTES[activeQuoteIndex];
          quoteText.textContent = `“${next.quote}”`;
          quoteAuthor.textContent = `— ${next.author}`;
        },
      }, [el('span', { text: '↻' })]),
    ]),
    quoteText,
    quoteAuthor,
  ]);

  return card;
}

function statsStrip({ results, attempts, mistakes }) {
  const gtAttempted = results.reduce((sum, r) => sum + (r.attempted || 0), 0);
  const gtCorrect = results.reduce((sum, r) => sum + (r.correct || 0), 0);
  const prAttempted = attempts.length;
  const prCorrect = attempts.filter((a) => a && a.isCorrect).length;

  const totalAnswered = gtAttempted + prAttempted;
  const totalCorrect = gtCorrect + prCorrect;
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

function navCard(icon, title, sub, onClickOrScreen) {
  const handler = typeof onClickOrScreen === 'function' ? onClickOrScreen : () => ui.navigate(onClickOrScreen);
  return el('button', { class: 'card', type: 'button', onclick: handler }, [
    el('span', { class: 'card__icon', text: icon }),
    el('div', { class: 'card__title', text: title }),
    el('div', { class: 'card__sub', text: sub }),
  ]);
}
