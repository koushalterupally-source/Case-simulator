import { parseRawQBankTextOffline } from '../src/utils/qbankParser';
import { addMinutesToSimTime, processTurnOffline, generateScorecard, splitOrders, inferOrderCategory } from '../src/utils/ccsEngine';
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
  bpSeverity,
  tempSeverity,
} from '../src/utils/gamification';
import { isImageDependent, isUsableAsGate, cleanStem } from '../src/utils/questionQuality';
import { CONDITION_VOCABULARY } from '../src/data/conditionVocabulary';
import { gateStatus } from '../src/components/simple/DecisionsPanel';
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

  // 4f. Question quality — what may never reach a decision gate
  console.log('\n--- Test Suite 4f: Question Quality ---');
  assert(isImageDependent('Identify the organism stained with India Ink stain?'), 'An "identify the..." question is image-dependent');
  assert(isImageDependent('The given chest X-ray is suggestive of:'), 'A question about a given X-ray is image-dependent');
  assert(!isImageDependent('What is the most sensitive marker for myocardial infarction?'), 'A plain text question is not image-dependent');
  assert(
    cleanStem('Immediate management of tension pneumothorax is? (NEET PG 2019)') ===
      'Immediate management of tension pneumothorax is?',
    'Exam provenance is stripped from the stem shown to the player'
  );
  assert(
    cleanStem('Identify the organism? (FMGE DECEMBER 2020)') === 'Identify the organism?',
    'Exam tag stripped regardless of exam name'
  );
  assert(
    cleanStem('What is seen in NEET syndrome?') === 'What is seen in NEET syndrome?',
    'A stem that merely contains an exam word is left alone'
  );

  const usable = (over: Partial<PYQItem>): PYQItem => ({
    qid: 'U1', exam: 'NEET-PG', year: 2023, subject: 'Medicine', system: 'Cardiology',
    topic: '', stem: 'What is the most specific marker for myocardial infarction?',
    options: { A: 'Troponin I', B: 'CK-MB', C: 'Myoglobin', D: 'LDH' },
    correctAnswer: 'A', conceptTested: '', roleTag: 'INVESTIGATION', ...over,
  } as PYQItem);
  assert(isUsableAsGate(usable({})), 'A complete four-option question is usable');
  assert(!isUsableAsGate(usable({ stem: 'Identify the organism from the image?' })), 'Image-dependent question is not usable as a gate');
  assert(!isUsableAsGate(usable({ stem: 'Shortest?' })), 'A fragment of a stem is not usable');
  assert(!isUsableAsGate(usable({ options: { A: 'Troponin', B: '', C: 'X', D: 'Y' } as PYQItem['options'] })), 'A blank option makes a question unusable');
  assert(!isUsableAsGate(usable({ correctAnswer: 'ANSWER-NOT-IN-SOURCE' })), 'A question with no known answer is not usable');

  // 4g. Gate binding must be about THIS patient — regressions that shipped
  console.log('\n--- Test Suite 4g: Gate Binding Fidelity ---');

  // The whole shipped bank contains the token "STEMI" zero times, so matching
  // on the scaffold's condition name alone bound nothing and the flagship
  // cardiology case opened with no decisions at all.
  const miPyqs: PYQItem[] = [
    {
      qid: 'MI-1', exam: 'NEET-PG', year: 2022, subject: 'Medicine', system: 'Cardiology',
      topic: 'cardiac markers',
      stem: 'What is the most sensitive and specific marker for myocardial infarction?',
      options: { A: 'Troponin I', B: 'CK-MB', C: 'Myoglobin', D: 'AST' },
      correctAnswer: 'A', conceptTested: '', roleTag: 'INVESTIGATION',
    } as PYQItem,
  ];
  const miCase = buildCaseSessionFromScaffold(miPyqs, { scaffoldId: 'scaffold_stemi' });
  assert(miCase.decisionGates.length > 0, 'A myocardial infarction question binds into the STEMI case');

  // A condition named only in a wrong answer is evidence AGAINST the question
  // being about it. "Sympathetic ophthalmia..." listed "Urinary tract
  // infection" as option D and was presented as a urosepsis decision.
  const distractorOnly: PYQItem[] = [
    {
      qid: 'DIST-1', exam: 'NEET-PG', year: 2021, subject: 'Ophthalmology', system: 'Ophthalmology',
      topic: 'ocular trauma',
      stem: 'Sympathetic ophthalmia is a consequence of which of the following?',
      options: { A: 'Penetrating ocular trauma', B: 'Blunt ocular trauma', C: 'Chemical injury', D: 'Urinary tract infection' },
      correctAnswer: 'A', conceptTested: '', roleTag: 'DIAGNOSIS',
    } as PYQItem,
  ];
  assert(
    buildCaseSessionFromScaffold(distractorOnly, { scaffoldId: 'scaffold_urosepsis' }).decisionGates.length === 0,
    'A condition named only in a distractor does not bind the question into that case'
  );

  // Two records, different qids, identical wording: de-duplicating on qid alone
  // let a case ask the same question twice in a row.
  const twinStem = 'Pulsus paradoxus with raised jugular venous pressure is characteristically seen in tension pneumothorax?';
  const twins: PYQItem[] = [1, 2, 3].map((n) => ({
    qid: `TWIN-${n}`, exam: 'NEET-PG', year: 2020, subject: 'Surgery', system: 'Trauma & Emergency',
    topic: 'pneumothorax', stem: twinStem,
    options: { A: 'True', B: 'False', C: 'Only if hypotensive', D: 'Only in children' },
    correctAnswer: 'A', conceptTested: '', roleTag: 'DIAGNOSIS',
  } as PYQItem));
  const twinCase = buildCaseSessionFromScaffold(twins, { scaffoldId: 'scaffold_pneumothorax' });
  assert(twinCase.decisionGates.length <= 1, 'The same question wording never appears twice in one case');

  // An unanswerable question must not be chosen even when it is topically perfect.
  const imageOnly: PYQItem[] = [
    {
      qid: 'IMG-1', exam: 'NEET-PG', year: 2021, subject: 'Surgery', system: 'Trauma & Emergency',
      topic: 'pneumothorax', stem: 'Identify the tension pneumothorax finding in the given chest X-ray?',
      options: { A: 'Tracheal deviation', B: 'Consolidation', C: 'Effusion', D: 'Cardiomegaly' },
      correctAnswer: 'A', conceptTested: '', roleTag: 'DIAGNOSIS',
    } as PYQItem,
  ];
  assert(
    buildCaseSessionFromScaffold(imageOnly, { scaffoldId: 'scaffold_pneumothorax' }).decisionGates.length === 0,
    'A question that needs a picture is never bound, however relevant it is'
  );

  // Every scaffold the vocabulary claims to describe must actually exist.
  const scaffoldIds = new Set(CASE_SCAFFOLDS.map((s) => s.id));
  assert(
    Object.keys(CONDITION_VOCABULARY).every((id) => scaffoldIds.has(id)),
    'Condition vocabulary refers only to real scaffolds'
  );

  // 4h. Blind mode must not award marks for a fragment
  console.log('\n--- Test Suite 4h: Blind Mode Grading ---');
  const blindPyq: PYQItem[] = [
    {
      qid: 'BL-1', exam: 'NEET-PG', year: 2022, subject: 'Surgery', system: 'Trauma & Emergency',
      topic: 'pneumothorax',
      stem: 'Immediate management of a tension pneumothorax in a hypotensive trauma patient?',
      options: { A: 'Needle decompression', B: 'Chest physiotherapy', C: 'Oral antibiotics', D: 'Observation alone' },
      correctAnswer: 'A', conceptTested: '', roleTag: 'EMERGENCY',
    } as PYQItem,
  ];
  const blindCase = buildCaseSessionFromScaffold(blindPyq, { mode: 'blind', scaffoldId: 'scaffold_pneumothorax' });
  assert(blindCase.decisionGates.length === 1, 'Blind case bound its single question');
  const correctText = blindCase.decisionGates[0].pyq.options[
    blindCase.decisionGates[0].pyq.correctAnswer as 'A' | 'B' | 'C' | 'D'
  ];
  // Every single letter of the answer used to score full marks.
  for (const fragment of ['e', 'o', 'n', 'ss', 'i']) {
    const graded = processTurnOffline(blindCase, undefined, fragment, 0);
    assert(
      graded.decisionGates[0].isCorrect !== true,
      `Blind answer "${fragment}" is not graded correct against "${correctText}"`
    );
  }
  const spelledOut = processTurnOffline(blindCase, undefined, correctText, 0);
  assert(spelledOut.decisionGates[0].isCorrect === true, 'Writing the answer out in full is still graded correct');

  // 4i. Decisions sidebar — questions no longer interrupt the case
  console.log('\n--- Test Suite 4i: Decisions Sidebar ---');

  const sidebarBank: PYQItem[] = ['A', 'B', 'C', 'D', 'E'].map((tag, n) => ({
    qid: `SB-${n}`, exam: 'NEET-PG', year: 2022, subject: 'Medicine', system: 'Infectious Disease',
    topic: 'meningitis',
    stem: `Question ${tag}: which statement about bacterial meningitis management is correct?`,
    options: { A: `First ${tag}`, B: `Second ${tag}`, C: `Third ${tag}`, D: `Fourth ${tag}` },
    correctAnswer: 'A', conceptTested: '', roleTag: 'UNTAGGED',
  } as PYQItem));

  const sidebarCase = buildCaseSessionFromScaffold(sidebarBank, { scaffoldId: 'scaffold_meningitis' });
  assert(sidebarCase.decisionGates.length >= 3, 'Sidebar case has several related questions to list');
  assert(
    sidebarCase.decisionGates.every((g) => gateStatus(g) === 'pending'),
    'Every question starts listed as open'
  );

  // The sidebar lets the user answer whichever question they like, so the engine
  // must record an answer against the gate that was actually opened rather than
  // whichever one the case happens to be pointing at.
  const lastIdx = sidebarCase.decisionGates.length - 1;
  const outOfOrder = processTurnOffline(sidebarCase, undefined, sidebarCase.decisionGates[lastIdx].pyq.correctAnswer, lastIdx);
  assert(
    outOfOrder.decisionGates[lastIdx].userAnswer !== undefined,
    'Answering the last question first records against that question'
  );
  assert(
    outOfOrder.decisionGates[0].userAnswer === undefined,
    'Answering out of order leaves the earlier questions untouched'
  );
  assert(gateStatus(outOfOrder.decisionGates[lastIdx]) === 'correct', 'A right answer reads as correct');

  // Going back to an earlier question afterwards must still work.
  const wrongKey = sidebarCase.decisionGates[0].pyq.correctAnswer === 'A' ? 'B' : 'A';
  const backFill = processTurnOffline(outOfOrder, undefined, wrongKey, 0);
  assert(backFill.decisionGates[0].userAnswer === wrongKey, 'An earlier question can still be answered later');
  assert(gateStatus(backFill.decisionGates[0]) === 'incorrect', 'A wrong answer reads as incorrect');
  assert(
    backFill.decisionGates[lastIdx].userAnswer !== undefined,
    'Answering an earlier question does not clear a later one'
  );

  // Each answer must play back into the patient's course — that is what makes
  // the case respond to what the user chose.
  assert(
    !!backFill.decisionGates[0].consequenceMessage,
    'A committed decision produces a consequence in the case'
  );
  assert(
    backFill.turns.length > sidebarCase.turns.length,
    'Committing a decision advances the case transcript'
  );

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
