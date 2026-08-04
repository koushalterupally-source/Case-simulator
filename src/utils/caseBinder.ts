import {
  CaseSession,
  CaseMode,
  PYQItem,
  DecisionGate,
  IncidentalFinding,
  CaseScaffold,
} from '../types';
import { CASE_SCAFFOLDS } from '../data/cases/scaffolds';
import { CONDITION_VOCABULARY, MAX_ASSOCIATED_SCORE } from '../data/conditionVocabulary';
import { createPRNG, shufflePYQOptions } from './rng';
import { cleanStem, isUsableAsGate } from './questionQuality';

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
  // "shock" names a presentation, not a diagnosis. Left strong, it was the only
  // term binding both the malnutrition and the urosepsis case, so each drew
  // from the same pool of generic shock questions instead of questions about
  // its own condition. Those two cases now bind on their vocabulary below.
  'shock',
]);

/**
 * Whole-word test: "tension" must not match inside "hypotension".
 *
 * Multi-word terms match across any run of whitespace, so "myocardial
 * infarction" still fires on "myocardial   infarction" or a line break.
 */
const mentions = (haystack: string, term: string) =>
  new RegExp(
    `\\b${term
      .toLowerCase()
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\s+/g, '\\s+')}\\b`
  ).test(haystack);

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
  // What the question is *about* — its stem and its own metadata.
  const asking = [pyq.stem, pyq.topic, pyq.conceptTested, pyq.system, pyq.explanation]
    .join(' ')
    .toLowerCase();
  // The answer choices, which are a much weaker signal. Three of the four are
  // wrong by construction, so a condition named there is usually a distractor:
  // "Sympathetic ophthalmia is a consequence of which of the following?" lists
  // "Urinary tract infection" as option D, and on the strength of that alone it
  // was being presented as a decision in a urosepsis case. Naming a condition
  // in a distractor is evidence the question is *not* about it.
  const choices = Object.values(pyq.options || {})
    .join(' ')
    .toLowerCase();
  const haystack = `${asking} ${choices}`;

  // Naming the diagnosis in the question itself is the only thing that proves a
  // question belongs in this case. Everything else — a weak word from the
  // condition's name, the diagnosis turning up among the answer choices, an
  // associated drug or test — is corroboration, and is pooled separately.
  let diagnostic = 0;
  let support = 0;

  const score = (term: string, isDiagnosisLevel: boolean) => {
    if (mentions(asking, term)) {
      if (isDiagnosisLevel) diagnostic += 3;
      else support += 1;
    } else if (mentions(choices, term)) {
      support += 1;
    }
  };

  for (const t of new Set(significantTerms(scaffold.conditionName))) {
    score(t, !WEAK_CONDITION_TERMS.has(t));
  }

  // The words the exam actually uses. A scaffold names its condition the way a
  // textbook chapter heading does; a question names it the way a clinician
  // writing an MCQ does, and the two often share no vocabulary at all.
  const vocab = CONDITION_VOCABULARY[scaffold.id];
  if (vocab) {
    for (const t of vocab.diagnosis) score(t, true);
    for (const t of vocab.associated) score(t, false);
  }

  // Corroboration is capped below the binding threshold, so it can rank a
  // question but never admit one on its own. Without this, "Urosepsis with
  // Septic Shock" bound on the words "septic" and "shock" plus a passing
  // mention of sepsis, and presented a pulmonary-capillary-wedge-pressure
  // question as a decision in a urinary sepsis case.
  const condition = diagnostic > 0 ? diagnostic + Math.min(support, MAX_ASSOCIATED_SCORE) : 0;

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

  // Filter to questions that can actually be answered at a gate. Beyond a known
  // answer this drops the ones that ask about a picture the app does not have —
  // those are unanswerable by construction, so binding one guarantees the user
  // guesses and is then marked wrong.
  const validPYQs = pyqIndex.filter(isUsableAsGate);

  // Weakness mode priority
  const missedQIDSet = new Set(options.missedQIDs || []);

  // Bind PYQs to scaffold milestones
  const decisionGates: DecisionGate[] = [];
  const maxGates = mode === 'rapid' ? 3 : 5;
  const usedQIDs = new Set<string>();
  // The bank holds 182 questions that duplicate another question's wording under
  // a different qid, so de-duplicating on qid alone was not enough: a STEMI case
  // asked "Pulsus paradoxus is seen in:" as decision 1 and again, verbatim, as
  // decision 2. Track the wording too.
  const usedStems = new Set<string>();
  const stemKey = (q: PYQItem) => cleanStem(q.stem).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

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
      .filter((q) => !usedQIDs.has(q.qid) && !usedStems.has(stemKey(q)))
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
      usedStems.add(stemKey(chosenPYQ));

      // Shuffle options to prevent positional bias
      const { shuffledOptions, newCorrectAnswer } = shufflePYQOptions(
        chosenPYQ.options,
        chosenPYQ.correctAnswer,
        prng
      );

      const boundPYQ: PYQItem = {
        ...chosenPYQ,
        // "(NEET PG 2019)" belongs in the item's exam/year fields, not in the
        // sentence the doctor is reading at the bedside.
        stem: cleanStem(chosenPYQ.stem),
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
