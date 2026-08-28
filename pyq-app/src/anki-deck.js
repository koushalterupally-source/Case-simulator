/**
 * Anki deck logic — pure, no DOM, no storage. See srs.js for the underlying scheduler and
 * src/screens/anki.js for the screen that wires this to store.js/data.js and paints it.
 *
 * Two decks share this module:
 *  - the curated 40-card high-yield deck (src/screens/anki.js's ANKI_DECKS)
 *  - "From your mistakes" — built at runtime from the `mistakes` + `bookmarks` stores, resolved
 *    to full questions the same way review.js does.
 *
 * Both decks are, in the end, just an array of `{ id, ... }` cards that gets filtered down to
 * what's actually due right now and ordered soonest-due-first. That filtering/ordering, the
 * button-interval preview, and the mistake-deck's record de-duplication are the pure logic kept
 * here so it's testable without a DOM (see tests/anki.test.mjs).
 */

import { schedule, isDue } from './srs.js';

/** The four rating buttons, in display order, with their SM-2 quality value (see srs.js). */
export const RATINGS = [
  { key: 'again', quality: 1, label: 'Again', cls: 'anki-btn--again' },
  { key: 'hard', quality: 2, label: 'Hard', cls: 'anki-btn--hard' },
  { key: 'good', quality: 3, label: 'Good', cls: 'anki-btn--good' },
  { key: 'easy', quality: 4, label: 'Easy', cls: 'anki-btn--easy' },
];

/** Turn a `schedule()` result's `intervalDays` into a short human label ("6m", "3h", "4d"). */
export function formatInterval(days) {
  if (!Number.isFinite(days) || days <= 0) return 'now';
  const totalMinutes = days * 1440;
  if (totalMinutes < 60) return `${Math.max(1, Math.round(totalMinutes))}m`;
  const totalHours = totalMinutes / 60;
  if (totalHours < 24) return `${Math.max(1, Math.round(totalHours))}h`;
  return `${Math.round(days)}d`;
}

/** What each of the four ratings would actually do to this card, right now — for the button labels. */
export function previewIntervals(srsState, now = Date.now()) {
  const out = {};
  for (const r of RATINGS) out[r.key] = schedule(srsState, r.quality, now).intervalDays;
  return out;
}

/** Apply one rating to a card's current SRS state (or `undefined` for a never-studied card). */
export function nextStateFor(srsState, ratingKey, now = Date.now()) {
  const rating = RATINGS.find((r) => r.key === ratingKey);
  if (!rating) throw new Error(`unknown rating "${ratingKey}"`);
  return schedule(srsState, rating.quality, now);
}

/**
 * Filter `cards` (each `{ id, ... }`) down to the ones due right now, ordered soonest-due-first,
 * using `srsByQuestionId` (a Map, or map-like with `.get`, of questionId -> stored SRS state — a
 * card with no entry has never been studied and is always due). Also returns `nextDueAt`, the
 * earliest due timestamp among the cards that got excluded, so an empty deck can say when the
 * next card actually comes up rather than just "nothing here".
 */
export function selectDueCards(cards, srsByQuestionId, now = Date.now()) {
  const lookup = srsByQuestionId && typeof srsByQuestionId.get === 'function' ? srsByQuestionId : new Map();
  const withMeta = (cards || []).map((card) => {
    const srsState = lookup.get(card.id);
    const due = srsState && typeof srsState.due === 'number' ? srsState.due : now;
    return { card, srsState, due, dueNow: isDue(srsState, now) };
  });

  const dueCards = withMeta
    .filter((x) => x.dueNow)
    .sort((a, b) => a.due - b.due)
    .map((x) => ({ ...x.card, due: x.due, srsState: x.srsState }));

  let nextDueAt = null;
  for (const x of withMeta) {
    if (x.dueNow) continue;
    if (nextDueAt === null || x.due < nextDueAt) nextDueAt = x.due;
  }

  return { dueCards, nextDueAt };
}

/** "in 6 minutes" / "in 3 hours" / "in 2 days" — for the empty-deck message. */
export function formatDueEta(dueAt, now = Date.now()) {
  const diff = dueAt - now;
  if (diff <= 0) return 'now';
  const minutes = Math.round(diff / 60000);
  if (minutes < 60) return `in ${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.round(diff / 3600000);
  if (hours < 24) return `in ${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.round(diff / 86400000);
  return `in ${days} day${days === 1 ? '' : 's'}`;
}

/**
 * Union of `mistakes` and `bookmarks` store records, de-duplicated by `questionId` (a question
 * that is both a logged mistake and a bookmark counts once). Mistake records win the dedupe when
 * both exist, since they carry the richer (chosen/correct) data — not that it matters for the
 * deck, which only needs `questionId`/`subject`/`source`/`title` either way.
 */
export function collectMistakeRecords(mistakeRecords, bookmarkRecords) {
  const byId = new Map();
  for (const r of mistakeRecords || []) {
    if (r && r.questionId != null && !byId.has(r.questionId)) byId.set(r.questionId, r);
  }
  for (const r of bookmarkRecords || []) {
    if (r && r.questionId != null && !byId.has(r.questionId)) byId.set(r.questionId, r);
  }
  return [...byId.values()];
}

/** A resolved mistake/bookmark record + its full question -> one "from your mistakes" flashcard. */
export function toMistakeCard(record, question) {
  const correctIndex = typeof question.correct === 'number' ? question.correct : 0;
  const options = Array.isArray(question.options) ? question.options : [];
  return {
    id: question.id,
    kind: 'mistake',
    subject: record.subject || question.subject || 'Unclassified',
    tag: record.title || record.source || 'From your mistakes',
    front: question.question,
    correctIndex,
    optionText: options[correctIndex] != null ? options[correctIndex] : '',
    hasExplanation: !!question.hasExplanation,
    short: question.short,
    detail: question.detail,
  };
}

/** One of the curated ANKI_DECKS entries -> the same card shape the mistake deck produces. */
export function curatedToCard(raw) {
  return { id: raw.id, kind: 'curated', subject: raw.subject, tag: raw.tag, front: raw.front, back: raw.back };
}
