/**
 * Practice screen — one question per screen, answer revealed the instant it's locked in.
 *
 * Unlike a Grand Test, `data.loadPracticeSet` fetches questions AND answers together up front —
 * there is no answer key to withhold in practice mode, and no timer. `practice.js` owns all the
 * session-state logic; this file only renders it and writes it back to IndexedDB after every
 * interaction, so a force-kill mid-set resumes at the exact question with every answer intact.
 *
 * Routing: app.js's router calls `start(root, {slug, groupName})` for its 'group' screen and
 * `resume(root, session)` for its 'practice-resume' screen (having already loaded the session
 * from the `sessions` store). Finishing a set navigates back to the router's 'subject' screen.
 */

import * as practice from '../practice.js';
import * as data from '../data.js';
import * as store from '../store.js';
import * as ui from '../ui.js';
import { el, html, clear, optionKey, pct } from '../dom.js';

let state = null;

/** A group's shard ids. Groups currently carry a single `shard` string; a group that outgrows
 * the 1 MB shard limit is documented to split into an ordered `shards` array instead, so both
 * shapes are handled rather than assuming the single-shard case forever. */
function groupShards(group) {
  if (Array.isArray(group.shards)) return group.shards.slice();
  if (group.shard) return [group.shard];
  return [];
}

export async function start(root, { slug, groupName }) {
  let catalog;
  try {
    catalog = await data.loadCatalog();
  } catch (err) {
    console.error('practice-screen: could not load catalog', err);
    renderLoadError(root, 'Could not load the question bank catalog.');
    return;
  }

  const found = data.findPracticeGroup(catalog, slug, groupName);
  if (!found) {
    renderLoadError(root, 'That practice set could not be found — it may have moved.');
    return;
  }
  const { subject, group } = found;
  const shards = groupShards(group);
  if (shards.length === 0) {
    renderLoadError(root, 'This set has no questions to load.');
    return;
  }

  ui.setBusy(true);
  let questions;
  try {
    questions = await data.loadPracticeSet(shards);
  } catch (err) {
    console.error('practice-screen: failed to load practice set', err);
    ui.setBusy(false);
    renderLoadError(root, 'Could not load these questions. Check your connection and try again.');
    return;
  }
  ui.setBusy(false);

  // `title` is deliberately just the group name (not "Subject — Group") so that a mistake or
  // bookmark row written from this session can be resolved straight back to this catalog group
  // by (source, title) later, in review.js — the mistake bank records source+title, not a slug.
  const session = practice.createSession({
    source: subject.source,
    title: group.name,
    slug,
    groupName: group.name,
    shards,
    questionCount: questions.length,
  });
  session.subjectName = subject.subject || null;

  await persist(session);
  await run(root, session, questions);
}

export async function resume(root, session) {
  ui.setBusy(true);
  let questions;
  try {
    questions = await data.loadPracticeSet(session.shards);
  } catch (err) {
    console.error('practice-screen: failed to resume practice set', err);
    ui.setBusy(false);
    renderLoadError(root, 'Could not resume this set — the data may be unavailable right now.');
    return;
  }
  ui.setBusy(false);
  await run(root, session, questions);
}

export function stop() {
  const bar = document.getElementById('pr-actions');
  if (bar) bar.remove();
  state = null;
}

function renderLoadError(root, message) {
  clear(root).appendChild(
    el('div', { class: 'empty' }, [el('span', { class: 'empty__icon', text: '⚠️' }), el('p', { text: message })])
  );
}

async function persist(session) {
  session.updatedAt = Date.now();
  try {
    await store.put('sessions', session);
  } catch (err) {
    // Storage can be unavailable (private browsing, quota). The set continues in memory.
    console.warn('practice-screen: could not persist session', err);
  }
}

async function run(root, session, questions) {
  state = { root, session, questions, bookmarkIds: new Set() };
  try {
    const marks = await store.getAll('bookmarks');
    state.bookmarkIds = new Set(marks.map((m) => m.questionId));
  } catch (err) {
    // Bookmarks are a nice-to-have; render without them rather than fail the whole session.
    console.warn('practice-screen: could not read bookmarks', err);
  }
  render();
}

/* ---------------------------------------------------------------------------- interactions */

function onAnswer(n, i) {
  if (!state || state.session.status !== 'running') return;
  const { session, questions } = state;
  if (practice.isAnswered(session, n)) return;

  practice.answer(session, n, i);
  persist(session);

  const wrongRows = practice.mistakes(session, questions);
  if (wrongRows.length > 0) {
    store.bulkPut('mistakes', wrongRows).catch((err) => console.warn('practice-screen: could not save mistakes', err));
  }

  const q = questions[n];
  store
    .put('attempts', {
      id: `${session.id}_${n}`,
      paperId: null,
      questionId: q.id,
      subject: q.subject || null,
      isCorrect: i === q.correct,
      at: Date.now(),
    })
    .catch((err) => console.warn('practice-screen: could not save attempt', err));

  render();
}

function toggleBookmark(q) {
  if (!state) return;
  const { session } = state;
  const has = state.bookmarkIds.has(q.id);
  if (has) {
    state.bookmarkIds.delete(q.id);
    store.del('bookmarks', q.id).catch((err) => console.warn('practice-screen: could not remove bookmark', err));
  } else {
    state.bookmarkIds.add(q.id);
    store
      .put('bookmarks', {
        questionId: q.id,
        subject: q.subject || null,
        source: session.source,
        title: session.title,
        at: Date.now(),
      })
      .catch((err) => console.warn('practice-screen: could not save bookmark', err));
  }
  render();
}

function goPrev() {
  if (!state) return;
  practice.prev(state.session);
  persist(state.session);
  render();
}

function goNext() {
  if (!state) return;
  practice.next(state.session);
  persist(state.session);
  render();
}

function finishSet() {
  if (!state) return;
  practice.finish(state.session);
  persist(state.session);
  render();
}

/* ------------------------------------------------------------------------------ rendering */

function render() {
  if (!state) return;
  const { root, session, questions } = state;
  clear(root);

  if (session.status === 'finished') {
    root.appendChild(summaryScreen(session, questions));
    removeActions();
    paintAppbar();
    return;
  }

  const n = session.current;
  const q = questions[n];
  const answered = practice.isAnswered(session, n);
  const chosen = answered ? session.answers[n] : null;
  const bookmarked = state.bookmarkIds.has(q.id);

  const stem = el('div', { class: 'qtext' });
  html(stem, q.question);

  const options = el(
    'div',
    { class: 'options', role: 'radiogroup', 'aria-label': 'Answer options' },
    q.options.map((text, i) => {
      let stateName = '';
      if (answered) {
        if (i === q.correct) stateName = 'correct';
        else if (i === chosen) stateName = 'wrong';
      }
      return el(
        'button',
        {
          class: 'option',
          type: 'button',
          role: 'radio',
          'aria-checked': String(chosen === i),
          disabled: answered,
          dataset: { state: stateName },
          onclick: answered ? null : () => onAnswer(n, i),
        },
        [el('span', { class: 'option__key', text: optionKey(i) }), el('span', { text })]
      );
    })
  );

  root.appendChild(
    el('div', { class: 'screen' }, [
      el('div', { class: 'progress' }, [
        el('div', { class: 'progress__fill', style: { width: `${((n + 1) / session.count) * 100}%` } }),
      ]),
      el('div', { class: 'qcard' }, [
        el('div', { class: 'qmeta' }, [
          el('strong', { text: `Q ${n + 1}` }),
          el('span', { text: `of ${session.count}` }),
          q.subject ? el('span', { class: 'chip', text: q.subject }) : null,
          el('button', {
            class: 'iconbtn',
            type: 'button',
            'aria-label': bookmarked ? 'Remove bookmark' : 'Bookmark this question',
            text: bookmarked ? '★' : '☆',
            style: { marginLeft: 'auto', color: bookmarked ? 'var(--amber)' : 'var(--subtext)' },
            onclick: () => toggleBookmark(q),
          }),
        ]),
        stem,
        options,
        answered ? explainBlock(q) : null,
      ]),
    ])
  );

  renderActions();
  paintAppbar();
}

function explainBlock(q) {
  if (q.hasExplanation) {
    const body = el('div', { class: 'explain__body' });
    html(body, q.detail);
    return el('div', { class: 'explain' }, [el('div', { class: 'explain__head', text: 'Explanation' }), body]);
  }
  // 27% of the corpus has no real explanation. Say so rather than showing an empty panel.
  return el('div', { class: 'explain explain--stub' }, [
    el('div', { class: 'explain__head', text: 'No explanation in the source' }),
    el('div', { text: q.short || `The answer is ${optionKey(q.correct)}.` }),
  ]);
}

function renderActions() {
  const { session } = state;
  const n = session.current;
  const isLast = n === session.count - 1;

  removeActions();
  const bar = el('div', { class: 'actions', id: 'pr-actions' }, [
    el('button', { class: 'btn btn--ghost', type: 'button', text: 'Previous', disabled: n === 0, onclick: goPrev }),
    el('button', {
      class: 'btn btn--primary',
      type: 'button',
      text: isLast ? 'Finish' : 'Next',
      onclick: isLast ? finishSet : goNext,
    }),
  ]);
  document.body.appendChild(bar);
}

function removeActions() {
  const bar = document.getElementById('pr-actions');
  if (bar) bar.remove();
}

function paintAppbar() {
  const title = document.getElementById('appbar-title');
  if (title) title.textContent = state.session.groupName || state.session.title || 'Practice';
}

function summaryScreen(session, questions) {
  const s = practice.score(session, questions);
  return el('div', { class: 'screen' }, [
    el('div', { class: 'qcard', style: { textAlign: 'center' } }, [
      el('span', { class: 'card__icon', text: s.accuracy >= 0.7 ? '🎉' : '📘' }),
      el('div', { class: 'card__title', text: 'Set complete' }),
      el('div', {
        class: 'card__sub',
        style: { marginBottom: '18px' },
        text: session.subjectName ? `${session.subjectName} · ${session.groupName}` : session.groupName || '',
      }),
      el('div', { class: 'stats' }, [
        stat(s.correct, 'Correct', 'good'),
        stat(s.wrong, 'Wrong', 'bad'),
        stat(pct(s.accuracy), 'Accuracy'),
      ]),
      el('button', {
        class: 'btn btn--primary',
        type: 'button',
        text: 'Back to list',
        style: { marginTop: '20px' },
        onclick: () => {
          stop();
          ui.navigate('subject', { slug: session.slug });
        },
      }),
    ]),
  ]);
}

function stat(value, label, tone) {
  return el('div', { class: `stat${tone ? ` stat--${tone}` : ''}` }, [
    el('div', { class: 'stat__value', text: String(value) }),
    el('div', { class: 'stat__label', text: label }),
  ]);
}
