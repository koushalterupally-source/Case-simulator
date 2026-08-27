import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_SCHEME,
  NEGATIVE_SCHEME,
  defaultDurationMs,
  createSession,
  remainingMs,
  isExpired,
  goTo,
  next,
  answer,
  clearResponse,
  toggleMark,
  paletteState,
  counts,
  submit,
  bySubject,
  timeAnalysis,
  formatClock,
} from '../src/gt.js';

const T0 = 1_700_000_000_000;

const paper = { id: 'gt2-014', name: 'NEETPG Mock-5', date: '2025-07-15', source: 'Grand Tests', shards: ['gt2-014-0'] };

function fixture(count = 5) {
  const questions = [];
  const answers = [];
  const subjects = ['Pathology', 'Medicine', null, 'Pathology', 'Surgery'];
  for (let n = 0; n < count; n++) {
    questions.push({
      id: `q${n}`,
      n,
      question: `Question ${n}`,
      options: n === 4 ? ['a', 'b', 'c'] : ['a', 'b', 'c', 'd'],
      subject: subjects[n % subjects.length],
      subjectFrom: subjects[n % subjects.length] ? 'lexicon' : null,
    });
    answers.push({ id: `q${n}`, correct: 1, short: 'Ans: B', detail: '<p>because</p>', hasExplanation: true });
  }
  return { questions, answers };
}

function newSession(count = 5, scheme = DEFAULT_SCHEME, durationMs = 60_000) {
  return createSession({ paper, questionCount: count, scheme, durationMs, now: T0 });
}

test('duration defaults to a minute a question, rounded up to five minutes', () => {
  assert.equal(defaultDurationMs(200), 200 * 60_000);
  assert.equal(defaultDurationMs(28), 30 * 60_000);
  assert.equal(defaultDurationMs(196), 200 * 60_000);
});

test('remaining time is computed from the absolute end, so it cannot drift', () => {
  const s = newSession(5, DEFAULT_SCHEME, 3_600_000);
  assert.equal(remainingMs(s, T0), 3_600_000);
  // Ten thousand ticks must not accumulate any error, because nothing is being decremented.
  for (let i = 0; i < 10_000; i++) remainingMs(s, T0 + i);
  assert.equal(remainingMs(s, T0 + 1_234_567), 3_600_000 - 1_234_567);
});

test('backgrounding the app does not stop the exam clock', () => {
  const s = newSession(5, DEFAULT_SCHEME, 3_600_000);
  const awayFiveMinutes = T0 + 5 * 60_000;
  assert.equal(remainingMs(s, awayFiveMinutes), 3_600_000 - 5 * 60_000);
});

test('the clock floors at zero and reports expiry', () => {
  const s = newSession(5, DEFAULT_SCHEME, 60_000);
  assert.equal(isExpired(s, T0 + 59_999), false);
  assert.equal(isExpired(s, T0 + 60_000), true);
  assert.equal(remainingMs(s, T0 + 999_999), 0);
});

test('a submitted session reports no remaining time', () => {
  const { questions, answers } = fixture();
  const s = newSession();
  submit(s, questions, answers, T0 + 1000);
  assert.equal(remainingMs(s, T0 + 2000), 0);
  assert.equal(isExpired(s, T0 + 999_999), false);
});

test('palette reflects all five states', () => {
  const s = newSession();
  assert.equal(paletteState(s, 0), 'unanswered', 'question 1 is visited on open');
  assert.equal(paletteState(s, 3), 'not-visited');

  goTo(s, 1, T0 + 1000);
  assert.equal(paletteState(s, 1), 'unanswered');

  answer(s, 1, 2, T0 + 2000);
  assert.equal(paletteState(s, 1), 'answered');

  toggleMark(s, 1, T0 + 3000);
  assert.equal(paletteState(s, 1), 'answered-marked');

  clearResponse(s, 1, T0 + 4000);
  assert.equal(paletteState(s, 1), 'marked');

  toggleMark(s, 1, T0 + 5000);
  assert.equal(paletteState(s, 1), 'unanswered');
});

test('answering option zero counts as answered', () => {
  // A truthiness check on the chosen index would silently treat option A as unanswered.
  const s = newSession();
  answer(s, 0, 0, T0 + 100);
  assert.equal(paletteState(s, 0), 'answered');
  assert.equal(counts(s).answered, 1);
});

test('counts stay consistent', () => {
  const s = newSession();
  answer(s, 0, 1, T0 + 100);
  answer(s, 2, 3, T0 + 200);
  toggleMark(s, 4, T0 + 300);
  const c = counts(s);
  assert.deepEqual(
    { answered: c.answered, unanswered: c.unanswered, marked: c.marked, total: c.total },
    { answered: 2, unanswered: 3, marked: 1, total: 5 }
  );
});

test('time accrues to the question being left, not the one arrived at', () => {
  const s = newSession();
  goTo(s, 1, T0 + 10_000);
  goTo(s, 2, T0 + 15_000);
  assert.equal(s.timeSpent[0], 10_000);
  assert.equal(s.timeSpent[1], 5_000);
  assert.equal(s.timeSpent[2], undefined);
});

test('revisiting a question adds to its time rather than replacing it', () => {
  const s = newSession();
  goTo(s, 1, T0 + 4_000);
  goTo(s, 0, T0 + 6_000);
  goTo(s, 1, T0 + 9_000);
  assert.equal(s.timeSpent[0], 4_000 + 3_000);
  assert.equal(s.timeSpent[1], 2_000);
});

test('navigation is clamped at both ends', () => {
  const s = newSession(3);
  goTo(s, -1, T0 + 100);
  assert.equal(s.current, 0);
  goTo(s, 99, T0 + 200);
  assert.equal(s.current, 0);
  next(s, T0 + 300);
  next(s, T0 + 400);
  next(s, T0 + 500);
  assert.equal(s.current, 2);
});

test('a session survives a JSON round-trip unchanged', () => {
  const s = newSession();
  answer(s, 0, 1, T0 + 100);
  toggleMark(s, 2, T0 + 200);
  goTo(s, 3, T0 + 300);
  const restored = JSON.parse(JSON.stringify(s));
  assert.deepEqual(restored, s);
  assert.equal(remainingMs(restored, T0 + 1000), remainingMs(s, T0 + 1000));
  assert.equal(paletteState(restored, 2), 'marked');
});

test('scoring counts correct, wrong and skipped', () => {
  const { questions, answers } = fixture();
  const s = newSession();
  answer(s, 0, 1, T0 + 100); // correct
  answer(s, 1, 0, T0 + 200); // wrong
  answer(s, 2, 1, T0 + 300); // correct
  // 3 and 4 skipped
  const r = submit(s, questions, answers, T0 + 400);
  assert.equal(r.correct, 2);
  assert.equal(r.wrong, 1);
  assert.equal(r.skipped, 2);
  assert.equal(r.attempted, 3);
  assert.equal(r.score, 2);
  assert.equal(r.maxScore, 5);
  assert.ok(Math.abs(r.accuracy - 2 / 3) < 1e-9);
});

test('negative marking is applied when the scheme asks for it', () => {
  const { questions, answers } = fixture();
  const s = newSession(5, NEGATIVE_SCHEME);
  answer(s, 0, 1, T0 + 100); // correct  +4
  answer(s, 1, 0, T0 + 200); // wrong    -1
  const r = submit(s, questions, answers, T0 + 300);
  assert.equal(r.score, 3);
  assert.equal(r.maxScore, 20);
});

test('an all-skipped paper scores zero rather than NaN', () => {
  const { questions, answers } = fixture();
  const s = newSession();
  const r = submit(s, questions, answers, T0 + 400);
  assert.equal(r.attempted, 0);
  assert.equal(r.skipped, 5);
  assert.equal(r.accuracy, 0);
  assert.ok(Number.isFinite(r.accuracy));
  assert.ok(Number.isFinite(r.percent));
});

test('a three-option question scores like any other', () => {
  const { questions, answers } = fixture();
  const s = newSession();
  assert.equal(questions[4].options.length, 3);
  answer(s, 4, 1, T0 + 100);
  const r = submit(s, questions, answers, T0 + 200);
  assert.equal(r.questions[4].isCorrect, true);
});

test('submitting twice does not double-count or move the clock', () => {
  const { questions, answers } = fixture();
  const s = newSession();
  answer(s, 0, 1, T0 + 100);
  const first = submit(s, questions, answers, T0 + 200);
  const second = submit(s, questions, answers, T0 + 900);
  assert.equal(second.correct, first.correct);
  assert.equal(second.score, first.score);
  assert.equal(s.submittedAt, first.submittedAt);
});

test('auto-submit at expiry never records a time past the deadline', () => {
  const { questions, answers } = fixture();
  const s = newSession(5, DEFAULT_SCHEME, 60_000);
  const late = T0 + 65_000; // a tick arriving after the deadline
  const r = submit(s, questions, answers, late);
  assert.equal(s.submittedAt, s.endsAt);
  assert.equal(r.totalTimeMs, 60_000);
});

test('answers are matched by id, so a shard ordering bug is loud', () => {
  const { questions, answers } = fixture();
  const s = newSession();
  const missing = answers.filter((a) => a.id !== 'q3');
  assert.throws(() => submit(s, questions, missing, T0 + 100), /No answer record for question "q3"/);
});

test('subject breakdown quarantines unclassified questions', () => {
  const { questions, answers } = fixture();
  const s = newSession();
  answer(s, 0, 1, T0 + 100); // Pathology, correct
  answer(s, 3, 0, T0 + 200); // Pathology, wrong
  answer(s, 2, 1, T0 + 300); // unclassified, correct
  const r = submit(s, questions, answers, T0 + 400);
  const b = bySubject(r);

  assert.equal(b.unclassified, 1);
  assert.equal(b.classified, 4);
  const pathology = b.subjects.find((x) => x.subject === 'Pathology');
  assert.equal(pathology.total, 2, 'the unclassified question is not folded into a subject');
  assert.equal(pathology.correct, 1);
  assert.equal(pathology.wrong, 1);
  assert.equal(pathology.accuracy, 0.5);
  assert.equal(
    b.subjects.reduce((sum, x) => sum + x.total, 0) + b.unclassified,
    r.count,
    'every question is accounted for exactly once'
  );
});

test('a subject with nothing attempted reports zero accuracy, not NaN', () => {
  const { questions, answers } = fixture();
  const s = newSession();
  const r = submit(s, questions, answers, T0 + 100);
  for (const subject of bySubject(r).subjects) {
    assert.ok(Number.isFinite(subject.accuracy));
    assert.ok(Number.isFinite(subject.avgTimeMs));
  }
});

test('time analysis separates slow-and-right from slow-and-wrong', () => {
  const { questions, answers } = fixture();
  const s = newSession(5, DEFAULT_SCHEME, 3_600_000);
  answer(s, 0, 1, T0 + 100);
  goTo(s, 1, T0 + 200_000); // 200s on question 0, correct
  answer(s, 1, 0, T0 + 200_100);
  goTo(s, 2, T0 + 400_000); // 200s on question 1, wrong
  const r = submit(s, questions, answers, T0 + 400_100);
  const t = timeAnalysis(r, 120_000);
  assert.equal(t.slow.length, 2);
  assert.equal(t.slowPaidOff, 1);
  assert.equal(t.slowWasted, 1);
  assert.ok(t.avgMs > 0);
});

test('a finished session ignores further interaction', () => {
  const { questions, answers } = fixture();
  const s = newSession();
  submit(s, questions, answers, T0 + 100);
  answer(s, 0, 2, T0 + 200);
  toggleMark(s, 0, T0 + 200);
  goTo(s, 4, T0 + 200);
  assert.deepEqual(s.answers, {});
  assert.deepEqual(s.marked, {});
  assert.equal(s.current, 0);
});

test('the clock reads correctly either side of an hour', () => {
  assert.equal(formatClock(0), '00:00');
  assert.equal(formatClock(59_000), '00:59');
  assert.equal(formatClock(60_000), '01:00');
  assert.equal(formatClock(3_599_000), '59:59');
  assert.equal(formatClock(3_600_000), '1:00:00');
  assert.equal(formatClock(12_600_000), '3:30:00');
  assert.equal(formatClock(-5), '00:00');
});
