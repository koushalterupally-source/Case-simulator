/**
 * Grand Test session engine.
 *
 * Pure logic — no DOM, no storage, no fetching. Everything here is serializable so a session can be
 * written to IndexedDB after every interaction and restored byte-identical after a force-kill.
 *
 * The clock is an absolute `endsAt` timestamp. Remaining time is always `endsAt - now`, never a counter
 * decremented on an interval: a decremented counter drifts over a three-hour sitting and freezes entirely
 * while the app is backgrounded, so the candidate returns to an exam that quietly stopped running.
 */

export const DEFAULT_SCHEME = { correct: 1, wrong: 0, skipped: 0 };
export const NEGATIVE_SCHEME = { correct: 4, wrong: -1, skipped: 0 };

/** One minute per question, rounded up to the nearest five minutes. */
export function defaultDurationMs(questionCount) {
  const minutes = Math.ceil(questionCount / 5) * 5;
  return minutes * 60 * 1000;
}

export function createSession({ paper, questionCount, scheme, durationMs, now = Date.now() }) {
  const duration = durationMs || defaultDurationMs(questionCount);
  return {
    id: `gt_${paper.id}_${now}`,
    kind: 'gt',
    paperId: paper.id,
    paperName: paper.name,
    paperDate: paper.date || null,
    source: paper.source,
    shards: paper.shards.slice(),
    count: questionCount,
    scheme: { ...(scheme || DEFAULT_SCHEME) },
    startedAt: now,
    durationMs: duration,
    endsAt: now + duration,
    status: 'running',
    current: 0,
    enteredAt: now,
    answers: {},
    marked: {},
    visited: { 0: true },
    timeSpent: {},
    submittedAt: null,
  };
}

export function remainingMs(session, now = Date.now()) {
  if (session.status !== 'running') return 0;
  return Math.max(0, session.endsAt - now);
}

export function isExpired(session, now = Date.now()) {
  return session.status === 'running' && now >= session.endsAt;
}

export function elapsedMs(session, now = Date.now()) {
  const end = session.status === 'running' ? now : session.submittedAt || now;
  return Math.max(0, end - session.startedAt);
}

/** Bank the time spent on the question the candidate is currently looking at. */
function accrue(session, now) {
  const spent = Math.max(0, now - session.enteredAt);
  const n = session.current;
  session.timeSpent[n] = (session.timeSpent[n] || 0) + spent;
  session.enteredAt = now;
}

export function goTo(session, n, now = Date.now()) {
  if (session.status !== 'running') return session;
  if (n < 0 || n >= session.count || n === session.current) return session;
  accrue(session, now);
  session.current = n;
  session.visited[n] = true;
  return session;
}

export function next(session, now = Date.now()) {
  return goTo(session, Math.min(session.count - 1, session.current + 1), now);
}

export function prev(session, now = Date.now()) {
  return goTo(session, Math.max(0, session.current - 1), now);
}

export function answer(session, n, optionIndex, now = Date.now()) {
  if (session.status !== 'running') return session;
  if (n < 0 || n >= session.count) return session;
  accrue(session, now);
  session.answers[n] = optionIndex;
  session.visited[n] = true;
  return session;
}

export function clearResponse(session, n, now = Date.now()) {
  if (session.status !== 'running') return session;
  accrue(session, now);
  delete session.answers[n];
  return session;
}

export function toggleMark(session, n, now = Date.now()) {
  if (session.status !== 'running') return session;
  accrue(session, now);
  if (session.marked[n]) delete session.marked[n];
  else session.marked[n] = true;
  return session;
}

/**
 * Palette cell state. Mirrors the convention every Indian test-taker already knows:
 * not-visited / unanswered (seen, left blank) / answered / marked / answered-marked.
 */
export function paletteState(session, n) {
  const answered = Object.prototype.hasOwnProperty.call(session.answers, n);
  const marked = !!session.marked[n];
  if (answered && marked) return 'answered-marked';
  if (marked) return 'marked';
  if (answered) return 'answered';
  if (session.visited[n]) return 'unanswered';
  return 'not-visited';
}

export function counts(session) {
  let answered = 0;
  let marked = 0;
  let visited = 0;
  for (let n = 0; n < session.count; n++) {
    if (Object.prototype.hasOwnProperty.call(session.answers, n)) answered++;
    if (session.marked[n]) marked++;
    if (session.visited[n]) visited++;
  }
  return { answered, unanswered: session.count - answered, marked, visited, total: session.count };
}

/**
 * Close the session and score it.
 *
 * `questions` is the .q.json content; `answerRecords` the .a.json content, which the caller must not
 * have fetched before this moment. Both are matched by id, not by position, so a shard ordering bug
 * surfaces as an error rather than as silently wrong marking.
 */
export function submit(session, questions, answerRecords, now = Date.now()) {
  if (session.status !== 'running') return buildResult(session, questions, answerRecords);
  accrue(session, now);
  session.status = 'submitted';
  session.submittedAt = Math.min(now, session.endsAt);
  return buildResult(session, questions, answerRecords);
}

function buildResult(session, questions, answerRecords) {
  const keyById = new Map(answerRecords.map((a) => [a.id, a]));
  const scheme = session.scheme;

  let correct = 0;
  let wrong = 0;
  let skipped = 0;

  const rows = questions.map((q, idx) => {
    const n = typeof q.n === 'number' ? q.n : idx;
    const key = keyById.get(q.id);
    if (!key) throw new Error(`No answer record for question "${q.id}" while scoring ${session.paperId}`);

    const chosen = Object.prototype.hasOwnProperty.call(session.answers, n) ? session.answers[n] : null;
    const isCorrect = chosen !== null && chosen === key.correct;

    if (chosen === null) skipped++;
    else if (isCorrect) correct++;
    else wrong++;

    return {
      n,
      id: q.id,
      question: q.question,
      options: q.options,
      subject: q.subject || null,
      subjectFrom: q.subjectFrom || null,
      chosen,
      correctIndex: key.correct,
      isCorrect,
      marked: !!session.marked[n],
      visited: !!session.visited[n],
      timeMs: session.timeSpent[n] || 0,
      short: key.short,
      detail: key.detail,
      hasExplanation: !!key.hasExplanation,
    };
  });

  const attempted = correct + wrong;
  const score = correct * scheme.correct + wrong * scheme.wrong + skipped * scheme.skipped;
  const maxScore = session.count * scheme.correct;

  return {
    sessionId: session.id,
    paperId: session.paperId,
    paperName: session.paperName,
    paperDate: session.paperDate,
    source: session.source,
    count: session.count,
    scheme,
    score,
    maxScore,
    correct,
    wrong,
    skipped,
    attempted,
    // An all-skipped paper is a real case; it must read as 0%, not NaN%.
    accuracy: attempted > 0 ? correct / attempted : 0,
    percent: maxScore > 0 ? score / maxScore : 0,
    totalTimeMs: elapsedMs(session, session.submittedAt || Date.now()),
    startedAt: session.startedAt,
    submittedAt: session.submittedAt,
    questions: rows,
  };
}

/**
 * Subject breakdown for the analysis screen.
 *
 * Questions the build-time classifier could not place are reported as their own bucket and excluded from
 * every other subject's denominator. Spreading them across subjects would invent a breakdown that the
 * data does not support.
 */
export function bySubject(result) {
  const buckets = new Map();
  let unclassified = 0;

  for (const row of result.questions) {
    if (!row.subject) {
      unclassified++;
      continue;
    }
    if (!buckets.has(row.subject)) {
      buckets.set(row.subject, { subject: row.subject, total: 0, correct: 0, wrong: 0, skipped: 0, timeMs: 0 });
    }
    const b = buckets.get(row.subject);
    b.total++;
    b.timeMs += row.timeMs;
    if (row.chosen === null) b.skipped++;
    else if (row.isCorrect) b.correct++;
    else b.wrong++;
  }

  const subjects = [...buckets.values()]
    .map((b) => {
      const attempted = b.correct + b.wrong;
      return {
        ...b,
        attempted,
        accuracy: attempted > 0 ? b.correct / attempted : 0,
        avgTimeMs: b.total > 0 ? b.timeMs / b.total : 0,
      };
    })
    .sort((a, b) => b.total - a.total);

  const ranked = subjects.filter((s) => s.attempted >= 3).sort((a, b) => a.accuracy - b.accuracy);

  return { subjects, unclassified, classified: result.count - unclassified, weakest: ranked.slice(0, 3) };
}

/** Questions where time was spent without buying a correct answer. */
export function timeAnalysis(result, slowThresholdMs = 120000) {
  const rows = result.questions.filter((r) => r.timeMs > 0);
  const totalTracked = rows.reduce((sum, r) => sum + r.timeMs, 0);
  const slow = result.questions
    .filter((r) => r.timeMs >= slowThresholdMs)
    .sort((a, b) => b.timeMs - a.timeMs);

  return {
    avgMs: rows.length > 0 ? totalTracked / rows.length : 0,
    slow,
    slowWasted: slow.filter((r) => !r.isCorrect).length,
    slowPaidOff: slow.filter((r) => r.isCorrect).length,
    fastestCorrect: result.questions
      .filter((r) => r.isCorrect && r.timeMs > 0)
      .sort((a, b) => a.timeMs - b.timeMs)
      .slice(0, 5),
  };
}

export function formatClock(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (v) => String(v).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
