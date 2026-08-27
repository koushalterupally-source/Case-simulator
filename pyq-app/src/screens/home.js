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

const DAILY_QUESTIONS = [
  {
    id: 'qod_01',
    subject: 'Medicine',
    exam: 'NEET-PG High Yield',
    question: 'A 55-year-old male with a history of acute anterior MI presents 3 weeks later with sharp, pleuritic chest pain that worsens on lying supine and improves on leaning forward. Pericardial friction rub is heard. What is the most likely diagnosis?',
    options: ['Dressler Syndrome (Post-MI Pericarditis)', 'Myocardial Reinfarction', 'Ventricular Free Wall Rupture', 'Acute Papillary Muscle Rupture'],
    correct: 0,
    pearl: 'Dressler syndrome is an autoimmune pericarditis developing 2 to 10 weeks post-MI. Treatment: High-dose Aspirin + Colchicine.',
  },
  {
    id: 'qod_02',
    subject: 'Pharmacology',
    exam: 'INI-CET Recall',
    question: 'Which of the following antimicrobial agents causes Gray Baby Syndrome due to deficient hepatic glucuronidation in neonates?',
    options: ['Chloramphenicol', 'Ceftriaxone', 'Gentamicin', 'Tetracycline'],
    correct: 0,
    pearl: 'Chloramphenicol in neonates causes Gray Baby Syndrome due to immature UDP-glucuronyl transferase and reduced renal clearance.',
  },
  {
    id: 'qod_03',
    subject: 'Surgery',
    exam: 'NEET-PG High Yield',
    question: 'A 40-year-old female presents with multiple refractory peptic ulcers in the distal duodenum and fasting serum gastrin >1000 pg/mL. What is the investigation of choice for tumor localization?',
    options: ['68Ga-DOTATATE PET-CT / Somatostatin Receptor Scintigraphy', 'Abdominal Ultrasound', 'Barium Meal Series', 'Diagnostic Laparoscopy'],
    correct: 0,
    pearl: 'Gastrinoma (Zollinger-Ellison Syndrome) most commonly arises in the Passaro Triangle. 68Ga-DOTATATE PET-CT is the gold standard localization study.',
  },
];

let activeQuoteIndex = Math.floor((Date.now() / (1000 * 60 * 60 * 24)) % DAILY_QUOTES.length);
let activeQodIndex = Math.floor((Date.now() / (1000 * 60 * 60 * 24)) % DAILY_QUESTIONS.length);
let qodAnswerState = { answered: false, chosen: null };

export async function show(root) {
  clear(root);
  setTitle(APP_NAME);

  const [sessions, results, attempts, mistakes, bookmarks] = await Promise.all([
    safeGetAll('sessions'),
    safeGetAll('results'),
    safeGetAll('attempts'),
    safeGetAll('mistakes'),
    safeGetAll('bookmarks'),
  ]);

  const unfinished = pickUnfinished(sessions);

  root.appendChild(
    el('div', { class: 'screen screen--home' }, [
      // 1. Top Quote of the Day
      quoteCard(),

      // 2. Question of the Day (QOD)
      qodCard(),

      // Resume Active Session (if any)
      unfinished ? heroTile(unfinished) : null,

      // 3. Primary Navigation Options to the 5 Core Areas
      el('div', { class: 'section-title', text: 'Navigation & Study Modes' }, []),
      el('div', { class: 'grid grid--marrow' }, [
        // 1) QBank (Arrow / Cereb / PYQs - Subject Wise)
        marrowCard('📚', '1) QBank', 'ARROW / CEREB / PYQs with 19 Subject-Wise breakdowns', '49,293 Qs', 'badge--blue', () => ui.navigate('practice')),
        // 2) Tests
        marrowCard('📝', '2) Tests', '165 Full-Length Grand Tests under NBE exam conditions', '165 Tests', 'badge--emerald', () => ui.navigate('tests')),
        // 3) Analytics
        marrowCard('📊', '3) Analytics', 'Subject accuracy breakdown, speed metrics & mistake review', 'Diagnostics', 'badge--purple', () => ui.navigate('stats')),
        // 4) Anki
        marrowCard('📇', '4) Anki Flashcards', 'High-Yield Medical Spaced Repetition Decks & Pearls', 'Spaced Recall', 'badge--amber', () => ui.navigate('anki')),
        // 5) Clinical Case Simulator
        marrowCard('🩺', '5) Case Simulator', 'Emergency room case management with vitals & ICU decisions', 'Live Sim', 'badge--cyan', () => ui.navigate('cases')),
        // Review Mistake Book
        marrowCard('⭐', '6) Mistake Book', 'Instant revision for all bookmarked and incorrect attempts', `${mistakes.length} Mistakes`, 'badge--rose', () => ui.navigate('review')),
      ]),

      // Stats Summary Bar
      statsStrip({ results, attempts, mistakes, bookmarks }),
    ].filter(Boolean))
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

function qodCard() {
  const qod = DAILY_QUESTIONS[activeQodIndex % DAILY_QUESTIONS.length];
  const card = el('div', { class: 'qod-card' });

  function renderQod() {
    clear(card);
    card.appendChild(
      el('div', { class: 'qod-card__header' }, [
        el('div', { class: 'qod-card__title-row' }, [
          el('span', { class: 'qod-card__badge', text: '⚡ QUESTION OF THE DAY' }),
          el('span', { class: 'chip chip--subject', text: qod.subject }),
          el('span', { class: 'chip chip--exam', text: qod.exam }),
        ]),
        el('button', {
          class: 'quote-card__btn',
          type: 'button',
          title: 'Next Question',
          onclick: (e) => {
            e.stopPropagation();
            activeQodIndex = (activeQodIndex + 1) % DAILY_QUESTIONS.length;
            qodAnswerState = { answered: false, chosen: null };
            renderQod();
          },
        }, [el('span', { text: '↻' })]),
      ])
    );

    card.appendChild(el('div', { class: 'qod-card__stem', text: qod.question }));

    const optionList = el('div', { class: 'qod-card__options' }, qod.options.map((opt, i) => {
      let stateClass = '';
      let badge = '';
      if (qodAnswerState.answered) {
        if (i === qod.correct) {
          stateClass = 'option--correct';
          badge = '✓ Correct';
        } else if (i === qodAnswerState.chosen) {
          stateClass = 'option--wrong';
          badge = '✕ Your Choice';
        }
      }
      return el('button', {
        class: `qod-option ${stateClass}`,
        type: 'button',
        disabled: qodAnswerState.answered,
        onclick: () => {
          qodAnswerState = { answered: true, chosen: i };
          renderQod();
        },
      }, [
        el('span', { class: 'qod-option__key', text: String.fromCharCode(65 + i) }),
        el('span', { class: 'qod-option__text', text: opt }),
        badge ? el('span', { class: 'qod-option__badge', text: badge }) : null,
      ]);
    }));
    card.appendChild(optionList);

    if (qodAnswerState.answered) {
      const isCorrect = qodAnswerState.chosen === qod.correct;
      card.appendChild(
        el('div', { class: `qod-feedback ${isCorrect ? 'qod-feedback--correct' : 'qod-feedback--wrong'}` }, [
          el('div', { class: 'qod-feedback__head', text: isCorrect ? '🎉 Correct Answer!' : `💡 Correct Answer: (${String.fromCharCode(65 + qod.correct)}) ${qod.options[qod.correct]}` }),
          el('div', { class: 'qod-feedback__pearl', text: `⭐ Key Pearl: ${qod.pearl}` }),
        ])
      );
    }
  }

  renderQod();
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

function marrowCard(icon, title, sub, badgeText, badgeClass, onClick) {
  return el('button', { class: 'marrow-card', type: 'button', onclick: onClick }, [
    el('div', { class: 'marrow-card__top' }, [
      el('span', { class: 'marrow-card__icon', text: icon }),
      el('span', { class: `marrow-card__badge ${badgeClass || ''}`, text: badgeText }),
    ]),
    el('div', { class: 'marrow-card__title', text: title }),
    el('div', { class: 'marrow-card__sub', text: sub }),
  ]);
}

function marrowSubCard(icon, title, sub, onClick) {
  return el('button', { class: 'marrow-card marrow-card--sub', type: 'button', onclick: onClick }, [
    el('div', { class: 'marrow-card__top' }, [
      el('span', { class: 'marrow-card__icon', text: icon }),
      el('span', { class: 'marrow-card__badge badge--cyan', text: 'Overview' }),
    ]),
    el('div', { class: 'marrow-card__title', text: title }),
    el('div', { class: 'marrow-card__sub', text: sub }),
  ]);
}

function navCard(icon, title, sub, onClickOrScreen) {
  const handler = typeof onClickOrScreen === 'function' ? onClickOrScreen : () => ui.navigate(onClickOrScreen);
  return el('button', { class: 'card', type: 'button', onclick: handler }, [
    el('span', { class: 'card__icon', text: icon }),
    el('div', { class: 'card__title', text: title }),
    el('div', { class: 'card__sub', text: sub }),
  ]);
}
