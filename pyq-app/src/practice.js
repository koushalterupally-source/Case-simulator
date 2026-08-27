/**
 * Practice session engine.
 *
 * Pure logic, like gt.js. The difference from a Grand Test is not cosmetic: practice reveals the answer
 * and explanation the moment a choice is locked in, there is no countdown, and leaving is always safe.
 */

export function createSession({ source, title, slug, groupName, shards, questionCount, now = Date.now() }) {
  return {
    id: `pr_${slug}_${now}`,
    kind: 'practice',
    source,
    title,
    slug,
    groupName,
    shards: shards.slice(),
    count: questionCount,
    startedAt: now,
    updatedAt: now,
    status: 'running',
    current: 0,
    answers: {},
    revealed: {},
    timeSpent: {},
    enteredAt: now,
  };
}

function accrue(session, now) {
  const spent = Math.max(0, now - session.enteredAt);
  session.timeSpent[session.current] = (session.timeSpent[session.current] || 0) + spent;
  session.enteredAt = now;
  session.updatedAt = now;
}

export function goTo(session, n, now = Date.now()) {
  if (n < 0 || n >= session.count || n === session.current) return session;
  accrue(session, now);
  session.current = n;
  return session;
}

export function next(session, now = Date.now()) {
  return goTo(session, Math.min(session.count - 1, session.current + 1), now);
}

export function prev(session, now = Date.now()) {
  return goTo(session, Math.max(0, session.current - 1), now);
}

/**
 * Lock in a choice. Once answered a question stays answered — re-tapping an option after the answer is
 * revealed must not silently rewrite history and inflate the score.
 */
export function answer(session, n, optionIndex, now = Date.now()) {
  if (Object.prototype.hasOwnProperty.call(session.answers, n)) return session;
  accrue(session, now);
  session.answers[n] = optionIndex;
  session.revealed[n] = true;
  return session;
}

export function isAnswered(session, n) {
  return Object.prototype.hasOwnProperty.call(session.answers, n);
}

export function progress(session) {
  const answered = Object.keys(session.answers).length;
  return { answered, remaining: session.count - answered, total: session.count };
}

/** Score so far. Practice has no marking scheme — it is simply right against attempted. */
export function score(session, questions) {
  let correct = 0;
  let wrong = 0;
  for (const q of questions) {
    const n = typeof q.n === 'number' ? q.n : questions.indexOf(q);
    if (!isAnswered(session, n)) continue;
    if (session.answers[n] === q.correct) correct++;
    else wrong++;
  }
  const attempted = correct + wrong;
  return {
    correct,
    wrong,
    attempted,
    total: session.count,
    accuracy: attempted > 0 ? correct / attempted : 0,
  };
}

export function finish(session, now = Date.now()) {
  if (session.status !== 'running') return session;
  accrue(session, now);
  session.status = 'finished';
  session.finishedAt = now;
  return session;
}

/** Rows destined for the mistake bank: everything answered wrong. */
export function mistakes(session, questions) {
  const out = [];
  for (const q of questions) {
    const n = typeof q.n === 'number' ? q.n : questions.indexOf(q);
    if (!isAnswered(session, n)) continue;
    if (session.answers[n] === q.correct) continue;
    out.push({
      questionId: q.id,
      subject: q.subject || null,
      source: session.source,
      title: session.title,
      chosen: session.answers[n],
      correct: q.correct,
      at: session.updatedAt,
    });
  }
  return out;
}
