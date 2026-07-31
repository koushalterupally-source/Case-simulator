import {
  CaseSession,
  CaseMode,
  PYQItem,
  DecisionGate,
  IncidentalFinding,
  CaseScaffold,
} from '../types';
import { CASE_SCAFFOLDS } from '../data/cases/scaffolds';
import { createPRNG, shufflePYQOptions } from './rng';

/** Words too generic to signal that a question is about a given condition. */
const RELEVANCE_STOPWORDS = new Set([
  'acute', 'chronic', 'severe', 'syndrome', 'disease', 'disorder', 'with',
  'and', 'the', 'patient', 'management', 'treatment', 'initial', 'immediate',
  'first', 'best', 'most', 'following', 'which', 'what', 'this', 'that',
  'from', 'into', 'after', 'before', 'during', 'prior', 'given', 'shows',
]);

/**
 * Words that appear inside condition names but are far too common in clinical
 * text to prove a question is about that condition. "Anterior" pulled a tension
 * pneumothorax question into a STEMI case ("anterior axillary line"), and
 * "diabetic" pulled a colistin question into DKA ("58-year-old diabetic
 * female"). These count for a little, never enough on their own.
 */
const WEAK_CONDITION_TERMS = new Set([
  'anterior', 'posterior', 'lateral', 'medial', 'inferior', 'superior', 'wall',
  'diabetic', 'female', 'male', 'adult', 'child', 'septic', 'hypovolemic',
  'bleed', 'bleeding', 'pain', 'fever', 'level', 'blood', 'post', 'territory',
]);

/** Whole-word test: "tension" must not match inside "hypotension". */
const mentions = (haystack: string, term: string) =>
  new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(haystack);

const significantTerms = (text: string): string[] =>
  (text || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 3 && !RELEVANCE_STOPWORDS.has(w));

/**
 * A question must share at least one diagnosis-level word with the condition.
 * Context and body-system overlap alone are not enough — that let "antimicrobial"
 * in a meningitis milestone pull in a urosepsis colistin question.
 */
export const MIN_CONDITION_MATCH = 3;

/**
 * How much a question is actually about this patient's problem.
 *
 * Diagnosis words from the scaffold's condition are weighted heavily; words
 * from the milestone's own clinical context and a matching body system add
 * smaller amounts. Metadata alone (same subject, same role tag) can never
 * clear MIN_RELEVANCE on its own — that was the old behaviour and it is what
 * produced cardiology questions in a meningitis case.
 */
export function relevanceScore(
  pyq: PYQItem,
  scaffold: CaseScaffold,
  milestone: CaseScaffold['gateMilestones'][number]
): { condition: number; total: number } {
  const haystack = [
    pyq.stem,
    pyq.topic,
    pyq.conceptTested,
    pyq.system,
    pyq.explanation,
    Object.values(pyq.options || {}).join(' '),
  ]
    .join(' ')
    .toLowerCase();

  let condition = 0;
  for (const t of new Set(significantTerms(scaffold.conditionName))) {
    if (mentions(haystack, t)) condition += WEAK_CONDITION_TERMS.has(t) ? 1 : 3;
  }

  let total = condition;
  for (const t of new Set(significantTerms(milestone.patientContext))) {
    if (mentions(haystack, t)) total += 1;
  }
  if (pyq.system && scaffold.system && pyq.system.toLowerCase() === scaffold.system.toLowerCase()) {
    total += 2;
  }
  return { condition, total };
}

/**
 * Binds an authored CaseScaffold with real PYQs from the QBank index
 * to create an offline, deterministic, fully playable CaseSession.
 */
export function buildCaseSessionFromScaffold(
  pyqIndex: PYQItem[],
  options: {
    scaffoldId?: string;
    subject?: string;
    mode?: CaseMode;
    seed?: string;
    missedQIDs?: string[];
  } = {}
): CaseSession {
  const seed = options.seed || `SEED-${Math.floor(100000 + Math.random() * 900000)}`;
  const prng = createPRNG(seed);
  const mode = options.mode || 'standard';

  // Select Scaffold
  let availableScaffolds = CASE_SCAFFOLDS;
  if (options.subject && options.subject !== 'All') {
    const subjectScaffolds = CASE_SCAFFOLDS.filter(
      (s) => s.subject.toLowerCase() === options.subject!.toLowerCase()
    );
    if (subjectScaffolds.length > 0) availableScaffolds = subjectScaffolds;
  }

  let selectedScaffold: CaseScaffold;
  if (options.scaffoldId) {
    selectedScaffold =
      CASE_SCAFFOLDS.find((s) => s.id === options.scaffoldId) || availableScaffolds[0];
  } else {
    const scaffoldIndex = Math.floor(prng() * availableScaffolds.length);
    selectedScaffold = availableScaffolds[scaffoldIndex];
  }

  // Filter valid PYQs (must have known answer)
  const validPYQs = pyqIndex.filter(
    (q) => q.correctAnswer !== 'ANSWER-NOT-IN-SOURCE' && !q.isDraft
  );

  // Weakness mode priority
  const missedQIDSet = new Set(options.missedQIDs || []);

  // Bind PYQs to scaffold milestones
  const decisionGates: DecisionGate[] = [];
  const maxGates = mode === 'rapid' ? 3 : 5;
  const usedQIDs = new Set<string>();

  selectedScaffold.gateMilestones.forEach((milestone, idx) => {
    if (decisionGates.length >= maxGates) return;

    // A gate must be ABOUT this patient. Previously any question could be bound
    // to any milestone — a meningitis case asked about STEMI thrombolysis and
    // post-splenectomy vaccination while the surrounding text insisted you were
    // treating meningitis. Require a topical match, and if none exists leave the
    // milestone unbound rather than inventing a connection.
    const scored = validPYQs
      // A question already used in this case must not appear again — repeating
      // the same stem at five consecutive decisions is worse than having fewer.
      .filter((q) => !usedQIDs.has(q.qid))
      .map((q) => ({ q, ...relevanceScore(q, selectedScaffold, milestone) }))
      .filter((c) => c.condition >= MIN_CONDITION_MATCH);

    if (scored.length === 0) return;

    // Prefer questions that also sit at the right point in the clinical arc.
    const roleMatched = scored.filter((c) => c.q.roleTag === milestone.roleTag);
    let pool = roleMatched.length > 0 ? roleMatched : scored;

    if (mode === 'weakness' && pool.some((c) => missedQIDSet.has(c.q.qid))) {
      pool = pool.filter((c) => missedQIDSet.has(c.q.qid));
    }

    // Among the relevant ones, favour the most relevant.
    const best = Math.max(...pool.map((c) => c.total));
    const top = pool.filter((c) => c.total >= best * 0.75);

    {
      const chosenPYQ = top[Math.floor(prng() * top.length)].q;
      usedQIDs.add(chosenPYQ.qid);

      // Shuffle options to prevent positional bias
      const { shuffledOptions, newCorrectAnswer } = shufflePYQOptions(
        chosenPYQ.options,
        chosenPYQ.correctAnswer,
        prng
      );

      const boundPYQ: PYQItem = {
        ...chosenPYQ,
        options: shuffledOptions,
        correctAnswer: newCorrectAnswer,
      };

      decisionGates.push({
        id: `gate_${idx + 1}`,
        pyq: boundPYQ,
        triggerTurnIndex: (idx + 1) * 3, // Milestones trigger after turn progression
        patientContext: milestone.patientContext,
        consequenceMessage: '',
      });
    }
  });

  // Pick 2 Incidental Findings from scaffold pool
  const incidentalPool = [...selectedScaffold.incidentalPool];
  const incidentalFindings: IncidentalFinding[] = [];
  while (incidentalFindings.length < 2 && incidentalPool.length > 0) {
    const incIdx = Math.floor(prng() * incidentalPool.length);
    incidentalFindings.push({ ...incidentalPool.splice(incIdx, 1)[0] });
  }

  const initialSimTime = { day: 1, hour: 9, minute: 0 }; // 09:00 Day 1

  const session: CaseSession = {
    id: `session_${Date.now()}_${Math.floor(prng() * 1000)}`,
    seed,
    scaffoldId: selectedScaffold.id,
    title: selectedScaffold.title,
    mode,
    subject: selectedScaffold.subject,
    patient: {
      id: `pt_${Date.now()}`,
      name: selectedScaffold.demographics.name,
      age: selectedScaffold.demographics.age,
      gender: selectedScaffold.demographics.gender,
      chiefComplaint: selectedScaffold.openingVignette, // Vignette DOES NOT disclose diagnosis name!
      setting: selectedScaffold.demographics.setting,
      initialVitals: { ...selectedScaffold.initialVitals },
      currentVitals: { ...selectedScaffold.initialVitals },
      diagnosis: selectedScaffold.conditionName,
      clinchingClue: selectedScaffold.clinchingClue,
      clinchingClueTime: 'Day 1, 09:15',
    },
    currentLocation: selectedScaffold.demographics.setting,
    simTime: initialSimTime,
    turns: [
      {
        turnIndex: 1,
        simTime: initialSimTime,
        location: selectedScaffold.demographics.setting,
        whatHappened: `Patient ${selectedScaffold.demographics.name} presented to ${selectedScaffold.demographics.setting}. Triage vitals recorded.`,
        vitals: { ...selectedScaffold.initialVitals },
        newResults: [],
      },
    ],
    pendingOrders: [],
    completedOrders: [],
    historyLog: [],
    examLog: [],
    decisionGates,
    currentGateIndex: 0,
    incidentalFindings,
    status: 'active',
    blindMode: mode === 'blind',
  };

  return session;
}
