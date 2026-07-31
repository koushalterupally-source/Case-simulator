import { parseRawQBankTextOffline } from '../src/utils/qbankParser';
import { addMinutesToSimTime, processTurnOffline, generateScorecard } from '../src/utils/ccsEngine';
import { buildCaseSessionFromScaffold } from '../src/utils/caseBinder';
import { exportQBankToJSON, importQBankFromJSON } from '../src/utils/qbankParser';
import { DEFAULT_PYQ_INDEX } from '../src/data/defaultQBank';
import { CASE_SCAFFOLDS } from '../src/data/cases/scaffolds';
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

  const session = buildCaseSessionFromScaffold(mockPyqs, { mode: 'standard', subject: 'Medicine' });
  assert(session.decisionGates.length > 0, 'Decision gates bound from scaffolds & PYQ index');

  const gate0 = session.decisionGates[0];
  assert(gate0.userAnswer === undefined, 'Uncommitted gate has undefined userAnswer');

  // Test standard grading via processTurnOffline
  const targetAnswer = gate0.pyq.correctAnswer;
  const updatedSess = processTurnOffline(session, undefined, targetAnswer, 0);
  assert(updatedSess.decisionGates[0].isCorrect === true, `Standard gate answer "${targetAnswer}" graded correct`);
  assert(updatedSess.decisionGates[0].userAnswer === targetAnswer, 'User answer recorded against gate 0');

  // Test blind mode synonym matching
  const blindSess = buildCaseSessionFromScaffold(mockPyqs, { mode: 'blind', subject: 'Medicine' });
  const blindUpdated = processTurnOffline(blindSess, undefined, 'aspirin and plavix', 0);
  assert(blindUpdated.decisionGates[0].isCorrect === true, 'Blind mode synonym match "aspirin and plavix" graded correct');

  // 4. Answer Leak Protection Test
  console.log('\n--- Test Suite 4: Answer Leak Protection ---');
  const uncommittedGate = session.decisionGates[0];
  assert(uncommittedGate.isCorrect === undefined, 'Uncommitted gate does NOT expose correctness');
  assert(uncommittedGate.userAnswer === undefined, 'Uncommitted gate does NOT expose user answer');

  // Check that no gate milestone in any scaffold contains its conditionName keywords in patientContext
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
  assert(!leakFound, 'No gate patientContext names its own diagnosis');

  // 5. JSON Import & Export Test
  console.log('\n--- Test Suite 5: Import & Export Integrity ---');
  const exported = exportQBankToJSON(DEFAULT_PYQ_INDEX);
  const reimported = importQBankFromJSON(exported);
  assert(reimported.length === DEFAULT_PYQ_INDEX.length, 'Reimported QBank matches exported item count');

  console.log(`\n🎉 Verification Suite Complete: ${passed} Passed, ${failed} Failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
