import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createSession,
  goTo,
  next,
  prev,
  answer,
  isAnswered,
  progress,
  score,
  finish,
  mistakes,
} from '../src/practice.js';

const T0 = 1_700_000_000_000;

function fixture() {
  return [
    { id: 'q0', n: 0, question: 'A', options: ['a', 'b', 'c', 'd'], correct: 1, subject: 'Pathology' },
    { id: 'q1', n: 1, question: 'B', options: ['a', 'b', 'c', 'd'], correct: 0, subject: 'Medicine' },
    { id: 'q2', n: 2, question: 'C', options: ['a', 'b', 'c'], correct: 2, subject: null },
  ];
}

function newSession(count = 3) {
  return createSession({
    source: 'CEREB',
    title: 'Anatomy',
    slug: 'cereb-anatomy',
    groupName: 'Thorax',
    shards: ['cereb-anatomy-0-0'],
    questionCount: count,
    now: T0,
  });
}

test('a fresh session starts at the first question with nothing answered', () => {
  const s = newSession();
  assert.equal(s.current, 0);
  assert.deepEqual(progress(s), { answered: 0, remaining: 3, total: 3 });
  assert.equal(s.status, 'running');
});

test('answering reveals the explanation and locks the choice', () => {
  const s = newSession();
  answer(s, 0, 2, T0 + 100);
  assert.equal(isAnswered(s, 0), true);
  assert.equal(s.revealed[0], true);
  assert.equal(s.answers[0], 2);
});

test('a locked answer cannot be rewritten', () => {
  // Otherwise tapping again after seeing the correct option silently inflates the score.
  const s = newSession();
  answer(s, 0, 2, T0 + 100);
  answer(s, 0, 1, T0 + 200);
  assert.equal(s.answers[0], 2);
  assert.equal(score(s, fixture()).correct, 0);
});

test('choosing option zero registers as an answer', () => {
  const s = newSession();
  answer(s, 1, 0, T0 + 100);
  assert.equal(isAnswered(s, 1), true);
  assert.equal(progress(s).answered, 1);
});

test('scoring counts only what was attempted', () => {
  const s = newSession();
  const qs = fixture();
  answer(s, 0, 1, T0 + 100); // correct
  answer(s, 1, 3, T0 + 200); // wrong
  const r = score(s, qs);
  assert.equal(r.correct, 1);
  assert.equal(r.wrong, 1);
  assert.equal(r.attempted, 2);
  assert.equal(r.accuracy, 0.5);
});

test('an untouched session scores zero rather than NaN', () => {
  const r = score(newSession(), fixture());
  assert.equal(r.attempted, 0);
  assert.equal(r.accuracy, 0);
  assert.ok(Number.isFinite(r.accuracy));
});

test('a three-option question scores correctly', () => {
  const s = newSession();
  answer(s, 2, 2, T0 + 100);
  assert.equal(score(s, fixture()).correct, 1);
});

test('navigation is clamped and accrues time to the question being left', () => {
  const s = newSession();
  goTo(s, 1, T0 + 5_000);
  assert.equal(s.timeSpent[0], 5_000);
  prev(s, T0 + 8_000);
  assert.equal(s.timeSpent[1], 3_000);
  assert.equal(s.current, 0);
  prev(s, T0 + 9_000);
  assert.equal(s.current, 0);
  next(s, T0 + 10_000);
  next(s, T0 + 11_000);
  next(s, T0 + 12_000);
  assert.equal(s.current, 2);
});

test('the mistake bank collects wrong answers only', () => {
  const s = newSession();
  const qs = fixture();
  answer(s, 0, 1, T0 + 100); // correct
  answer(s, 1, 3, T0 + 200); // wrong
  const m = mistakes(s, qs);
  assert.equal(m.length, 1);
  assert.equal(m[0].questionId, 'q1');
  assert.equal(m[0].chosen, 3);
  assert.equal(m[0].correct, 0);
  assert.equal(m[0].subject, 'Medicine');
});

test('an unclassified question still records a usable mistake', () => {
  const s = newSession();
  answer(s, 2, 0, T0 + 100); // wrong, subject null
  const m = mistakes(s, fixture());
  assert.equal(m.length, 1);
  assert.equal(m[0].subject, null);
  assert.equal(m[0].questionId, 'q2');
});

test('a session survives a JSON round-trip', () => {
  const s = newSession();
  answer(s, 0, 1, T0 + 100);
  goTo(s, 2, T0 + 200);
  const restored = JSON.parse(JSON.stringify(s));
  assert.deepEqual(restored, s);
  assert.equal(isAnswered(restored, 0), true);
});

test('finishing is idempotent', () => {
  const s = newSession();
  finish(s, T0 + 1_000);
  const at = s.finishedAt;
  finish(s, T0 + 9_000);
  assert.equal(s.finishedAt, at);
  assert.equal(s.status, 'finished');
});
