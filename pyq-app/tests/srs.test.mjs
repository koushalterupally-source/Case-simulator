import test from 'node:test';
import assert from 'node:assert/strict';

import { createCardState, schedule, isDue, dateKey, bumpStreak, INITIAL_EASE, MIN_EASE } from '../src/srs.js';

const T0 = 1_700_000_000_000; // fixed instant, so intervals can be checked against `due` exactly
const DAY_MS = 24 * 60 * 60 * 1000;

test('a new card is due immediately and starts at the reference ease of 2.5', () => {
  const card = createCardState(T0);
  assert.equal(card.status, 'new');
  assert.equal(card.easeFactor, INITIAL_EASE);
  assert.equal(isDue(card, T0), true);
});

test('a new card schedules sensibly: Good and Easy both push it into the future, Easy further', () => {
  const fresh = createCardState(T0);
  const good = schedule(fresh, 3, T0);
  const easy = schedule(fresh, 4, T0);

  assert.equal(good.status, 'review');
  assert.equal(easy.status, 'review');
  assert.ok(good.due > T0, 'Good must push the due date into the future');
  assert.ok(easy.due > T0, 'Easy must push the due date into the future');
  assert.ok(easy.due > good.due, 'Easy on a new card schedules further out than Good (4 days vs 10 minutes)');
  assert.equal(easy.intervalDays, 4);
});

test('a correct answer lengthens the interval on repeated review', () => {
  // Simulate a card that has already passed its first two fixed reviews, so the third+ review
  // uses the reference's growth formula: interval = round(interval * ease).
  let card = createCardState(T0);
  card = schedule(card, 3, T0); // rep 0 -> 1 (fixed 10-minute step)
  card = schedule(card, 3, T0); // rep 1 -> 2 (fixed 1-day step)
  const before = card.intervalDays;
  card = schedule(card, 3, T0); // rep 2 -> 3: now the multiplicative step applies
  assert.ok(card.intervalDays > before, `interval should grow (was ${before}, now ${card.intervalDays})`);
});

test('a lapse (Again or Hard) resets repetitions and shrinks the interval back down', () => {
  let card = createCardState(T0);
  card = schedule(card, 4, T0); // Easy: reps -> 1, interval -> 4 days
  card = schedule(card, 4, T0); // Easy again: reps -> 2, interval -> 4 days
  card = schedule(card, 3, T0); // Good: reps -> 3, interval grows past 4 days
  assert.ok(card.repetitions >= 3);
  assert.ok(card.intervalDays > 1);

  const again = schedule(card, 1, T0);
  assert.equal(again.repetitions, 0, 'Again must reset repetitions to zero');
  assert.equal(again.status, 'learning');
  assert.ok(again.intervalDays < card.intervalDays, 'the relearning step must be far shorter than the lapsed interval');
  assert.ok(again.due < card.due, 'the lapsed card must come due far sooner than its pre-lapse schedule');

  const hard = schedule(card, 2, T0);
  assert.equal(hard.repetitions, 0, 'Hard is also a lapse in the reference algorithm, not a soft pass');
  assert.equal(hard.status, 'learning');
});

test('ease never drops below the 1.3 floor, however many times it is pushed down', () => {
  // The reference only adjusts ease in the "passed" branch, and Good's formula (sm2q=3) actually
  // *lowers* ease each time (-0.14). Repeated Good presses are what drive it toward the floor.
  let card = createCardState(T0);
  for (let i = 0; i < 200; i++) {
    card = schedule(card, 3, T0 + i);
    assert.ok(card.easeFactor >= MIN_EASE, `ease fell below the floor: ${card.easeFactor}`);
  }
  assert.equal(card.easeFactor, MIN_EASE, 'enough repeated Good presses must bottom out exactly at the floor');
});

test('a lapse (Again/Hard) does not touch ease at all, per the reference', () => {
  let card = createCardState(T0);
  card = schedule(card, 4, T0);
  const easeBeforeLapse = card.easeFactor;
  card = schedule(card, 1, T0);
  assert.equal(card.easeFactor, easeBeforeLapse);
});

test('repeated Easy grows the interval monotonically', () => {
  // The reference's first two reviews are fixed steps (both land on the same 4-day interval for
  // Easy — reps 0 and 1 share the `quality === 4 ? 4 : ...` branch); from the third review on,
  // growth is multiplicative by the ease factor, so it is from there that it must strictly climb.
  let card = createCardState(T0);
  let previous = -Infinity;
  for (let i = 0; i < 8; i++) {
    card = schedule(card, 4, T0 + i);
    assert.ok(card.intervalDays >= previous, `interval must never shrink (step ${i}: ${previous} -> ${card.intervalDays})`);
    if (card.repetitions >= 3) {
      assert.ok(card.intervalDays > previous, `interval must strictly grow once past the fixed early steps (step ${i}: ${previous} -> ${card.intervalDays})`);
    }
    previous = card.intervalDays;
  }
});

test('due is computed from `now`, in whole-day increments once past the fixed early steps', () => {
  let card = createCardState(T0);
  card = schedule(card, 3, T0);
  card = schedule(card, 3, T0);
  card = schedule(card, 3, T0);
  assert.equal(card.due, T0 + card.intervalDays * DAY_MS);
});

/* ---------------------------------------------------------------------------- streak */

test('a fresh streak starts at 1 on first use', () => {
  const streak = bumpStreak(null, '2026-08-27');
  assert.deepEqual(streak, { count: 1, lastDate: '2026-08-27' });
});

test('consecutive calendar days increment the streak', () => {
  let streak = bumpStreak(null, '2026-08-25');
  streak = bumpStreak(streak, '2026-08-26');
  streak = bumpStreak(streak, '2026-08-27');
  assert.deepEqual(streak, { count: 3, lastDate: '2026-08-27' });
});

test('a gap of more than one day resets the streak to 1', () => {
  let streak = bumpStreak(null, '2026-08-20');
  streak = bumpStreak(streak, '2026-08-21');
  streak = bumpStreak(streak, '2026-08-25'); // four-day gap
  assert.deepEqual(streak, { count: 1, lastDate: '2026-08-25' });
});

test('bumping again on the same calendar day is idempotent', () => {
  let streak = bumpStreak(null, '2026-08-27');
  streak = bumpStreak(streak, '2026-08-27');
  streak = bumpStreak(streak, '2026-08-27');
  assert.deepEqual(streak, { count: 1, lastDate: '2026-08-27' });
});

test('same-day idempotency holds mid-streak too, not just on day one', () => {
  let streak = bumpStreak(null, '2026-08-25');
  streak = bumpStreak(streak, '2026-08-26');
  streak = bumpStreak(streak, '2026-08-26'); // studied twice on the same day
  streak = bumpStreak(streak, '2026-08-26');
  assert.deepEqual(streak, { count: 2, lastDate: '2026-08-26' });
});

test('a streak crossing a month/year boundary still counts consecutive days correctly', () => {
  let streak = bumpStreak(null, '2025-12-31');
  streak = bumpStreak(streak, '2026-01-01');
  assert.deepEqual(streak, { count: 2, lastDate: '2026-01-01' });
});

test('dateKey formats as YYYY-MM-DD', () => {
  const key = dateKey(new Date(2026, 7, 27)); // August is month index 7
  assert.equal(key, '2026-08-27');
});
