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

  selectedScaffold.gateMilestones.forEach((milestone, idx) => {
    if (decisionGates.length >= maxGates) return;

    // Find candidate PYQs matching roleTag or subject/system
    let candidates = validPYQs.filter((q) => q.roleTag === milestone.roleTag);
    if (mode === 'weakness' && candidates.some((q) => missedQIDSet.has(q.qid))) {
      candidates = candidates.filter((q) => missedQIDSet.has(q.qid));
    }

    if (candidates.length === 0) {
      candidates = validPYQs.filter((q) => q.subject === selectedScaffold.subject);
    }
    if (candidates.length === 0) {
      candidates = validPYQs;
    }

    if (candidates.length > 0) {
      const chosenPYQ = candidates[Math.floor(prng() * candidates.length)];

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
