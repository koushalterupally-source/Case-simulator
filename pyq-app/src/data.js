/**
 * Catalog and shard access.
 *
 * Two things matter here. Questions and answers live in separate files, and while a Grand Test is
 * running the answer files for that paper are locked shut — see lockAnswers(). Hiding an answer key
 * that is already in memory is not hiding it.
 */

import { loadJSON } from './net.js';

const DATA_ROOT = 'data';

let catalogPromise = null;
const shardCache = new Map();

/** Paper ids whose answer shards must not be loaded. Set while a GT is in progress. */
const answerLocks = new Set();
/** shardId -> paperId, so a lock on a paper covers the shards it owns. */
const shardOwner = new Map();

export class AnswerKeyLockedError extends Error {
  constructor(shardId) {
    super(
      `Refusing to load answers for shard "${shardId}": its paper has a Grand Test in progress. ` +
        `Answers become available at submit.`
    );
    this.name = 'AnswerKeyLockedError';
    this.shardId = shardId;
  }
}

export async function loadCatalog() {
  if (!catalogPromise) {
    catalogPromise = loadJSON(`${DATA_ROOT}/catalog.json`).then((cat) => {
      for (const paper of cat.papers || []) {
        for (const shardId of paper.shards) shardOwner.set(shardId, paper.id);
      }
      return cat;
    });
    // A failed catalog load must not poison every later attempt.
    catalogPromise.catch(() => {
      catalogPromise = null;
    });
  }
  return catalogPromise;
}

function shard(shardId, kind) {
  const key = `${shardId}.${kind}`;
  if (!shardCache.has(key)) {
    const p = loadJSON(`${DATA_ROOT}/shards/${shardId}.${kind}.json`);
    p.catch(() => shardCache.delete(key));
    shardCache.set(key, p);
  }
  return shardCache.get(key);
}

/** Question text and options. Never contains a correct index. */
export async function loadQuestions(shardIds) {
  const parts = await Promise.all(shardIds.map((id) => shard(id, 'q')));
  return parts.flat();
}

/** Correct indices and explanations. Refuses while the owning paper is locked. */
export async function loadAnswers(shardIds) {
  for (const id of shardIds) {
    const owner = shardOwner.get(id);
    if (owner && answerLocks.has(owner)) throw new AnswerKeyLockedError(id);
  }
  const parts = await Promise.all(shardIds.map((id) => shard(id, 'a')));
  return parts.flat();
}

/** Practice mode: one question object carrying its own answer and explanation. */
export async function loadPracticeSet(shardIds) {
  const [qs, as] = await Promise.all([loadQuestions(shardIds), loadAnswers(shardIds)]);
  const byId = new Map(as.map((a) => [a.id, a]));
  return qs.map((q) => {
    const a = byId.get(q.id);
    if (!a) throw new Error(`Shard mismatch: no answer record for question "${q.id}"`);
    return {
      ...q,
      correct: a.correct,
      short: a.short,
      detail: a.detail,
      hasExplanation: a.hasExplanation,
    };
  });
}

export function lockAnswers(paperId) {
  answerLocks.add(paperId);
}

export function unlockAnswers(paperId) {
  answerLocks.delete(paperId);
}

export function isAnswerLocked(paperId) {
  return answerLocks.has(paperId);
}

/** Drop cached shards so a long session does not grow without bound. Catalog is kept. */
export function evictShards() {
  shardCache.clear();
}

export function findPaper(catalog, paperId) {
  return (catalog.papers || []).find((p) => p.id === paperId) || null;
}

export function findPracticeGroup(catalog, slug, groupName) {
  const subject = (catalog.practice || []).find((s) => s.slug === slug);
  if (!subject) return null;
  const group = subject.groups.find((g) => g.name === groupName);
  return group ? { subject, group } : null;
}
