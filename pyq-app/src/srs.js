/**
 * Spaced repetition scheduling — pure logic, no DOM, no storage.
 *
 * Ported from the reference app's `rateAnkiCard` (an SM-2 variant), where a rating is one of four
 * buttons rather than the classic 0-5 scale:
 *
 *   1 = Again   2 = Hard   3 = Good   4 = Easy
 *
 * The reference maps those onto the SM-2 quality scale as `quality === 4 ? 5 : quality` (Easy
 * becomes a 5; the rest pass through unchanged), then treats anything below 3 — Again *and*
 * Hard — as a lapse: repetitions reset to zero, a lapse is counted, and the card drops into a
 * short relearning step. This is a real property of the reference algorithm, not an
 * approximation, and it is kept exactly: Hard is not "pass, but slower" here, it is a fail.
 *
 * The reference stores its short relearning steps as literal minutes (1 minute for Again, 6 for
 * Hard) because a lapsed card is meant to resurface later the same sitting. This port expresses
 * every interval in days, per this app's storage schema, by carrying the same minute values
 * through as fractions of a day — `due` comes out to the identical wall-clock timestamp the
 * reference would have produced. Note that ease is untouched on a lapse in the reference (the
 * ease-factor line lives only in the "passed" branch below), so repeated Again/Hard presses do
 * not, by themselves, move the ease factor — only repeated Good/Easy presses do, and Good's own
 * formula actually *lowers* ease every time, which is how the 1.3 floor gets exercised in
 * practice.
 */

export const INITIAL_EASE = 2.5;
export const MIN_EASE = 1.3;

const DAY_MS = 24 * 60 * 60 * 1000;
/** One reference "minute" expressed as a fraction of a day, so short relearning steps still land
 * on the same due timestamp once multiplied back out by DAY_MS. */
const MINUTE_AS_DAYS = 1 / 1440;

/** A freshly created card, before its first review. */
export function createCardState(now = Date.now()) {
  return {
    easeFactor: INITIAL_EASE,
    intervalDays: 0,
    repetitions: 0,
    lapses: 0,
    status: 'new',
    due: now,
  };
}

/**
 * Advance one card by one rating.
 *
 * `card` is `{ easeFactor, intervalDays, repetitions, lapses, status }` (missing fields default
 * to a brand-new card's values, so a bare `{}` is a safe "never studied" input). `quality` is
 * 1-4 as above. Returns the *next* card state, including the `due` timestamp computed from
 * `now`. Never mutates its input.
 */
export function schedule(card, quality, now = Date.now()) {
  const easeFactor = numberOr(card && card.easeFactor, INITIAL_EASE);
  const intervalDays = numberOr(card && card.intervalDays, 0);
  const repetitions = numberOr(card && card.repetitions, 0);
  const lapses = numberOr(card && card.lapses, 0);

  // quality 4 (Easy) maps to the SM-2 quality-5 branch; 1-3 pass through unchanged.
  const sm2q = quality === 4 ? 5 : quality;

  let nextEase = easeFactor;
  let nextInterval;
  let nextReps;
  let nextLapses = lapses;
  let status;

  if (sm2q < 3) {
    // Again or Hard: a lapse. Reset repetitions, drop into a short relearning step, leave ease
    // untouched — exactly as the reference does.
    nextReps = 0;
    nextInterval = quality === 1 ? MINUTE_AS_DAYS : 6 * MINUTE_AS_DAYS;
    nextLapses = lapses + 1;
    status = 'learning';
  } else {
    if (repetitions === 0) {
      nextInterval = quality === 4 ? 4 : 10 * MINUTE_AS_DAYS;
    } else if (repetitions === 1) {
      nextInterval = quality === 4 ? 4 : 1;
    } else {
      nextInterval = Math.round(intervalDays * easeFactor);
    }
    // Reference formula, verbatim: ease += 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02), floored at 1.3.
    nextEase = Math.max(MIN_EASE, easeFactor + (0.1 - (5 - sm2q) * (0.08 + (5 - sm2q) * 0.02)));
    nextReps = repetitions + 1;
    status = 'review';
  }

  return {
    easeFactor: nextEase,
    intervalDays: nextInterval,
    repetitions: nextReps,
    lapses: nextLapses,
    status,
    due: now + nextInterval * DAY_MS,
  };
}

/** Is this card due for review right now? A brand-new card (never scheduled) is always due. */
export function isDue(card, now = Date.now()) {
  if (!card) return true;
  if (card.status === 'new' || card.due == null) return true;
  return card.due <= now;
}

function numberOr(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/* ---------------------------------------------------------------------------- streak logic */

/** `YYYY-MM-DD` for a Date in local time, the same granularity the streak is tracked at. */
export function dateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function daysBetweenKeys(a, b) {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  const utcA = Date.UTC(ay, am - 1, ad);
  const utcB = Date.UTC(by, bm - 1, bd);
  return Math.round((utcB - utcA) / DAY_MS);
}

/**
 * Advance the study streak for `todayKey` (a `YYYY-MM-DD` string, defaulting to today).
 *
 * `state` is `{ count, lastDate }` or nullish for "never studied before". A gap of exactly one
 * day increments the streak; any other gap (including going backwards, which should not happen
 * but must not corrupt the count) resets it to 1; the same calendar day is idempotent — calling
 * this more than once in a day must not inflate the count.
 */
export function bumpStreak(state, todayKey = dateKey()) {
  const lastDate = state && state.lastDate;
  const count = state && typeof state.count === 'number' && state.count > 0 ? state.count : 0;

  if (!lastDate) return { count: 1, lastDate: todayKey };
  if (lastDate === todayKey) return { count: count || 1, lastDate };

  const gap = daysBetweenKeys(lastDate, todayKey);
  if (gap === 1) return { count: count + 1, lastDate: todayKey };
  return { count: 1, lastDate: todayKey };
}
