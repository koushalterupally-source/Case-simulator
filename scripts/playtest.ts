/**
 * Plays cases end to end and dumps everything a user would actually see, so the
 * clinical content can be read and judged rather than assumed.
 *
 *   npx tsx scripts/playtest.ts [scaffoldId]
 */
import { CASE_SCAFFOLDS } from '../src/data/cases/scaffolds';
import { buildCaseSessionFromScaffold } from '../src/utils/caseBinder';
import { processTurnOffline } from '../src/utils/ccsEngine';
import { DEFAULT_PYQ_INDEX } from '../src/data/defaultQBank';

const only = process.argv[2];
const scaffolds = only ? CASE_SCAFFOLDS.filter((s) => s.id === only) : CASE_SCAFFOLDS;

let mismatched = 0;
let totalGates = 0;

for (const scaffold of scaffolds) {
  let session = buildCaseSessionFromScaffold(DEFAULT_PYQ_INDEX, {
    scaffoldId: scaffold.id,
    mode: 'standard',
    seed: 'PLAYTEST',
  });

  console.log('\n' + '='.repeat(78));
  console.log(`CASE  ${scaffold.id}   (truth: ${scaffold.conditionName})`);
  console.log('='.repeat(78));
  console.log(`PATIENT   ${session.patient.name}, ${session.patient.age} ${session.patient.gender}`);
  console.log(`COMPLAINT ${session.patient.chiefComplaint}`);
  console.log(
    `VITALS    HR ${session.patient.currentVitals.hr}  BP ${session.patient.currentVitals.bp}  ` +
      `RR ${session.patient.currentVitals.rr}  SpO2 ${session.patient.currentVitals.spo2}  ` +
      `T ${session.patient.currentVitals.temp}  Glu ${session.patient.currentVitals.grbs}`
  );

  console.log(`\nINCIDENTALS (${session.incidentalFindings.length}):`);
  for (const inc of session.incidentalFindings) {
    console.log(`  · ${inc.title}`);
    console.log(`      ${inc.description}`);
    console.log(`      correct action: ${inc.correctAction}`);
  }

  console.log(`\nDECISION GATES (${session.decisionGates.length}):`);
  session.decisionGates.forEach((g, i) => {
    totalGates++;
    const sameSystem =
      g.pyq.system?.toLowerCase() === scaffold.system?.toLowerCase() ||
      g.pyq.subject?.toLowerCase() === scaffold.subject?.toLowerCase();
    if (!sameSystem) mismatched++;
    console.log(`\n  [${i + 1}] ${g.pyq.qid}  role=${g.pyq.roleTag}  subj=${g.pyq.subject}/${g.pyq.system}` +
      `${sameSystem ? '' : '   <-- UNRELATED TO THIS PATIENT'}`);
    console.log(`      context: ${g.patientContext}`);
    console.log(`      Q: ${g.pyq.stem}`);
    (['A', 'B', 'C', 'D'] as const).forEach((k) => {
      console.log(`         ${k}${g.pyq.correctAnswer === k ? '*' : ' '} ${g.pyq.options[k]}`);
    });
  });

  // Play it: answer every gate correctly, and order something in between.
  console.log('\n--- PLAYTHROUGH ---');
  for (let i = 0; i < session.decisionGates.length; i++) {
    const gate = session.decisionGates[session.currentGateIndex];
    if (!gate) break;
    const before = session.turns.length;
    session = processTurnOffline(session, undefined, gate.pyq.correctAnswer, session.currentGateIndex);
    const t = session.turns[session.turns.length - 1];
    if (session.turns.length > before) {
      console.log(`  gate ${i + 1} answered correctly -> ${t.whatHappened}`);
    }
  }

  for (const cmd of ['hx: any chest pain or breathlessness?', 'pe: chest', 'order: CBC, chest x-ray']) {
    session = processTurnOffline(session, cmd);
    const t = session.turns[session.turns.length - 1];
    console.log(`\n  > ${cmd}`);
    console.log(`    ${t.whatHappened.replace(/\n/g, '\n    ')}`);
    for (const r of t.newResults || []) {
      console.log(`    [${r.orderName}] ${r.resultText}`);
    }
  }
}

console.log('\n' + '='.repeat(78));
console.log(`SUMMARY: ${mismatched}/${totalGates} gates are drawn from a different subject/system than the patient has.`);
