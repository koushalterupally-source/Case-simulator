/**
 * Grand Test screen — the sitting itself.
 *
 * All exam state lives in the plain object from gt.js; this file only renders it and writes it back to
 * IndexedDB after every interaction. The answer key is not in memory: `loadAnswers` is called exactly
 * once, inside `finish()`, after the session is closed.
 */

import * as GT from '../gt.js';
import * as data from '../data.js';
import * as store from '../store.js';
import * as ui from '../ui.js';
import { el, html, clear, optionKey, duration } from '../dom.js';

const TICK_MS = 250;
const WARN_SOON_MS = 10 * 60 * 1000;
const WARN_URGENT_MS = 60 * 1000;

let state = null;

export async function start(root, { paper, scheme, durationMs }) {
  const questions = await data.loadQuestions(paper.shards);
  const session = GT.createSession({
    paper,
    questionCount: questions.length,
    scheme,
    durationMs,
  });
  data.lockAnswers(paper.id);
  await persist(session);
  return run(root, session, questions);
}

export async function resume(root, session) {
  const questions = await data.loadQuestions(session.shards);
  data.lockAnswers(session.paperId);

  const away = Date.now() - (session.updatedAt || session.startedAt);
  if (away > 60_000) {
    ui.toast(`${duration(away)} elapsed while you were away — the exam clock kept running`);
  }
  return run(root, session, questions);
}

function run(root, session, questions) {
  stop();
  state = { root, session, questions, paletteOpen: false, ticker: null, finishing: false };

  render();
  state.ticker = setInterval(tick, TICK_MS);

  // A tab restored from the bfcache can have missed its deadline entirely.
  document.addEventListener('visibilitychange', onVisibility);
  return state;
}

export function stop() {
  if (state && state.ticker) clearInterval(state.ticker);
  document.removeEventListener('visibilitychange', onVisibility);
  state = null;
}

function onVisibility() {
  if (!document.hidden) tick();
}

function tick() {
  if (!state || state.finishing) return;
  const { session } = state;

  if (GT.isExpired(session)) {
    ui.toast("Time's up — submitting your paper");
    finish(true);
    return;
  }
  paintClock();
}

function paintClock() {
  if (!state) return;
  const node = document.getElementById('gt-clock');
  if (!node) return;
  const left = GT.remainingMs(state.session);
  node.textContent = GT.formatClock(left);
  node.dataset.warn = left <= WARN_URGENT_MS ? 'urgent' : left <= WARN_SOON_MS ? 'soon' : 'ok';

  // Announce the two warnings once each.
  const marks = state.warned || (state.warned = {});
  if (left <= WARN_SOON_MS && !marks.soon) {
    marks.soon = true;
    ui.toast('10 minutes remaining');
  }
  if (left <= WARN_URGENT_MS && !marks.urgent) {
    marks.urgent = true;
    ui.toast('1 minute remaining');
  }
}

async function persist(session) {
  session.updatedAt = Date.now();
  try {
    await store.put('sessions', session);
  } catch (err) {
    // Storage can be unavailable (private browsing, quota). The sitting continues in memory.
    console.warn('Could not persist session', err);
  }
}

function mutate(fn) {
  if (!state || state.finishing) return;
  fn(state.session);
  persist(state.session);
  render();
}

/* ---------------------------------------------------------------- rendering */

function render() {
  if (!state) return;
  const { root, session, questions } = state;
  const n = session.current;
  const q = questions[n];
  const chosen = Object.prototype.hasOwnProperty.call(session.answers, n) ? session.answers[n] : null;
  const c = GT.counts(session);

  clear(root);

  const stem = el('div', { class: 'qtext' });
  html(stem, q.question);

  root.appendChild(
    el('div', { class: 'screen' }, [
      el('div', { class: 'progress' }, [
        el('div', {
          class: 'progress__fill',
          style: { width: `${((n + 1) / session.count) * 100}%` },
        }),
      ]),

      el('div', { class: 'qcard' }, [
        el('div', { class: 'qmeta' }, [
          el('strong', { text: `Q ${n + 1}` }),
          el('span', { text: `of ${session.count}` }),
          q.subject ? el('span', { class: 'chip', text: q.subject }) : null,
          session.marked[n] ? el('span', { class: 'chip', text: 'Marked' }) : null,
          q.needsImage && !navigator.onLine
            ? el('span', { class: 'chip chip--quiz', text: 'Needs image' })
            : null,
        ]),
        stem,
        el(
          'div',
          { class: 'options', role: 'radiogroup', 'aria-label': 'Answer options' },
          q.options.map((text, i) =>
            el(
              'button',
              {
                class: 'option',
                type: 'button',
                role: 'radio',
                'aria-checked': String(chosen === i),
                dataset: { state: chosen === i ? 'chosen' : '' },
                onclick: () => mutate((s) => GT.answer(s, n, i)),
              },
              [el('span', { class: 'option__key', text: optionKey(i) }), el('span', { text })]
            )
          )
        ),
      ]),

      el('div', { class: 'legend' }, [
        el('span', { text: `${c.answered} answered` }),
        el('span', { text: `${c.unanswered} left` }),
        el('span', { text: `${c.marked} marked` }),
      ]),
    ])
  );

  renderActions();
  paintClock();
  paintAppbar();
}

function paintAppbar() {
  const title = document.getElementById('appbar-title');
  if (title) title.textContent = state.session.paperName;

  let clock = document.getElementById('gt-clock');
  if (!clock) {
    clock = el('div', { class: 'clock', id: 'gt-clock', role: 'timer', 'aria-live': 'off' });
    const themeBtn = document.getElementById('theme-btn');
    themeBtn.parentNode.insertBefore(clock, themeBtn);
  }
}

function renderActions() {
  const { session } = state;
  const n = session.current;
  const answered = Object.prototype.hasOwnProperty.call(session.answers, n);

  let bar = document.getElementById('gt-actions');
  if (bar) bar.remove();

  bar = el('div', { class: 'actions', id: 'gt-actions' }, [
    el('button', {
      class: 'btn btn--ghost btn--tight',
      type: 'button',
      text: '☰',
      'aria-label': 'Question palette',
      onclick: openPalette,
    }),
    el('button', {
      class: 'btn btn--ghost',
      type: 'button',
      text: answered ? 'Clear' : 'Skip',
      onclick: () =>
        mutate((s) => (answered ? GT.clearResponse(s, n) : GT.next(s))),
    }),
    el('button', {
      class: 'btn btn--ghost',
      type: 'button',
      text: session.marked[n] ? 'Unmark' : 'Mark',
      onclick: () => mutate((s) => GT.toggleMark(s, n)),
    }),
    el('button', {
      class: 'btn btn--primary',
      type: 'button',
      text: n === session.count - 1 ? 'Review' : 'Next',
      onclick: () => (n === session.count - 1 ? openPalette() : mutate((s) => GT.next(s))),
    }),
  ]);
  document.body.appendChild(bar);
}

/* ------------------------------------------------------------------ palette */

function openPalette() {
  const { session } = state;
  const c = GT.counts(session);

  const cells = [];
  for (let i = 0; i < session.count; i++) {
    cells.push(
      el('button', {
        class: 'pcell',
        type: 'button',
        text: String(i + 1),
        'aria-label': `Question ${i + 1}, ${GT.paletteState(session, i).replace('-', ' and ')}`,
        'aria-current': String(i === session.current),
        dataset: { state: GT.paletteState(session, i) },
        onclick: () => {
          closeSheet();
          mutate((s) => GT.goTo(s, i));
        },
      })
    );
  }

  const sheet = el('div', { class: 'sheet' }, [
    el('div', { class: 'sheet__title', text: 'Question palette' }),
    el('div', {
      class: 'sheet__sub',
      text: `${c.answered} answered · ${c.unanswered} unanswered · ${c.marked} marked for review`,
    }),
    el('div', { class: 'legend' }, [
      legendItem('var(--green)', 'Answered'),
      legendItem('var(--red)', 'Seen, blank'),
      legendItem('var(--violet)', 'Marked'),
      legendItem('var(--glass-solid)', 'Not visited'),
    ]),
    el('div', { class: 'palette-grid' }, cells),
    el('div', { style: { marginTop: '18px', display: 'flex', gap: '10px' } }, [
      el('button', { class: 'btn btn--ghost', type: 'button', text: 'Keep going', onclick: closeSheet }),
      el('button', { class: 'btn btn--danger', type: 'button', text: 'Submit paper', onclick: confirmSubmit }),
    ]),
  ]);

  showSheet(sheet);
}

function legendItem(color, label) {
  return el('span', {}, [
    el('i', { style: { background: color, border: '1px solid var(--hairline)' } }),
    el('span', { text: label }),
  ]);
}

let sheetNode = null;

function showSheet(inner) {
  closeSheet();
  sheetNode = el(
    'div',
    {
      class: 'sheet-backdrop',
      onclick: (e) => {
        if (e.target === sheetNode) closeSheet();
      },
    },
    [inner]
  );
  document.body.appendChild(sheetNode);
  const first = inner.querySelector('button');
  if (first) first.focus();
  document.addEventListener('keydown', onSheetKey);
}

function onSheetKey(e) {
  if (e.key === 'Escape') closeSheet();
}

function closeSheet() {
  if (sheetNode) sheetNode.remove();
  sheetNode = null;
  document.removeEventListener('keydown', onSheetKey);
}

/* ------------------------------------------------------------------- submit */

async function confirmSubmit() {
  const c = GT.counts(state.session);
  closeSheet();

  const body =
    c.unanswered > 0
      ? `${c.answered} answered, ${c.unanswered} still blank, ${c.marked} marked for review. Unanswered questions score zero.`
      : `All ${c.answered} questions answered, ${c.marked} marked for review.`;

  const ok = await ui.confirmDialog({
    title: 'Submit this paper?',
    body,
    confirmLabel: 'Submit',
    cancelLabel: 'Keep going',
  });
  if (ok) finish(false);
}

async function finish(auto) {
  if (!state || state.finishing) return;
  state.finishing = true;
  closeSheet();
  if (state.ticker) clearInterval(state.ticker);

  const { session, questions } = state;
  ui.setBusy(true);

  try {
    // The answer key enters the app here and nowhere earlier.
    data.unlockAnswers(session.paperId);
    const answers = await data.loadAnswers(session.shards);
    const result = GT.submit(session, questions, answers);

    await persist(session);
    try {
      await store.put('results', result);
      await store.bulkPut(
        'mistakes',
        result.questions
          .filter((r) => !r.isCorrect)
          .map((r) => ({
            questionId: r.id,
            subject: r.subject || null,
            source: session.source,
            title: session.paperName,
            chosen: r.chosen,
            correct: r.correctIndex,
            at: Date.now(),
          }))
      );
    } catch (err) {
      console.warn('Could not save result', err);
      ui.toast('Result shown but not saved — storage is unavailable');
    }

    const bar = document.getElementById('gt-actions');
    if (bar) bar.remove();
    const clock = document.getElementById('gt-clock');
    if (clock) clock.remove();

    stop();
    ui.navigate('analysis', { sessionId: result.sessionId, auto: auto ? '1' : '' });
  } catch (err) {
    state.finishing = false;
    console.error('Submit failed', err);
    ui.toast('Could not score the paper — your answers are saved');
    throw err;
  } finally {
    ui.setBusy(false);
  }
}

/** Called by the router when the user tries to leave a running sitting. */
export async function confirmLeave() {
  if (!state || state.finishing) return true;
  const ok = await ui.confirmDialog({
    title: 'Leave the exam?',
    body: 'Your answers are saved and you can resume from Tests — but the exam clock keeps running while you are away, exactly as it would in the hall.',
    confirmLabel: 'Leave',
    cancelLabel: 'Stay',
  });
  if (ok) {
    await persist(state.session);
    const bar = document.getElementById('gt-actions');
    if (bar) bar.remove();
    const clock = document.getElementById('gt-clock');
    if (clock) clock.remove();
    stop();
  }
  return ok;
}
