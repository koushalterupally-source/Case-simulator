import {
  CaseSession,
  CaseMode,
  PYQItem,
  SimTurn,
  Vitals,
  IncidentalFinding,
  DecisionGate,
  OrderResultItem,
  OrderCategory,
  EndOfCaseScorecard,
  LocationType,
  PatientState,
} from '../types';

export interface SimTime {
  day: number;
  hour: number;
  minute: number;
}

export function formatSimTime(time: { day: number; hour: number; minute: number }): string {
  const dayStr = `Day ${time.day}`;
  const hrStr = String(time.hour).padStart(2, '0');
  const minStr = String(time.minute).padStart(2, '0');
  return `${dayStr}, ${hrStr}:${minStr}`;
}

export function addMinutesToSimTime(
  time: { day: number; hour: number; minute: number },
  minsToAdd: number
): { day: number; hour: number; minute: number } {
  let { day, hour, minute } = time;
  minute += minsToAdd;
  while (minute >= 60) {
    minute -= 60;
    hour += 1;
  }
  while (hour >= 24) {
    hour -= 24;
    day += 1;
  }
  return { day, hour, minute };
}

const FIRST_NAMES_MALE = ['Rajesh', 'Anil', 'Vikram', 'Suresh', 'Manish', 'Rohan', 'Amit', 'Deepak'];
const FIRST_NAMES_FEMALE = ['Priya', 'Ananya', 'Sunita', 'Kavita', 'Meera', 'Pooja', 'Neha', 'Ritu'];
const LAST_NAMES = ['Sharma', 'Verma', 'Gupta', 'Patel', 'Singh', 'Rao', 'Kumar', 'Joshi'];

/**
 * Generate a new offline case session from local PYQ index bank
 */
export function generateNewCaseOffline(
  mode: CaseMode,
  subject: string,
  pyqBank: PYQItem[],
  blindMode: boolean = false
): CaseSession {
  let eligiblePYQs = pyqBank;
  if (subject && subject !== 'Mixed' && subject !== 'All') {
    const filtered = pyqBank.filter((q) => q.subject.toLowerCase() === subject.toLowerCase());
    if (filtered.length >= 3) {
      eligiblePYQs = filtered;
    }
  }

  const count = mode === 'rapid' ? 3 : Math.min(6, eligiblePYQs.length);
  const shuffled = [...eligiblePYQs].sort(() => 0.5 - Math.random());
  const selectedPYQs = shuffled.slice(0, count);

  const gender = Math.random() > 0.5 ? 'Male' : 'Female';
  const firstName =
    gender === 'Male'
      ? FIRST_NAMES_MALE[Math.floor(Math.random() * FIRST_NAMES_MALE.length)]
      : FIRST_NAMES_FEMALE[Math.floor(Math.random() * FIRST_NAMES_FEMALE.length)];
  const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  const age = Math.floor(Math.random() * 45) + 20;

  const primaryPYQ = selectedPYQs[0] || pyqBank[0];
  const patientName = `${firstName} ${lastName}`;
  const chiefComplaint = `Acute presentation related to ${primaryPYQ.topic || primaryPYQ.system}`;
  const location: LocationType = primaryPYQ.roleTag === 'EMERGENCY' ? 'Emergency' : 'OPD';

  const initialVitals: Vitals = {
    hr: primaryPYQ.roleTag === 'EMERGENCY' ? 118 : 84,
    bp: primaryPYQ.roleTag === 'EMERGENCY' ? '92/60' : '124/82',
    rr: primaryPYQ.roleTag === 'EMERGENCY' ? 24 : 16,
    spo2: primaryPYQ.roleTag === 'EMERGENCY' ? 94 : 98,
    temp: '98.6°F',
    grbs: '110 mg/dL',
  };

  const startTime = { day: 1, hour: 9, minute: 0 };
  const clinchingTime = formatSimTime(addMinutesToSimTime(startTime, 45));

  const patientState: PatientState = {
    id: `pt_${Date.now()}`,
    name: patientName,
    age,
    gender,
    chiefComplaint,
    setting: location === 'Emergency' ? 'Emergency Room (ER)' : 'Outpatient Clinic',
    initialVitals: { ...initialVitals },
    currentVitals: { ...initialVitals },
    diagnosis: primaryPYQ.system || 'Acute Medical Illness',
    clinchingClue: primaryPYQ.conceptTested,
    clinchingClueTime: clinchingTime,
  };

  const decisionGates: DecisionGate[] = selectedPYQs.map((pyq, idx) => ({
    id: `gate_${idx + 1}_${pyq.qid}`,
    pyq,
    triggerTurnIndex: idx + 1,
    patientContext: `Clinical decision point encountered for ${patientName}.`,
    consequenceMessage: `Evaluated based on ${pyq.conceptTested}.`,
  }));

  const incidentalFindings: IncidentalFinding[] = [
    {
      id: 'inc_1',
      title: 'Incidental 6mm thyroid nodule on cervical imaging snippet',
      description: 'Found silently buried in chest/neck scan report.',
      correctAction: 'Recommend routine outpatient thyroid ultrasound in 6-12 months; no emergency biopsy needed.',
      status: 'unnoticed',
    },
    {
      id: 'inc_2',
      title: 'Missed Tdap adult vaccination booster',
      description: 'Patient record indicates last Tdap booster >12 years ago.',
      correctAction: 'Administer routine Tdap booster prior to discharge.',
      status: 'unnoticed',
    },
  ];

  const initialTurn: SimTurn = {
    turnIndex: 1,
    simTime: startTime,
    location,
    userCommand: undefined,
    whatHappened: `Patient ${patientName}, a ${age}-year-old ${gender}, presents to ${location}. ${chiefComplaint}.\n\nPatient is conscious, oriented to time, place, and person. Initial triage vitals recorded. Review current case status and examine patient history/vitals.`,
    vitals: { ...initialVitals },
    newResults: [],
  };

  const sessionId = `case_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

  return {
    id: sessionId,
    title: `CCS Simulation: ${patientName} (${chiefComplaint})`,
    mode,
    subject,
    patient: patientState,
    currentLocation: location,
    simTime: startTime,
    turns: [initialTurn],
    pendingOrders: [],
    completedOrders: [],
    historyLog: [],
    examLog: [],
    decisionGates,
    currentGateIndex: 0,
    incidentalFindings,
    status: 'active',
    scorecard: undefined,
    blindMode,
  };
}

/**
 * Process a user command turn or gate answer offline
 */
export function processTurnOffline(
  session: CaseSession,
  userCommand?: string,
  gateAnswer?: string
): CaseSession {
  let updatedSession: CaseSession = JSON.parse(JSON.stringify(session));

  // 1. Decision Gate Answer
  if (
    gateAnswer &&
    updatedSession.currentGateIndex >= 0 &&
    updatedSession.currentGateIndex < updatedSession.decisionGates.length
  ) {
    const currentGate = updatedSession.decisionGates[updatedSession.currentGateIndex];
    if (!currentGate.userAnswer) {
      const isCorrect = gateAnswer.toUpperCase() === currentGate.pyq.correctAnswer.toUpperCase();
      currentGate.userAnswer = gateAnswer.toUpperCase() as 'A' | 'B' | 'C' | 'D';
      currentGate.isCorrect = isCorrect;

      const consequence = isCorrect
        ? `✅ CORRECT COMMITMENT! Key Concept Validated: ${currentGate.pyq.conceptTested}. Patient condition stabilizes under targeted care.`
        : `❌ INCORRECT COMMITMENT! Option ${gateAnswer.toUpperCase()} chosen. Correct Answer was Option ${currentGate.pyq.correctAnswer}: ${
            currentGate.pyq.options[currentGate.pyq.correctAnswer]
          }. Key Concept: ${currentGate.pyq.conceptTested}. Adjust management accordingly.`;

      currentGate.consequenceMessage = consequence;

      if (!isCorrect) {
        updatedSession.patient.currentVitals.hr = Math.min(140, updatedSession.patient.currentVitals.hr + 8);
      } else {
        updatedSession.patient.currentVitals.hr = Math.max(72, updatedSession.patient.currentVitals.hr - 4);
      }

      const turnLog: SimTurn = {
        turnIndex: updatedSession.turns.length + 1,
        simTime: { ...updatedSession.simTime },
        location: updatedSession.currentLocation,
        userCommand: `⚡ Gate Commit: Option ${gateAnswer.toUpperCase()}`,
        whatHappened: `[PYQ DECISION GATE - QID: ${currentGate.pyq.qid}]\n${consequence}`,
        vitals: { ...updatedSession.patient.currentVitals },
        newResults: [],
      };

      updatedSession.turns.push(turnLog);

      if (updatedSession.currentGateIndex + 1 < updatedSession.decisionGates.length) {
        updatedSession.currentGateIndex += 1;
      } else {
        updatedSession.currentGateIndex = -1;
      }
    }
    return updatedSession;
  }

  // 2. Free-text Commands
  if (userCommand && userCommand.trim()) {
    const cmdClean = userCommand.trim().toLowerCase();
    let timeSpentMins = 5;
    let narrative = '';
    const newDeliveredResults: OrderResultItem[] = [];

    if (cmdClean.includes('move to') || cmdClean.includes('transfer to')) {
      if (cmdClean.includes('icu')) updatedSession.currentLocation = 'ICU';
      else if (cmdClean.includes('opd')) updatedSession.currentLocation = 'OPD';
      else if (cmdClean.includes('er') || cmdClean.includes('emergency')) updatedSession.currentLocation = 'Emergency';
      else if (cmdClean.includes('ward')) updatedSession.currentLocation = 'Ward';
      else if (cmdClean.includes('ot') || cmdClean.includes('operation')) updatedSession.currentLocation = 'OT';
      timeSpentMins = 15;
      narrative = `Patient transferred to ${updatedSession.currentLocation}. Nursing staff notified and patient settled into bed.`;
    } else if (
      cmdClean.startsWith('hx:') ||
      cmdClean.includes('history') ||
      cmdClean.startsWith('pe:') ||
      cmdClean.includes('examine')
    ) {
      timeSpentMins = 10;
      narrative =
        `Detailed history and physical examination performed.\n\n` +
        `• General Exam: Conscious, oriented, no pallor/icterus/cyanosis/clubbing.\n` +
        `• Systemic Exam: Cardiovascular - S1 S2 heard, no murmur. Respiratory - Bilateral vesicular breath sounds equal. Abdomen - Soft, non-tender.\n` +
        `• Specific History Notes: No prior hospitalizations or known drug allergies noted.`;

      updatedSession.historyLog.push({
        question: 'Detailed Clinical History & Examination',
        answer: narrative,
        time: formatSimTime(updatedSession.simTime),
      });
    } else if (cmdClean.includes('advance') || cmdClean.includes('wait')) {
      const matchMins = cmdClean.match(/(\d+)\s*(min|hour|hr)/);
      if (matchMins) {
        const val = parseInt(matchMins[1]);
        timeSpentMins = matchMins[2].startsWith('hr') || matchMins[2].startsWith('hour') ? val * 60 : val;
      } else {
        timeSpentMins = 30;
      }
      narrative = `Clinical time advanced by ${timeSpentMins} minutes. Patient monitored closely by nursing staff.`;
    } else if (
      cmdClean.startsWith('order:') ||
      cmdClean.startsWith('give') ||
      cmdClean.includes('order') ||
      cmdClean.includes('lab')
    ) {
      timeSpentMins = 5;
      const orderContent = userCommand.replace(/^(order|give|lab)[\:\s]*/i, '').trim();

      if (cmdClean.includes('thyroid') || cmdClean.includes('tsh') || cmdClean.includes('ultrasound neck')) {
        const inc1 = updatedSession.incidentalFindings.find((i) => i.id === 'inc_1');
        if (inc1) inc1.status = 'noticed_addressed';
      }
      if (cmdClean.includes('tdap') || cmdClean.includes('vaccine') || cmdClean.includes('tetanus')) {
        const inc2 = updatedSession.incidentalFindings.find((i) => i.id === 'inc_2');
        if (inc2) inc2.status = 'noticed_addressed';
      }

      const ordersToAdd: OrderResultItem[] = [];
      const items = orderContent.split(/,|\n/);

      items.forEach((itemStr, idx) => {
        const name = itemStr.trim();
        if (!name) return;

        let category: OrderCategory = 'labs';
        let turnaround = 30;

        if (/ecg|ekg/i.test(name)) {
          category = 'monitoring';
          turnaround = 5;
        } else if (/xray|ct|mri|usg|ultrasound/i.test(name)) {
          category = 'imaging';
          turnaround = 45;
        } else if (/iv|stat|aspirin|heparin|antibiotic|paracetamol/i.test(name)) {
          category = 'drugs';
          turnaround = 0;
        } else if (/intubation|line|lumbar/i.test(name)) {
          category = 'procedures';
          turnaround = 15;
        }

        const isUselessOrInvasive = /lumbar puncture|lp|mri brain|ct brain|colonoscopy|endoscopy|bone marrow|biopsy|pet scan|laparoscopy/i.test(name);
        if (isUselessOrInvasive) {
          turnaround += 60; // Penalize with diagnostic turnaround delay
        }

        const readyTime = addMinutesToSimTime(updatedSession.simTime, turnaround);

        let resultText = `Normal reference limits recorded for ${name}. No acute abnormality detected.`;
        if (category === 'monitoring')
          resultText = `Sinus rhythm at ${updatedSession.patient.currentVitals.hr} bpm. No ST elevation or acute ischemic changes.`;
        if (category === 'imaging')
          resultText = `Scan shows clear lung fields. Incidental note: 6mm thyroid nodule present.`;
        if (category === 'drugs')
          resultText = `Medication ${name} administered IV/Oral as ordered. Patient tolerated well.`;

        if (isUselessOrInvasive) {
          resultText = `⚠️ [USMLE CCS PENALTY]: "${name}" performed. Result unremarkable. Note: This procedure was not indicated for this chief complaint (+60 min wasted turnaround delay incurred).`;
        }

        ordersToAdd.push({
          id: `ord_${Date.now()}_${idx}`,
          orderName: name,
          category,
          placedSimTime: formatSimTime(updatedSession.simTime),
          readySimTime: formatSimTime(readyTime),
          isReady: turnaround === 0,
          resultText,
          turnaroundMinutes: turnaround,
        });
      });

      ordersToAdd.forEach((ord) => {
        if (ord.isReady) {
          updatedSession.completedOrders.push(ord);
          newDeliveredResults.push(ord);
        } else {
          updatedSession.pendingOrders.push(ord);
        }
      });

      narrative =
        `Orders placed for patient:\n` +
        ordersToAdd.map((o) => `• ${o.orderName} (${o.category}) - Ready @ ${o.readySimTime}`).join('\n');

      const uselessCount = ordersToAdd.filter((o) =>
        /lumbar puncture|lp|mri brain|ct brain|colonoscopy|endoscopy|bone marrow|biopsy|pet scan|laparoscopy/i.test(o.orderName)
      ).length;

      if (uselessCount > 0) {
        narrative += `\n\n⚠️ [USMLE CCS TIME & SCORE PENALTY]: Unnecessary / invasive investigation(s) ordered. Extra turnaround delays (+60 min/test) added to diagnostic clock and logged on Over-Ordering Audit.`;
      }
    } else {
      narrative = `Command executed: "${userCommand}". Clinical team updated patient status and recorded notes.`;
    }

    const newSimTime = addMinutesToSimTime(updatedSession.simTime, timeSpentMins);
    updatedSession.simTime = newSimTime;

    // Correct time-based check for pending order readiness
    const parseMinsFromSimTimeStr = (str: string): number => {
      const m = str.match(/Day\s+(\d+),\s+(\d+):(\d+)/);
      if (!m) return 0;
      const d = parseInt(m[1]),
        h = parseInt(m[2]),
        min = parseInt(m[3]);
      return d * 24 * 60 + h * 60 + min;
    };

    const currentTotalMins =
      updatedSession.simTime.day * 24 * 60 +
      updatedSession.simTime.hour * 60 +
      updatedSession.simTime.minute;

    const remainingPending: OrderResultItem[] = [];
    updatedSession.pendingOrders.forEach((ord) => {
      const readyMins = parseMinsFromSimTimeStr(ord.readySimTime);
      if (currentTotalMins >= readyMins) {
        const completedItem = { ...ord, isReady: true };
        updatedSession.completedOrders.push(completedItem);
        newDeliveredResults.push(completedItem);
      } else {
        remainingPending.push(ord);
      }
    });
    updatedSession.pendingOrders = remainingPending;

    const turnLog: SimTurn = {
      turnIndex: updatedSession.turns.length + 1,
      simTime: { ...updatedSession.simTime },
      location: updatedSession.currentLocation,
      userCommand,
      whatHappened: narrative,
      vitals: { ...updatedSession.patient.currentVitals },
      newResults: newDeliveredResults,
    };

    updatedSession.turns.push(turnLog);
  }

  return updatedSession;
}

/**
 * Generate End-of-Case Scorecard offline
 */
export function generateScorecardOffline(session: CaseSession): CaseSession {
  const updatedSession: CaseSession = JSON.parse(JSON.stringify(session));
  updatedSession.status = 'completed';

  const gates = updatedSession.decisionGates;
  const totalGates = gates.length;
  const correctGates = gates.filter((g) => g.userAnswer && g.isCorrect).length;
  const pyqPercentage = totalGates > 0 ? Math.round((correctGates / totalGates) * 100) : 0;

  const incidentalsReport = updatedSession.incidentalFindings.map((inc) => {
    const isAddressed = inc.status === 'noticed_addressed';
    return {
      title: inc.title,
      outcome: isAddressed ? inc.correctAction : 'Finding was unaddressed during patient management.',
      status: inc.status,
      scoreNote: isAddressed ? '+10 Points — Excellent incidental care!' : '0 Points — Incidental actionable missed.',
    };
  });

  const addressedIncCount = updatedSession.incidentalFindings.filter((i) => i.status === 'noticed_addressed').length;

  // Evaluate useless/invasive investigations over-ordering audit
  const allPlacedOrders = [...updatedSession.completedOrders, ...updatedSession.pendingOrders];
  const uselessOrders = allPlacedOrders.filter((o) =>
    /lumbar puncture|lp|mri brain|ct brain|colonoscopy|endoscopy|bone marrow|biopsy|pet scan|laparoscopy/i.test(o.orderName)
  );

  const overOrderingList = uselessOrders.map(
    (o) => `⚠️ ${o.orderName}: Unnecessary / invasive test ordered (+60 min wasted turnaround delay, -5 pts score penalty)`
  );

  const overOrderingPenalty = uselessOrders.length * 5;
  const overallScore = Math.min(100, Math.max(0, pyqPercentage * 0.8 + addressedIncCount * 10 - overOrderingPenalty));

  const criticalDelays: string[] = [];
  const totalSimMinutes = updatedSession.simTime.day * 24 * 60 + updatedSession.simTime.hour * 60 + updatedSession.simTime.minute - 9 * 60;
  if (totalSimMinutes > 120 && correctGates < totalGates / 2) {
    criticalDelays.push('⚠️ Triage Delay: Critical clinical decision gates remained unaddressed past 2 hours of presentation.');
  }

  let grade: 'S' | 'A' | 'B' | 'C' | 'F' = 'B';
  if (overallScore >= 90) grade = 'S';
  else if (overallScore >= 75) grade = 'A';
  else if (overallScore >= 60) grade = 'B';
  else if (overallScore >= 45) grade = 'C';
  else grade = 'F';

  const gateResults = gates.map((g) => ({
    qid: g.pyq.qid,
    examYear: `${g.pyq.exam} ${g.pyq.year}`,
    topic: g.pyq.topic,
    roleTag: g.pyq.roleTag,
    userChoice: g.userAnswer || 'Skipped',
    correctChoice: g.pyq.correctAnswer,
    isCorrect: !!g.isCorrect,
    concept: g.pyq.conceptTested,
    consequence: g.consequenceMessage || 'Evaluated based on concept.',
  }));

  const missedGates = gates.filter((g) => !g.isCorrect);
  const topConceptsToRevise = (missedGates.length > 0 ? missedGates : gates).slice(0, 3).map((g) => ({
    concept: g.pyq.conceptTested,
    sourceQIDs: [g.pyq.qid],
  }));

  const scorecard: EndOfCaseScorecard = {
    finalDiagnosis: session.patient.diagnosis || session.patient.chiefComplaint,
    clinchingClue: session.patient.clinchingClue || 'Verbatim PYQ concept match',
    clinchingTime: session.patient.clinchingClueTime || formatSimTime(session.simTime),
    pyqScore: {
      correct: correctGates,
      total: totalGates,
      percentage: pyqPercentage,
    },
    gateResults,
    incidentalFindingsReport: incidentalsReport,
    criticalDelays,
    overOrderingList,
    preventionChecklist: [
      { item: 'Adult Tdap Booster', status: addressedIncCount > 1 ? 'done' : 'missed' },
    ],
    topConceptsToRevise,
    overallGrade: grade,
    overallScore,
    summaryFeedback: `Completed clinical case with ${correctGates}/${totalGates} correct decision gate commitments. ${uselessOrders.length > 0 ? `Incurred ${uselessOrders.length} useless investigation penalties.` : 'Clean order efficiency maintained.'} Overall grade: ${grade}.`,
  };

  updatedSession.scorecard = scorecard;
  return updatedSession;
}
