import { CaseSession, PYQItem, DecisionGate, SimTurn, Vitals } from '../types';
import { createPRNG, shufflePYQOptions } from './rng';
import { cleanStem, isUsableAsGate } from './questionQuality';

/**
 * Question-led cases.
 *
 * The authored scaffolds cover 12 conditions, so a gate can only ever be filled
 * by a question about one of those 12 — which left roughly 96% of the bank
 * unreachable. This builds the case the other way round: start from a question,
 * gather the ones most related to it, and frame them as one sitting.
 *
 * It deliberately does NOT invent a patient, vitals, labs or a trajectory. There
 * is no clinical model behind these questions, and fabricating one is what made
 * earlier versions of this app misleading. A question-led case is honest about
 * being a themed set of real questions rather than a simulated encounter.
 */

const STOP = new Set([
  'which', 'what', 'following', 'patient', 'presents', 'with', 'the', 'and',
  'for', 'from', 'this', 'that', 'most', 'best', 'true', 'false', 'about',
  'seen', 'used', 'caused', 'due', 'not', 'all', 'except', 'given', 'below',
  'year', 'old', 'male', 'female', 'man', 'woman', 'child', 'his', 'her',
  'drug', 'test', 'cause', 'causes', 'treatment', 'feature', 'features',
]);

/** Stem-only vocabulary — used for duplicate detection, where option text is
 *  noise: two phrasings of the same question share the same four options. */
const stemTerms = (q: PYQItem): Set<string> =>
  new Set(
    (q.stem || '')
      .toLowerCase()
      .replace(/\((?:aiims|neet|inicet|fmge|jipmer)[^)]*\)/gi, '')
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 3 && !STOP.has(w))
  );

const terms = (q: PYQItem): Set<string> =>
  new Set(
    `${q.stem} ${q.topic || ''} ${Object.values(q.options || {}).join(' ')}`
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 4 && !STOP.has(w))
  );

/**
 * Inverse document frequency over the bank.
 *
 * Plain word-overlap clusters on whatever word happens to be common: an early
 * version grouped opium poisoning, cystic fibrosis, amniotic fluid and
 * lactational amenorrhoea because all four contain "secretion". Weighting each
 * shared word by how rare it is means a match on "amenorrhoea" counts for far
 * more than a match on "secretion", which is what actually signals two
 * questions are about the same thing.
 */
export function buildIdf(index: PYQItem[]): Map<string, number> {
  const df = new Map<string, number>();
  for (const q of index) {
    for (const t of terms(q)) df.set(t, (df.get(t) || 0) + 1);
  }
  const idf = new Map<string, number>();
  const N = Math.max(1, index.length);
  for (const [t, d] of df) idf.set(t, Math.log(N / d));
  return idf;
}

/** Rarity-weighted overlap, with same-system as a small nudge. */
export function affinity(
  a: PYQItem,
  aTerms: Set<string>,
  b: PYQItem,
  idf: Map<string, number>
): number {
  if (a.qid === b.qid) return -1;
  const bt = terms(b);
  let score = 0;
  for (const t of aTerms) {
    if (bt.has(t)) score += idf.get(t) ?? 0;
  }
  if (a.system && b.system && a.system === b.system && a.system !== 'General') score += 1;
  return score;
}

/**
 * How much of the seed question's own distinctiveness a candidate must share.
 *
 * This is a FRACTION, not an absolute score, because IDF values scale with the
 * size of the bank: a threshold tuned on 8,000 questions is unreachable in a
 * bank of 40, which would silently produce one-question sets for anyone with a
 * small bank.
 */
export const MIN_AFFINITY_RATIO = 0.18;

export interface QuestionLedOptions {
  subject?: string;
  seed?: string;
  seedQid?: string;
  gateCount?: number;
  missedQIDs?: string[];
  blindMode?: boolean;
  /** Precomputed IDF, so generating many cases does not rebuild it each time. */
  idf?: Map<string, number>;
}

export function buildQuestionLedCase(
  pyqIndex: PYQItem[],
  options: QuestionLedOptions = {}
): CaseSession {
  const seed = options.seed || `Q-${Math.floor(100000 + Math.random() * 900000)}`;
  const prng = createPRNG(seed);
  const want = options.gateCount ?? 5;

  // A question-led case draws from the whole bank rather than one condition, so
  // it is the most exposed to the unanswerable records in it — the 142 stems
  // that ask about a picture the app does not ship.
  const valid = pyqIndex.filter(isUsableAsGate);
  if (valid.length === 0) throw new Error('No usable questions in the bank.');

  let pool = valid;
  if (options.subject && options.subject !== 'All') {
    const bySubject = valid.filter(
      (q) => (q.subject || '').toLowerCase() === options.subject!.toLowerCase()
    );
    if (bySubject.length >= want) pool = bySubject;
  }

  // Weakness mode: start from something previously missed.
  const missed = new Set(options.missedQIDs || []);
  const missedPool = pool.filter((q) => missed.has(q.qid));

  const seedQ =
    (options.seedQid && valid.find((q) => q.qid === options.seedQid)) ||
    (missedPool.length > 0
      ? missedPool[Math.floor(prng() * missedPool.length)]
      : pool[Math.floor(prng() * pool.length)]);

  const idf = options.idf || buildIdf(valid);
  const seedTerms = terms(seedQ);

  // The bank repeats the same question across exam years — one cluster came
  // back as four near-identical Ga-68 PSMA stems. Asking the same thing five
  // times is not a case, so drop anything that overlaps an already-picked
  // question too heavily.
  const picked: Set<string>[] = [stemTerms(seedQ)];
  const isNearDuplicate = (t: Set<string>) =>
    picked.some((p) => {
      let inter = 0;
      for (const w of t) if (p.has(w)) inter++;
      const union = p.size + t.size - inter;
      return union > 0 && inter / union >= 0.5;
    });

  // The seed's total distinctiveness sets the bar for everything else.
  let seedWeight = 0;
  for (const t of seedTerms) seedWeight += idf.get(t) ?? 0;
  const bar = Math.max(0.5, seedWeight * MIN_AFFINITY_RATIO);

  const related: PYQItem[] = [];
  const ranked = pool
    .map((q) => ({ q, score: affinity(seedQ, seedTerms, q, idf) }))
    .filter((c) => c.score >= bar)
    .sort((a, b) => b.score - a.score);

  for (const { q } of ranked) {
    if (related.length >= want - 1) break;
    const st = stemTerms(q);
    if (isNearDuplicate(st)) continue;
    picked.push(st);
    related.push(q);
  }

  const chosen = [seedQ, ...related];

  const decisionGates: DecisionGate[] = chosen.map((pyq, idx) => {
    const { shuffledOptions, newCorrectAnswer } = shufflePYQOptions(
      pyq.options,
      pyq.correctAnswer,
      prng
    );
    return {
      id: `qgate_${idx + 1}`,
      pyq: { ...pyq, stem: cleanStem(pyq.stem), options: shuffledOptions, correctAnswer: newCorrectAnswer },
      triggerTurnIndex: idx,
      // Neutral framing only. Nothing here may hint at the answer, and nothing
      // may claim a clinical finding the question does not state.
      patientContext: `${pyq.subject}${pyq.system && pyq.system !== 'General' ? ` · ${pyq.system}` : ''}`,
      consequenceMessage: '',
    };
  });

  // A theme label built from the words the cluster actually shares.
  // Name the set after the most distinctive words the cluster shares.
  const shared = [...seedTerms]
    .filter((t) => related.length > 0 && related.every((r) => terms(r).has(t)))
    .sort((a, b) => (idf.get(b) ?? 0) - (idf.get(a) ?? 0))
    .slice(0, 3);
  const theme = shared.length > 0 ? shared.join(', ') : seedQ.topic || seedQ.system || seedQ.subject;

  const vitals: Vitals = {
    hr: 0, bp: '—', rr: 0, spo2: 0, temp: '—', grbs: 0,
  };

  const opening: SimTurn = {
    turnIndex: 1,
    simTime: { day: 1, hour: 9, minute: 0 },
    location: 'OPD',
    whatHappened:
      `A set of ${decisionGates.length} real exam question${decisionGates.length === 1 ? '' : 's'} ` +
      `drawn from your bank around ${theme}.\n\n` +
      `This is a question-led set, not a simulated patient — there are no vitals, ` +
      `labs or examination findings behind it, because the source questions do not ` +
      `describe one. Work through the decisions and you will be scored the same way.`,
    vitals,
    newResults: [],
  };

  return {
    id: `qcase_${Date.now()}`,
    seed,
    scaffoldId: '',
    title: `Question set — ${theme}`,
    mode: options.blindMode ? 'blind' : 'standard',
    subject: seedQ.subject || 'Mixed',
    isQuestionLed: true,
    patient: {
      id: `q_${Date.now()}`,
      name: 'Question set',
      age: 0,
      gender: 'Male',
      chiefComplaint: `${chosen.length} questions on ${theme}`,
      setting: 'OPD',
      initialVitals: vitals,
      currentVitals: vitals,
      diagnosis: '',
      clinchingClue: '',
      clinchingClueTime: '',
    },
    currentLocation: 'OPD',
    simTime: { day: 1, hour: 9, minute: 0 },
    turns: [opening],
    pendingOrders: [],
    completedOrders: [],
    historyLog: [],
    examLog: [],
    decisionGates,
    currentGateIndex: decisionGates.length > 0 ? 0 : -1,
    incidentalFindings: [],
    status: 'active',
    blindMode: !!options.blindMode,
  };
}
