import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RATINGS,
  formatInterval,
  previewIntervals,
  nextStateFor,
  selectDueCards,
  formatDueEta,
  collectMistakeRecords,
  toMistakeCard,
  curatedToCard,
} from '../src/anki-deck.js';
import { createCardState, schedule } from '../src/srs.js';

const T0 = 1_700_000_000_000; // fixed instant
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

/* ---------------------------------------------------------------------------- formatInterval */

test('formatInterval renders sub-hour spans in minutes', () => {
  assert.equal(formatInterval(1 / 1440), '1m'); // 1 minute
  assert.equal(formatInterval(6 / 1440), '6m'); // 6 minutes
  assert.equal(formatInterval(10 / 1440), '10m'); // 10 minutes
});

test('formatInterval renders sub-day spans in hours', () => {
  assert.equal(formatInterval(2 / 24), '2h');
});

test('formatInterval renders day-plus spans in whole days', () => {
  assert.equal(formatInterval(1), '1d');
  assert.equal(formatInterval(4), '4d');
});

test('formatInterval treats non-positive/invalid input as "now" rather than crashing', () => {
  assert.equal(formatInterval(0), 'now');
  assert.equal(formatInterval(-3), 'now');
  assert.equal(formatInterval(NaN), 'now');
});

/* ------------------------------------------------------------------------------ previewIntervals */

test('previewIntervals reports one interval per rating, matching RATINGS order/keys', () => {
  const intervals = previewIntervals(undefined, T0);
  const keys = RATINGS.map((r) => r.key);
  assert.deepEqual(Object.keys(intervals).sort(), keys.slice().sort());
});

test('previewIntervals on a brand-new card: Easy schedules further out than Good', () => {
  const intervals = previewIntervals(undefined, T0);
  assert.ok(intervals.easy > intervals.good, 'Easy should push further than Good on a new card');
});

test('previewIntervals reflects the card\'s actual current state, not always a fresh card', () => {
  // A card with real review history schedules differently than a brand-new one.
  let card = createCardState(T0);
  card = schedule(card, 4, T0); // Easy
  card = schedule(card, 4, T0); // Easy again -> now on the multiplicative growth step
  const seasoned = previewIntervals(card, T0);
  const fresh = previewIntervals(undefined, T0);
  assert.notEqual(seasoned.good, fresh.good, 'a seasoned card must preview differently than a new one');
});

/* --------------------------------------------------------------------------------- nextStateFor */

test('nextStateFor maps rating keys onto the correct SM-2 quality values', () => {
  for (const rating of RATINGS) {
    const viaKey = nextStateFor(undefined, rating.key, T0);
    const viaQuality = schedule(undefined, rating.quality, T0);
    assert.deepEqual(viaKey, viaQuality);
  }
});

test('nextStateFor rejects an unknown rating key', () => {
  assert.throws(() => nextStateFor(undefined, 'meh', T0));
});

/* ----------------------------------------------------------------------------- selectDueCards */

function card(id, extra = {}) {
  return { id, subject: 'Test', tag: 'T', front: id, back: id, ...extra };
}

test('a card with no SRS record at all is due immediately', () => {
  const { dueCards } = selectDueCards([card('a')], new Map(), T0);
  assert.equal(dueCards.length, 1);
  assert.equal(dueCards[0].id, 'a');
});

test('a card whose stored due date is in the future is excluded', () => {
  const srsById = new Map([['a', { status: 'review', due: T0 + DAY_MS }]]);
  const { dueCards, nextDueAt } = selectDueCards([card('a')], srsById, T0);
  assert.equal(dueCards.length, 0);
  assert.equal(nextDueAt, T0 + DAY_MS);
});

test('a card whose stored due date has already passed is included', () => {
  const srsById = new Map([['a', { status: 'review', due: T0 - 1000 }]]);
  const { dueCards } = selectDueCards([card('a')], srsById, T0);
  assert.equal(dueCards.length, 1);
});

test('due cards are ordered soonest-due first', () => {
  const srsById = new Map([
    ['a', { status: 'review', due: T0 - 1000 }],
    ['b', { status: 'review', due: T0 - 5000 }], // earliest
    ['c', { status: 'review', due: T0 - 2000 }],
  ]);
  const { dueCards } = selectDueCards([card('a'), card('b'), card('c')], srsById, T0);
  assert.deepEqual(dueCards.map((c) => c.id), ['b', 'c', 'a']);
});

test('cards with equal due dates keep their original relative order (stable sort)', () => {
  const { dueCards } = selectDueCards([card('x'), card('y'), card('z')], new Map(), T0);
  assert.deepEqual(dueCards.map((c) => c.id), ['x', 'y', 'z']);
});

test('nextDueAt is the earliest due date among the excluded (not-yet-due) cards only', () => {
  const srsById = new Map([
    ['a', { status: 'review', due: T0 + 3 * DAY_MS }],
    ['b', { status: 'review', due: T0 + 1 * DAY_MS }], // soonest of the excluded
    ['c', { status: 'review', due: T0 - 1000 }], // due now, not excluded
  ]);
  const { dueCards, nextDueAt } = selectDueCards([card('a'), card('b'), card('c')], srsById, T0);
  assert.deepEqual(dueCards.map((x) => x.id), ['c']);
  assert.equal(nextDueAt, T0 + 1 * DAY_MS);
});

test('nextDueAt is null when every card is due (nothing excluded)', () => {
  const { nextDueAt } = selectDueCards([card('a'), card('b')], new Map(), T0);
  assert.equal(nextDueAt, null);
});

test('an empty deck is simply empty, not an error', () => {
  const { dueCards, nextDueAt } = selectDueCards([], new Map(), T0);
  assert.deepEqual(dueCards, []);
  assert.equal(nextDueAt, null);
});

/* -------------------------------------------------------------------------------- formatDueEta */

test('formatDueEta renders minutes/hours/days appropriately', () => {
  assert.equal(formatDueEta(T0 + 5 * MINUTE_MS, T0), 'in 5 minutes');
  assert.equal(formatDueEta(T0 + 1 * MINUTE_MS, T0), 'in 1 minute');
  assert.equal(formatDueEta(T0 + 3 * HOUR_MS, T0), 'in 3 hours');
  assert.equal(formatDueEta(T0 + 2 * DAY_MS, T0), 'in 2 days');
});

test('formatDueEta treats a due date that has already passed as "now"', () => {
  assert.equal(formatDueEta(T0 - 1000, T0), 'now');
  assert.equal(formatDueEta(T0, T0), 'now');
});

/* --------------------------------------------------------------------------- collectMistakeRecords */

test('collectMistakeRecords unions mistakes and bookmarks with no overlap', () => {
  const mistakes = [{ questionId: 'q1' }, { questionId: 'q2' }];
  const bookmarks = [{ questionId: 'q3' }];
  const out = collectMistakeRecords(mistakes, bookmarks);
  assert.deepEqual(
    out.map((r) => r.questionId).sort(),
    ['q1', 'q2', 'q3']
  );
});

test('collectMistakeRecords de-duplicates a question that is both a mistake and a bookmark', () => {
  const mistakes = [{ questionId: 'q1', chosen: 2, correct: 0 }];
  const bookmarks = [{ questionId: 'q1', at: 123 }, { questionId: 'q2' }];
  const out = collectMistakeRecords(mistakes, bookmarks);
  assert.equal(out.length, 2);
  const q1 = out.find((r) => r.questionId === 'q1');
  // The mistake record wins the dedupe — it carries chosen/correct, the bookmark does not.
  assert.equal(q1.chosen, 2);
});

test('collectMistakeRecords tolerates empty/missing inputs', () => {
  assert.deepEqual(collectMistakeRecords([], []), []);
  assert.deepEqual(collectMistakeRecords(undefined, undefined), []);
  assert.deepEqual(collectMistakeRecords(null, [{ questionId: 'q1' }]), [{ questionId: 'q1' }]);
});

test('collectMistakeRecords ignores malformed records without a questionId', () => {
  const out = collectMistakeRecords([{ questionId: null }, {}], [{ questionId: 'q1' }]);
  assert.deepEqual(out, [{ questionId: 'q1' }]);
});

/* -------------------------------------------------------------------------------- toMistakeCard */

test('toMistakeCard pulls the correct option and marks explanations honestly', () => {
  const record = { questionId: 'q1', subject: 'Pathology', source: 'CEREB', title: 'Bank A' };
  const question = {
    id: 'q1',
    question: '<p>What is X?</p>',
    options: ['a', 'b', 'c', 'd'],
    correct: 2,
    subject: 'Pathology',
    hasExplanation: true,
    short: 'Ans: C',
    detail: '<p>Because...</p>',
  };
  const c = toMistakeCard(record, question);
  assert.equal(c.id, 'q1');
  assert.equal(c.kind, 'mistake');
  assert.equal(c.correctIndex, 2);
  assert.equal(c.optionText, 'c');
  assert.equal(c.hasExplanation, true);
  assert.equal(c.subject, 'Pathology');
});

test('toMistakeCard falls back to the question\'s own subject when the record has none', () => {
  const record = { questionId: 'q1', subject: null };
  const question = { id: 'q1', question: 'Q', options: ['a', 'b'], correct: 0, subject: 'Surgery' };
  const c = toMistakeCard(record, question);
  assert.equal(c.subject, 'Surgery');
});

test('toMistakeCard reflects hasExplanation:false honestly rather than inventing a back', () => {
  const record = { questionId: 'q1' };
  const question = { id: 'q1', question: 'Q', options: ['a', 'b'], correct: 1, hasExplanation: false, short: 'Ans: B' };
  const c = toMistakeCard(record, question);
  assert.equal(c.hasExplanation, false);
  assert.equal(c.short, 'Ans: B');
});

/* ---------------------------------------------------------------------------------- curatedToCard */

test('curatedToCard preserves the curated card\'s content untouched', () => {
  const raw = { id: 'anki_01', subject: 'Medicine', front: 'Front text', back: 'Back text', tag: 'Neurology' };
  const c = curatedToCard(raw);
  assert.equal(c.kind, 'curated');
  assert.equal(c.front, 'Front text');
  assert.equal(c.back, 'Back text');
  assert.equal(c.tag, 'Neurology');
});
