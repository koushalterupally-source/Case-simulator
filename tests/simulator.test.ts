import { parseRawQBankTextOffline } from '../src/utils/qbankParser';
import {
  addMinutesToSimTime,
  processTurnOffline,
  generateScorecard,
  splitOrders,
  inferOrderCategory,
  simTimeToMinutes,
  formatSimTime,
} from '../src/utils/ccsEngine';
import { buildCaseSessionFromScaffold } from '../src/utils/caseBinder';
import { exportQBankToJSON, importQBankFromJSON } from '../src/utils/qbankParser';
import { DEFAULT_PYQ_INDEX } from '../src/data/defaultQBank';
import { CASE_SCAFFOLDS } from '../src/data/cases/scaffolds';
import { buildQuestionLedCase, buildIdf } from '../src/utils/questionLedCase';
import {
  rankForXp,
  xpForGate,
  computeGameStats,
  hrSeverity,
  spo2Severity,
  rrSeverity,
  bpSeverity,
  tempSeverity,
  grbsSeverity,
  instabilityScore,
  stabilityLabel,
} from '../src/utils/gamification';
import { CaseSession, PYQItem } from '../src/types';

function runTests() {
  console.log('🚀 Running Medtrix PYQ CCS Engine Verification Suite...\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition: boolean, testName: string) => {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  };

  // 1. Sim-clock arithmetic test (midnight wrap and past day 10)
  console.log('--- Test Suite 1: Sim-Clock Arithmetic ---');
  const startClock = { day: 1, hour: 23, minute: 50 };
  const endClock = addMinutesToSimTime(startClock, 20);
  assert(endClock.day === 2 && endClock.hour === 0 && endClock.minute === 10, 'Midnight rollover (23:50 + 20m -> Day 2 00:10)');

  const day10Clock = { day: 10, hour: 12, minute: 0 };
  const pastDay10Clock = addMinutesToSimTime(day10Clock, 1440); // +24h
  assert(pastDay10Clock.day === 11 && pastDay10Clock.hour === 12 && pastDay10Clock.minute === 0, 'Multi-day progression past Day 10');

  // 2. QBank Parser Tests
  console.log('\n--- Test Suite 2: QBank Index Parser ---');
  const sampleRawText = `
Q1. A 45-year-old male presents with severe epigastric pain radiating to back. Lipase is 1200 U/L. What is the initial best fluid?
(A) 5% Dextrose
(B) Normal Saline (0.9% NaCl)
(C) Hypertonic Saline
(D) Colloid
Ans: B
Concept: Acute pancreatitis resuscitation with normal saline.
  `;

  const parsed = parseRawQBankTextOffline(sampleRawText);
  assert(parsed.parsedItems.length === 1, 'Parses single question block');
  assert(parsed.parsedItems[0].correctAnswer === 'B', 'Extracts correct answer choice B');
  assert(parsed.parsedItems[0].options.B.includes('Normal Saline'), 'Extracts Option B text cleanly');

  // Missing answer handling test
  const noAnsText = `
Q2. A 30y/o female has hyperthyroidism. Which drug is preferred in 1st trimester?
(A) Methimazole
(B) PTU
(C) Carbimazole
(D) Radioactive Iodine
  `;
  const parsedNoAns = parseRawQBankTextOffline(noAnsText);
  assert(parsedNoAns.parsedItems[0].correctAnswer === 'ANSWER-NOT-IN-SOURCE', 'Correctly flags ANSWER-NOT-IN-SOURCE when answer is missing');
  assert(parsedNoAns.parsedItems[0].isDraft === true, 'Sets isDraft = true for unverified answer source');

  // 3. Gate Binding & Grading (Standard & Blind mode)
  console.log('\n--- Test Suite 3: Gate Binding & Grading ---');
  const mockPyqs: PYQItem[] = [
    {
      qid: 'NEETPG-2023-001',
      exam: 'NEET-PG',
      year: 2023,
      subject: 'Medicine',
      system: 'Cardiology',
      topic: 'STEMI',
      stem: 'Patient with acute chest pain, ST elevation in II, III, aVF.',
      options: { A: 'Aspirin & Clopidogrel', B: 'Metoprolol', C: 'Digoxin', D: 'Amlodipine' },
      correctAnswer: 'A',
      conceptTested: 'Dual antiplatelet therapy in acute MI',
      roleTag: 'MANAGEMENT',
    },
  ];

  // Pin the scaffold: gates now require the question to be topically about the
  // patient's condition, so a STEMI question only binds into a STEMI case.
  const session = buildCaseSessionFromScaffold(mockPyqs, { mode: 'standard', scaffoldId: 'scaffold_stemi' });
  assert(session.decisionGates.length > 0, 'Decision gates bound from scaffolds & PYQ index');

  // And the inverse: an unrelated case must NOT bind this question at all.
  const unrelated = buildCaseSessionFromScaffold(mockPyqs, { mode: 'standard', scaffoldId: 'scaffold_meningitis' });
  assert(unrelated.decisionGates.length === 0, 'A STEMI question does not bind into a meningitis case');

  // No case may present the same question twice.
  const qids = session.decisionGates.map((g) => g.pyq.qid);
  assert(qids.length === new Set(qids).size, 'No question repeats within a single case');

  const gate0 = session.decisionGates[0];
  assert(gate0.userAnswer === undefined, 'Uncommitted gate has undefined userAnswer');

  // Test standard grading via processTurnOffline
  const targetAnswer = gate0.pyq.correctAnswer;
  const updatedSess = processTurnOffline(session, undefined, targetAnswer, 0);
  assert(updatedSess.decisionGates[0].isCorrect === true, `Standard gate answer "${targetAnswer}" graded correct`);
  assert(updatedSess.decisionGates[0].userAnswer === targetAnswer, 'User answer recorded against gate 0');

  // Test blind mode synonym matching
  const blindSess = buildCaseSessionFromScaffold(mockPyqs, { mode: 'blind', scaffoldId: 'scaffold_stemi' });
  const blindUpdated = processTurnOffline(blindSess, undefined, 'aspirin and plavix', 0);
  assert(blindUpdated.decisionGates[0].isCorrect === true, 'Blind mode synonym match "aspirin and plavix" graded correct');

  // 4. Answer Leak Protection Test
  console.log('\n--- Test Suite 4: Answer Leak Protection ---');
  const uncommittedGate = session.decisionGates[0];
  assert(uncommittedGate.isCorrect === undefined, 'Uncommitted gate does NOT expose correctness');
  assert(uncommittedGate.userAnswer === undefined, 'Uncommitted gate does NOT expose user answer');

  // 4b. Gate context must never name its own diagnosis. It is rendered BEFORE the user commits —
  // in the pre-gate banner, the gates sidebar and the modal — so leaking the condition name there
  // hands over the answer for free.
  // Words that describe what the doctor can already observe (presenting complaint, established
  // history) rather than the diagnosis itself. Mentioning these in gate context is legitimate.
  const STOPWORDS = new Set([
    'acute', 'severe', 'chronic', 'syndrome', 'disease', 'shock', 'injury',
    'failure', 'infection', 'bleed', 'bleeding', 'upper', 'lower', 'post',
    'with', 'and', 'the',
  ]);
  let leaks = 0;
  for (const scaffold of CASE_SCAFFOLDS) {
    const terms = scaffold.conditionName
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((w) => w.length > 3 && !STOPWORDS.has(w));
    for (const milestone of scaffold.gateMilestones) {
      const ctx = milestone.patientContext.toLowerCase();
      for (const term of terms) {
        // Match on word boundaries, not substrings: "tension pneumothorax" must not
        // fire on the word "hypotension", which is a sign the doctor can observe.
        if (new RegExp(`\\b${term}\\b`).test(ctx)) {
          console.error(`   ↳ LEAK in ${scaffold.id}: "${term}" appears in patientContext`);
          leaks++;
        }
      }
    }
  }
  assert(leaks === 0, 'No gate patientContext names its own diagnosis');

  // 4c. Gamification maths
  console.log('\n--- Test Suite 4c: Gamification ---');
  assert(rankForXp(0).id === 'intern', 'Zero XP is Intern');
  assert(rankForXp(250).id === 'resident', '250 XP is Resident');
  assert(rankForXp(99999).id === 'professor', 'Very high XP caps at Professor');
  assert(xpForGate(0) === 100, 'First correct gate is worth 100 XP');
  assert(xpForGate(2) === 150, 'Third consecutive correct gate carries a streak bonus');

  assert(hrSeverity(75) === 'normal', 'HR 75 is normal');
  assert(hrSeverity(115) === 'warning', 'HR 115 is a warning');
  assert(hrSeverity(140) === 'critical', 'HR 140 is critical');
  assert(spo2Severity(88) === 'critical', 'SpO2 88% is critical');
  assert(bpSeverity('85/50') === 'critical', 'Systolic 85 is critical');
  assert(bpSeverity('120/80') === 'normal', 'BP 120/80 is normal');
  // Temperature must work in either unit, since scaffolds use both.
  assert(tempSeverity('39.8°C') === 'critical', '39.8 C is critical');
  assert(tempSeverity('103.6°F') === 'critical', '103.6 F is critical (converted)');
  assert(tempSeverity('37.0°C') === 'normal', '37.0 C is normal');

  const gamified = computeGameStats(session);
  assert(gamified.xp >= 0 && gamified.gatesTotal === session.decisionGates.length, 'Game stats derive from the session');
  assert(gamified.badges.length > 0, 'Badge list is produced');

  // Second, independent leak check using word boundaries rather than substrings.
  // The two catch different things; both must hold.
  let leakFound = false;
  CASE_SCAFFOLDS.forEach((scaffold) => {
    const condName = scaffold.conditionName.toLowerCase();
    const keywords = condName
      .split(/[\s\(\)\/]+/)
      .map((w) => w.trim())
      .filter((w) => w.length > 3 && !['acute', 'wall', 'severe', 'with', 'shock', 'young', 'post', 'type', 'gastroenterology'].includes(w));

    scaffold.gateMilestones.forEach((gate, gIdx) => {
      const ctx = gate.patientContext.toLowerCase();
      keywords.forEach((kw) => {
        const regex = new RegExp(`\\b${kw}\\b`, 'i');
        if (regex.test(ctx)) {
          leakFound = true;
          console.error(`Leak detected in ${scaffold.id} gate ${gIdx}: keyword "${kw}" found in "${gate.patientContext}"`);
        }
      });
    });
  });
  assert(!leakFound, 'No gate patientContext names its diagnosis (word-boundary check)');

  // 4d. Order sheet: multi-order commands
  console.log('\n--- Test Suite 4d: Order Entry ---');
  assert(splitOrders('CBC, ABG, LFT').length === 3, 'Splits a comma-separated order list');
  assert(
    splitOrders('RFT / KFT (urea, creatinine), ABG').length === 2,
    'Does not split on a comma inside brackets'
  );
  assert(
    splitOrders('RFT / KFT (urea, creatinine), ABG')[0] === 'RFT / KFT (urea, creatinine)',
    'Keeps the bracketed order name intact'
  );
  assert(splitOrders('  ECG  ').length === 1, 'Trims a single order');
  assert(inferOrderCategory('Chest X-ray portable') === 'imaging', 'X-ray is imaging');
  assert(inferOrderCategory('12-lead ECG') === 'monitoring', 'ECG is monitoring');
  assert(inferOrderCategory('Normal saline 0.9% 500 mL bolus') === 'drugs', 'Saline bolus is a drug/fluid');
  assert(inferOrderCategory('Cardiology consult') === 'consults', 'Consult is a consult');
  assert(inferOrderCategory('Endotracheal intubation') === 'procedures', 'Intubation is a procedure');
  assert(inferOrderCategory('Serum ferritin') === 'labs', 'Ferritin is a lab');

  const orderSess = processTurnOffline(session, 'order: CBC / Hemogram, ABG, Chest X-ray portable');
  assert(orderSess.pendingOrders.length === 3, 'Three separate orders are queued from one command');

  // 4e. Question-led cases — the whole bank, not just the 12 authored conditions
  console.log('\n--- Test Suite 4e: Question-Led Cases ---');
  const bank: PYQItem[] = [];
  for (let i = 0; i < 40; i++) {
    bank.push({
      qid: `Q${i}`, exam: 'NEET-PG', year: 2023,
      subject: i % 2 ? 'Medicine' : 'Surgery',
      system: i % 2 ? 'Cardiology' : 'Gastroenterology',
      topic: '',
      // Half share a rare term, half share nothing distinctive.
      // Distinctive shared term, but genuinely different questions — near
      // identical phrasings are rejected as duplicates, by design.
      stem: i % 2
        ? [
            'Which enzyme is deficient in pheochromocytoma workup?',
            'Preferred imaging modality for pheochromocytoma localisation?',
            'Preoperative blockade of choice before pheochromocytoma surgery?',
            'Which syndrome is pheochromocytoma associated with inheritance?',
            'Urinary metabolite measured when pheochromocytoma suspected?',
          ][Math.floor(i / 2) % 5] + ` (variant ${i})`
        : `A patient has a common finding number ${i}. What next?`,
      options: { A: `alpha ${i}`, B: `beta ${i}`, C: `gamma ${i}`, D: `delta ${i}` },
      correctAnswer: 'A', conceptTested: '', roleTag: 'DIAGNOSIS',
    } as PYQItem);
  }
  const idf = buildIdf(bank);
  const qCase = buildQuestionLedCase(bank, { seed: 'T1', idf, seedQid: 'Q1' });
  assert(qCase.isQuestionLed === true, 'Question-led case is flagged as such');
  assert(qCase.decisionGates.length > 1, 'Question-led case gathers related questions');
  assert(
    qCase.decisionGates.every((g) => /pheochromocytoma/i.test(g.pyq.stem)),
    'Only questions sharing distinctive vocabulary are gathered'
  );
  const qlQids = qCase.decisionGates.map((g) => g.pyq.qid);
  assert(qlQids.length === new Set(qlQids).size, 'Question-led case never repeats a question');
  assert(
    qCase.decisionGates.every((g) => g.userAnswer === undefined),
    'Question-led gates start uncommitted'
  );
  // A question-led case must not pretend to be a simulated patient.
  assert(qCase.incidentalFindings.length === 0, 'Question-led case plants no fake incidental findings');
  assert(qCase.patient.diagnosis === '', 'Question-led case claims no diagnosis');

  // 5. JSON Import & Export Test
  console.log('\n--- Test Suite 5: Import & Export Integrity ---');
  const exported = exportQBankToJSON(DEFAULT_PYQ_INDEX);
  const reimported = importQBankFromJSON(exported);
  assert(reimported.length === DEFAULT_PYQ_INDEX.length, 'Reimported QBank matches exported item count');

  // 6. Vitals Decay & Trajectory Dynamics
  console.log('\n--- Test Suite 6: Vitals Decay & Trajectory Dynamics ---');
  const stemiSession = buildCaseSessionFromScaffold(DEFAULT_PYQ_INDEX, { scaffoldId: 'scaffold_stemi', mode: 'standard' });
  const initialHr = stemiSession.patient.currentVitals.hr;
  const initialSpo2 = stemiSession.patient.currentVitals.spo2;

  // Advance clock past critical milestone (STEMI DAPT window is 20 min) without ordering DAPT
  const delayedSession = processTurnOffline(stemiSession, 'advance 45 minutes');
  assert(delayedSession.patient.currentVitals.hr > initialHr, 'Heart rate deteriorates (climbs) when critical intervention is overdue');
  assert(delayedSession.patient.currentVitals.spo2 < initialSpo2, 'Oxygen saturation deteriorates (falls) when critical intervention is overdue');
  assert(delayedSession.turns[delayedSession.turns.length - 1].whatHappened.includes('deteriorating'), 'Deterioration warning added to turn narrative');

  // Ordering critical intervention improves vitals
  const treatedSession = processTurnOffline(delayedSession, 'order: Aspirin 325 mg chewed, Clopidogrel 300 mg loading');
  assert(treatedSession.patient.currentVitals.hr < delayedSession.patient.currentVitals.hr, 'Heart rate recovers after critical intervention');
  assert(treatedSession.patient.currentVitals.spo2 > delayedSession.patient.currentVitals.spo2, 'Oxygenation recovers after critical intervention');

  // Question-led cases must NEVER suffer trajectory decay
  const qLedDecayCheck = processTurnOffline(qCase, 'advance 120 minutes');
  assert(qLedDecayCheck.patient.currentVitals.hr === 0, 'Question-led set maintains 0 HR (no phantom deterioration)');
  assert(qLedDecayCheck.patient.currentVitals.spo2 === 0, 'Question-led set maintains 0 SpO2 (no phantom decay)');
  assert(!qLedDecayCheck.turns[qLedDecayCheck.turns.length - 1].whatHappened.includes('deteriorating'), 'Question-led case emits no deterioration warning');

  // 7. Order Result Turnaround & Delivery Pipeline
  console.log('\n--- Test Suite 7: Order Result Turnaround & Delivery Pipeline ---');
  const freshSession = buildCaseSessionFromScaffold(DEFAULT_PYQ_INDEX, { scaffoldId: 'scaffold_stemi', mode: 'standard' });
  const withOrders = processTurnOffline(freshSession, 'order: 12-lead ECG, STAT Troponin I, Chest X-ray PA');
  // Order entry for 3 items takes 5 minutes (09:00 -> 09:05), so 5-minute ECG delivers at end of turn 1
  assert(withOrders.completedOrders.some((o) => /ecg/i.test(o.orderName)), '5-minute ECG delivers once sim clock reaches 09:05');
  assert(withOrders.pendingOrders.length === 2, 'Remaining 2 slower orders (Troponin 30m, CXR 20m) remain queued in pendingOrders');

  // Advance time by 15 mins (09:05 -> 09:20): CXR (20m turnaround, ready 09:20) delivers
  const after15Mins = processTurnOffline(withOrders, 'advance 15 minutes');
  const cxrDone = after15Mins.completedOrders.some((o) => /cxr|chest x-ray/i.test(o.orderName));
  assert(cxrDone, 'Medium turnaround order (CXR PA, 20m) moves to completedOrders at 09:20');
  assert(after15Mins.pendingOrders.some((o) => /troponin/i.test(o.orderName)), '30-minute Troponin remains pending at 09:20');

  // Advancing time past 09:30 delivers Troponin
  const after30Mins = processTurnOffline(after15Mins, 'advance 15 minutes');
  assert(after30Mins.pendingOrders.length === 0, 'All pending orders delivered after sufficient turnaround (09:35 >= 09:30)');
  assert(after30Mins.completedOrders.length === 3, 'All 3 orders now in completedOrders');
  assert(after30Mins.turns[after30Mins.turns.length - 1].newResults.length > 0, 'Turn recorded delivered results');

  // Incidental finding discovery via investigation
  const incBefore = freshSession.incidentalFindings[0]?.status;
  const withImaging = processTurnOffline(freshSession, 'order: USG Abdomen & Pelvis, Chest X-ray portable');
  const incAfter = withImaging.incidentalFindings.some((i) => i.status === 'noticed_addressed');
  assert(incBefore === 'unnoticed' && incAfter, 'Ordering relevant imaging discovers and addresses incidental finding');

  // 8. Scorecard Generation & Grading
  console.log('\n--- Test Suite 8: Scorecard Generation & Grading ---');
  const scoredSession = buildCaseSessionFromScaffold(DEFAULT_PYQ_INDEX, { scaffoldId: 'scaffold_stemi', mode: 'standard' });
  // Answer all gates correctly
  let fullSession = scoredSession;
  for (let g = 0; g < fullSession.decisionGates.length; g++) {
    const ans = fullSession.decisionGates[g].pyq.correctAnswer;
    fullSession = processTurnOffline(fullSession, undefined, ans, g);
  }
  const perfectCard = generateScorecard(fullSession);
  assert(perfectCard.pyqScore.percentage === 100, 'All correct gates yields 100% PYQ score');
  assert(perfectCard.overallGrade === 'S' || perfectCard.overallGrade === 'A', 'Perfect gate run earns high grade (S/A)');
  assert(perfectCard.finalDiagnosis.includes('STEMI'), 'Scorecard includes correct final diagnosis');
  assert(perfectCard.clinchingClue.length > 0, 'Scorecard includes clinching clue');

  // Question-led scorecard
  let qLedRun = qCase;
  for (let g = 0; g < qLedRun.decisionGates.length; g++) {
    const ans = qLedRun.decisionGates[g].pyq.correctAnswer;
    qLedRun = processTurnOffline(qLedRun, undefined, ans, g);
  }
  const qScorecard = generateScorecard(qLedRun);
  assert(qScorecard.pyqScore.percentage === 100, 'Question-led scorecard scores 100% for all correct');
  assert(qScorecard.overOrderingList.length === 0, 'Question-led scorecard has zero unmodeled order penalties');
  assert(qScorecard.criticalDelays.length === 0, 'Question-led scorecard has zero critical delays');
  assert(qScorecard.overallScore === 100, 'Question-led overallScore matches pyq percentage');

  // 9. Simulation Control Commands & State Transitions
  console.log('\n--- Test Suite 9: Simulation Control Commands & State Transitions ---');
  const ctrlSession = buildCaseSessionFromScaffold(DEFAULT_PYQ_INDEX, { scaffoldId: 'scaffold_stemi', mode: 'standard' });
  
  // Pause command
  const paused = processTurnOffline(ctrlSession, 'pause');
  assert(paused.status === 'paused', 'Command "pause" sets session status to paused');

  // Transfer command
  const transferred = processTurnOffline(ctrlSession, 'move to ICU');
  assert(transferred.currentLocation === 'ICU', 'Command "move to ICU" updates currentLocation to ICU');

  // End case command
  const ended = processTurnOffline(ctrlSession, 'end case');
  assert(ended.status === 'completed', 'Command "end case" sets session status to completed');
  assert(ended.scorecard !== undefined, 'Command "end case" generates scorecard automatically');

  // History and Physical Exam commands
  const withHx = processTurnOffline(ctrlSession, 'hx: allergies');
  assert(withHx.historyLog.length === 1, 'Command "hx: allergies" appends to historyLog');
  const withPe = processTurnOffline(ctrlSession, 'pe: cvs');
  assert(withPe.examLog.length === 1, 'Command "pe: cvs" appends to examLog');

  // 10. Gamification Edge Cases & Stability
  console.log('\n--- Test Suite 10: Gamification Edge Cases & Stability ---');
  assert(instabilityScore(qCase) === 0, 'Question-led case instabilityScore is 0 (Stable)');
  assert(stabilityLabel(0).label === 'STABLE', 'Score 0 produces STABLE stability label');
  assert(stabilityLabel(6).label === 'CRITICAL', 'Score 6 produces CRITICAL stability label');
  assert(stabilityLabel(3).label === 'UNSTABLE', 'Score 3 produces UNSTABLE stability label');
  assert(stabilityLabel(1).label === 'GUARDED', 'Score 1 produces GUARDED stability label');
  assert(hrSeverity(0) === 'normal', '0 HR returns normal');
  assert(spo2Severity(0) === 'normal', '0 SpO2 returns normal');
  assert(rrSeverity(0) === 'normal', '0 RR returns normal');
  assert(grbsSeverity(0) === 'normal', '0 GRBS returns normal');

  console.log(`\n🎉 Verification Suite Complete: ${passed} Passed, ${failed} Failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
