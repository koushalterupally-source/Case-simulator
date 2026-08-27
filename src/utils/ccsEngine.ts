import {
  CaseSession,
  OrderResultItem,
  SimTurn,
  EndOfCaseScorecard,
  LocationType,
  PYQItem,
} from '../types';
import { CASE_SCAFFOLDS } from '../data/cases/scaffolds';

/**
 * Utility: Convert sim time object to total minutes from Day 1, 00:00
 */
export function simTimeToMinutes(simTime: { day: number; hour: number; minute: number }): number {
  return (simTime.day - 1) * 24 * 60 + simTime.hour * 60 + simTime.minute;
}

/**
 * Utility: Add minutes to sim time, correctly handling midnight roll-over
 */
export function addMinutesToSimTime(
  simTime: { day: number; hour: number; minute: number },
  minutesToAdd: number
): { day: number; hour: number; minute: number } {
  let totalMins = simTimeToMinutes(simTime) + minutesToAdd;
  if (totalMins < 0) totalMins = 0;

  const day = Math.floor(totalMins / (24 * 60)) + 1;
  const remMins = totalMins % (24 * 60);
  const hour = Math.floor(remMins / 60);
  const minute = remMins % 60;

  return { day, hour, minute };
}

/**
 * Utility: Format sim time string e.g. "Day 1, 09:15"
 */
export function formatSimTime(simTime: { day: number; hour: number; minute: number }): string {
  const h = String(simTime.hour).padStart(2, '0');
  const m = String(simTime.minute).padStart(2, '0');
  return `Day ${simTime.day}, ${h}:${m}`;
}

/**
 * Parses duration from user commands like "advance 2 hours", "wait 30 min", "advance 1.5 hrs", "advance one hour"
 */
export function parseDurationMinutes(command: string): number | null {
  const numWords: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    half: 0.5,
  };

  const wordMatch = command.match(/(?:advance|wait|time)\s+(one|two|three|four|five|six|seven|eight|nine|ten|half)\s+(hour|hr|h|min|minute|m)s?/i);
  if (wordMatch) {
    const val = numWords[wordMatch[1].toLowerCase()] || 1;
    const unit = wordMatch[2].toLowerCase();
    return unit.startsWith('h') ? Math.round(val * 60) : Math.round(val);
  }

  const match = command.match(/(?:advance|wait|time)\s+(\d+(?:\.\d+)?)\s*(hour|hr|h|min|minute|m)s?/i);
  if (!match) return null;

  const val = parseFloat(match[1]);
  const unit = match[2].toLowerCase();

  if (unit.startsWith('h')) {
    return Math.round(val * 60);
  } else {
    return Math.round(val);
  }
}

/**
 * Helper for blind mode free-text matching with clinical synonyms
 */
function matchBlindAnswer(
  userTextRaw: string,
  pyq: PYQItem
): { isCorrect: boolean; isSelfReview: boolean } {
  const userText = userTextRaw.trim().toLowerCase();
  if (!userText) return { isCorrect: false, isSelfReview: true };

  const correctOptKey = pyq.correctAnswer as 'A' | 'B' | 'C' | 'D';
  const correctOptText = (pyq.options[correctOptKey] || '').toLowerCase().trim();

  // 1. Direct letter choice check (e.g., "Option A", "A")
  if (userText === correctOptKey.toLowerCase() || userText === `option ${correctOptKey.toLowerCase()}`) {
    return { isCorrect: true, isSelfReview: false };
  }

  // 2. Substring or option text inclusion
  if (correctOptText && (userText.includes(correctOptText) || correctOptText.includes(userText))) {
    return { isCorrect: true, isSelfReview: false };
  }

  // 3. Clinical Synonym Dictionary
  const synonyms: Record<string, string[]> = {
    aspirin: ['asa', 'acetylsalicylic acid', 'ecosprin', 'antiplatelet'],
    clopidogrel: ['plavix', 'p2y12', 'ticagrelor', 'prasugrel'],
    heparin: ['unfractionated heparin', 'ufh', 'lmwh', 'enoxaparin'],
    ecg: ['ekg', 'electrocardiogram', '12 lead ecg'],
    cxr: ['chest xray', 'chest x-ray', 'chest radiograph', 'radiograph'],
    ct: ['computed tomography', 'ct scan', 'non-contrast ct', 'ctpa'],
    echo: ['echocardiogram', 'echocardiography', '2d echo', 'transthoracic echo'],
    intubation: ['endotracheal intubation', 'ett', 'airway', 'rsi'],
    saline: ['normal saline', 'iv fluids', 'crystalloid', '0.9% nacl', 'fluid bolus'],
    thrombolysis: ['tpa', 'alteplase', 'tenecteplase', 'streptokinase'],
    pci: ['percutaneous coronary intervention', 'angioplasty', 'stenting', 'cardiac cath'],
    lumbar_puncture: ['lp', 'spinal tap', 'csf analysis'],
  };

  for (const [key, aliases] of Object.entries(synonyms)) {
    const isTargetInKey = correctOptText.includes(key) || aliases.some((a) => correctOptText.includes(a));
    const isUserInKey = userText.includes(key) || aliases.some((a) => userText.includes(a));

    if (isTargetInKey && isUserInKey) {
      return { isCorrect: true, isSelfReview: false };
    }
  }

  // Fallback to self-review
  return { isCorrect: false, isSelfReview: true };
}

/**
 * Splits a multi-order command into individual orders.
 *
 * Commas inside brackets are part of the order's name, not separators —
 * "RFT / KFT (urea, creatinine)" is one investigation, and a naive split turned
 * it into "RFT / KFT (urea" and "creatinine)".
 */
export function splitOrders(block: string): string[] {
  const out: string[] = [];
  let current = '';
  let depth = 0;

  for (const ch of block) {
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);

    if (depth === 0 && (ch === ',' || ch === ';' || ch === '\n')) {
      out.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  out.push(current);

  return out.map((s) => s.trim()).filter(Boolean);
}

/** Best-effort category for an order the scaffold does not model. */
export function inferOrderCategory(name: string): OrderResultItem['category'] {
  const n = name.toLowerCase();
  if (/\b(ecg|ekg|monitoring|oximetry|nibp|telemetry|charting)\b/.test(n)) return 'monitoring';
  if (/\b(x-?ray|cxr|usg|ultrasound|ct|ctpa|mri|mra|echo|doppler|angiography|scan|fast)\b/.test(n))
    return 'imaging';
  if (/\b(consult|refer|referral)\b/.test(n)) return 'consults';
  if (
    /\b(intubation|ventilation|cannula|catheter|catheterisation|line|drain|decompression|puncture|tap|cpr|defibrillation|cardioversion|endoscopy|laparotomy|pci|dialysis|pericardiocentesis)\b/.test(n)
  )
    return 'procedures';
  if (
    /\b(mg|mcg|gram|infusion|bolus|iv|oral|nebulisation|nebulization|saline|dextrose|ringer|lactate|resomal|ors|plasma|platelet|cells|cryoprecipitate|oxygen|prophylaxis)\b/.test(n)
  )
    return 'drugs';
  return 'labs';
}

/**
 * Main Offline Simulation Turn Engine
 */
export function processTurnOffline(
  session: CaseSession,
  userCommand?: string,
  gateAnswer?: string,
  gateIndex?: number
): CaseSession {
  const updatedSession: CaseSession = JSON.parse(JSON.stringify(session));
  const scaffold = CASE_SCAFFOLDS.find((s) => s.id === updatedSession.scaffoldId) || CASE_SCAFFOLDS[0];

  let timeSpentMins = 5; // Default turn duration
  let narrative = '';
  const newDeliveredResults: OrderResultItem[] = [];

  // 1. Process Decision Gate Answer if submitted
  const targetGateIdx = gateIndex !== undefined && gateIndex >= 0 ? gateIndex : updatedSession.currentGateIndex;

  if (gateAnswer !== undefined && targetGateIdx < updatedSession.decisionGates.length) {
    const currentGate = updatedSession.decisionGates[targetGateIdx];
    const pyq = currentGate.pyq;

    let isCorrect = false;
    let isSelfReview = false;

    if (updatedSession.blindMode) {
      const matchRes = matchBlindAnswer(gateAnswer, pyq);
      isCorrect = matchRes.isCorrect;
      isSelfReview = matchRes.isSelfReview;
      currentGate.userAnswer = gateAnswer;
    } else {
      const choice = gateAnswer.toUpperCase().trim() as 'A' | 'B' | 'C' | 'D';
      isCorrect = choice === pyq.correctAnswer;
      currentGate.userAnswer = choice;
    }

    currentGate.isCorrect = isCorrect;
    currentGate.isSelfReview = isSelfReview;

    const milestone = scaffold.gateMilestones[targetGateIdx];
    const consequence = isCorrect
      ? (milestone ? milestone.consequenceOnRight : 'Decision executed correctly.')
      : (milestone ? milestone.consequenceOnWrong : 'Suboptimal clinical choice made.');

    currentGate.consequenceMessage = consequence;
    currentGate.explanationGiven = pyq.explanation || 'See standard-of-care guidelines.';

    narrative = consequence;

    // Advance currentGateIndex past targetGateIdx
    updatedSession.currentGateIndex = Math.max(updatedSession.currentGateIndex, targetGateIdx + 1);
  }

  // 2. Process User Command
  if (userCommand && userCommand.trim()) {
    const cmdLower = userCommand.trim().toLowerCase();

    // Command: pause
    if (cmdLower === 'pause') {
      updatedSession.status = 'paused';
      narrative = 'Simulation paused. Case state block saved.';
    }
    // Command: end case
    else if (cmdLower === 'end case' || cmdLower === 'exit') {
      updatedSession.status = 'completed';
      updatedSession.scorecard = generateScorecard(updatedSession);
      narrative = 'Case simulation ended by user. Final scorecard generated.';
    }
    // Command: move to <location>
    else if (cmdLower.startsWith('move to') || cmdLower.startsWith('transfer to')) {
      const locMatch = userCommand.match(/(?:move|transfer)\s+to\s+(Emergency|OPD|Ward|ICU|OT|Home)/i);
      if (locMatch) {
        const rawLoc = locMatch[1].toUpperCase();
        let newLoc: LocationType = 'Ward';
        if (rawLoc === 'EMERGENCY') newLoc = 'Emergency';
        else if (rawLoc === 'OPD') newLoc = 'OPD';
        else if (rawLoc === 'WARD') newLoc = 'Ward';
        else if (rawLoc === 'ICU') newLoc = 'ICU';
        else if (rawLoc === 'OT') newLoc = 'OT';
        else if (rawLoc === 'HOME') newLoc = 'Home';

        updatedSession.currentLocation = newLoc;
        timeSpentMins = 15;
        narrative = `Patient transferred to ${newLoc}. Clinical team updated.`;
      } else {
        narrative = 'Invalid location specified. Available locations: Emergency, OPD, Ward, ICU, OT, Home.';
      }
    }
    // Command: advance / wait <time>
    else if (cmdLower.startsWith('advance') || cmdLower.startsWith('wait')) {
      const parsedMins = parseDurationMinutes(userCommand);
      if (parsedMins !== null && parsedMins > 0) {
        timeSpentMins = parsedMins;
        narrative = `Advanced clinical clock by ${parsedMins} minutes. Patient monitored closely.`;
      } else {
        narrative = 'Unrecognized duration format. Use e.g. "advance 2 hours" or "wait 30 mins".';
      }
    }
    // Command: hx: <history question>
    else if (cmdLower.startsWith('hx:') || cmdLower.startsWith('history:')) {
      const q = userCommand.replace(/^(?:hx|history)\:\s*/i, '').trim();
      timeSpentMins = 2;

      let ans = 'No significant abnormalities reported.';
      const qLower = q.toLowerCase();

      for (const [key, val] of Object.entries(scaffold.historyMap)) {
        if (qLower.includes(key)) {
          ans = val;
          break;
        }
      }

      updatedSession.historyLog.push({
        question: q,
        answer: ans,
        time: formatSimTime(updatedSession.simTime),
      });
      narrative = `History taken (${q}): "${ans}"`;
    }
    // Command: pe: <system>
    else if (cmdLower.startsWith('pe:') || cmdLower.startsWith('exam:')) {
      const sys = userCommand.replace(/^(?:pe|exam)\:\s*/i, '').trim().toLowerCase();
      timeSpentMins = 3;

      let findings = 'Vesicular breath sounds, soft abdomen, normal S1 S2, alert.';
      for (const [key, val] of Object.entries(scaffold.examFindingsMap)) {
        if (sys.includes(key)) {
          findings = val;
          break;
        }
      }

      updatedSession.examLog.push({
        system: sys.toUpperCase(),
        findings,
        time: formatSimTime(updatedSession.simTime),
      });
      narrative = `Physical Examination (${sys.toUpperCase()}): ${findings}`;
    }
    // Command: order: <investigation/drug>
    else if (cmdLower.startsWith('order:') || cmdLower.startsWith('give') || cmdLower.startsWith('start') || cmdLower.startsWith('administer') || cmdLower.startsWith('order')) {
      const orderBlock = userCommand.replace(/^(?:order\:|give|start|administer|order)\s*/i, '').trim();

      // One command can carry several orders — the order sheet sends them
      // comma-separated, and a doctor writing them out does the same. Each gets
      // its own result and its own turnaround, rather than being filed as a
      // single order literally named "CBC, chest x-ray".
      const orderNames = splitOrders(orderBlock);

      timeSpentMins = Math.min(15, 2 + orderNames.length);
      const placedLines: string[] = [];

      for (const orderName of orderNames) {
        const orderLower = orderName.toLowerCase();
        let matchedKey: string | null = null;

        for (const key of Object.keys(scaffold.investigationsMap)) {
          if (orderLower.includes(key) || key.includes(orderLower)) {
            matchedKey = key;
            break;
          }
        }

        let resultText = '';
        let turnaround = 15;
        let category: any = 'labs';

        if (matchedKey) {
          const item = scaffold.investigationsMap[matchedKey];
          resultText = item.resultText;
          turnaround = item.turnaroundMinutes;
          category = item.category;
        } else {
          // Not modelled in this scaffold — say so rather than inventing a
          // normal result.
          resultText = `Not modelled in this case.`;
          turnaround = 20;
          category = inferOrderCategory(orderName);
        }

        const readySimTimeStr = formatSimTime(addMinutesToSimTime(updatedSession.simTime, turnaround));

        updatedSession.pendingOrders.push({
          id: `ord_${Date.now()}_${Math.random()}`,
          orderName,
          category,
          placedSimTime: formatSimTime(updatedSession.simTime),
          readySimTime: readySimTimeStr,
          isReady: false,
          resultText,
          turnaroundMinutes: turnaround,
          orderedTurnIndex: updatedSession.turns.length,
        });

        placedLines.push(`${orderName} — ready ${readySimTimeStr}`);

        updatedSession.incidentalFindings.forEach((inc) => {
          if (inc.status === 'unnoticed') {
            if (/\b(usg|ultrasound|ct|cxr|x-?ray|mri|echo|vaccine|tdap|hemogram|cbc|tft|ferritin)\b/i.test(orderLower)) {
              inc.status = 'noticed_addressed';
            }
          }
        });
      }

      narrative =
        orderNames.length === 1
          ? `Ordered ${placedLines[0]}.`
          : `${orderNames.length} orders placed:\n${placedLines.map((l) => `• ${l}`).join('\n')}`;
    }
    else {
      narrative = `Command executed: "${userCommand}". Clinical notes recorded.`;
    }
  }

  // 3. Advance Sim Clock
  const newSimTime = addMinutesToSimTime(updatedSession.simTime, timeSpentMins);
  updatedSession.simTime = newSimTime;

  // 4. Release Ready Pending Orders
  const currentTotalMinutes = simTimeToMinutes(updatedSession.simTime);
  const remainingPending: OrderResultItem[] = [];

  updatedSession.pendingOrders.forEach((ord) => {
    // Parse ready sim time
    const m = ord.readySimTime.match(/Day\s+(\d+),\s+(\d+):(\d+)/);
    if (m) {
      const readyMins = (parseInt(m[1]) - 1) * 24 * 60 + parseInt(m[2]) * 60 + parseInt(m[3]);
      if (currentTotalMinutes >= readyMins) {
        const completedItem = { ...ord, isReady: true };
        updatedSession.completedOrders.push(completedItem);
        newDeliveredResults.push(completedItem);
      } else {
        remainingPending.push(ord);
      }
    } else {
      updatedSession.completedOrders.push({ ...ord, isReady: true });
    }
  });

  updatedSession.pendingOrders = remainingPending;

  // 5. Evaluate Trajectory & Patient Deterioration (Scaffold cases only)
  if (!updatedSession.isQuestionLed) {
    const allPlaced = [...updatedSession.completedOrders, ...updatedSession.pendingOrders];
    const totalElapsedMinutes = currentTotalMinutes - simTimeToMinutes({ day: 1, hour: 9, minute: 0 });

    // An intervention counts as done if it was ordered directly OR delivered by
    // answering the decision gate that represents it. Checking orders alone meant
    // a player who answered every gate correctly still watched the patient
    // deteriorate for treatment the narrative said they had already given.
    const gateDelivered = updatedSession.decisionGates
      .filter((g) => g.userAnswer !== undefined && g.isCorrect)
      .map((g) => `${g.consequenceMessage || ''} ${g.patientContext || ''}`)
      .join(' ');

    scaffold.criticalInterventions.forEach((critical) => {
      const executed =
        allPlaced.some((o) => critical.orderOrActionPattern.test(o.orderName)) ||
        critical.orderOrActionPattern.test(gateDelivered);

      // Warn once, when it first goes overdue — not on every turn forever.
      const alreadyWarned = updatedSession.turns.some((t) =>
        (t.whatHappened || '').includes(critical.name.toLowerCase())
      );

      if (!executed && totalElapsedMinutes > critical.targetMilestoneMinutes) {
        // Deteriorate vitals!
        updatedSession.patient.currentVitals.hr = Math.min(180, updatedSession.patient.currentVitals.hr + 4);
        updatedSession.patient.currentVitals.spo2 = Math.max(70, updatedSession.patient.currentVitals.spo2 - 2);
        if (!alreadyWarned) {
          narrative += `\n\nThe patient is deteriorating: ${critical.name.toLowerCase()} is now overdue against a ${critical.targetMilestoneMinutes}-minute window. Heart rate is climbing and oxygenation is falling.`;
        }
      } else if (executed) {
        // Improve vitals
        updatedSession.patient.currentVitals.hr = Math.max(72, updatedSession.patient.currentVitals.hr - 2);
        updatedSession.patient.currentVitals.spo2 = Math.min(99, updatedSession.patient.currentVitals.spo2 + 1);
      }
    });
  }

  // 6. Record Turn
  const newTurn: SimTurn = {
    turnIndex: updatedSession.turns.length + 1,
    simTime: newSimTime,
    location: updatedSession.currentLocation,
    whatHappened: narrative || 'Clinical evaluation in progress.',
    vitals: { ...updatedSession.patient.currentVitals },
    newResults: newDeliveredResults,
    userCommand,
  };

  updatedSession.turns.push(newTurn);

  return updatedSession;
}

/**
 * Generates an end-of-case Scorecard based strictly on recorded events
 */
export function generateScorecard(session: CaseSession): EndOfCaseScorecard {
  const scaffold = CASE_SCAFFOLDS.find((s) => s.id === session.scaffoldId) || CASE_SCAFFOLDS[0];

  const gateResults = session.decisionGates.map((gate) => ({
    qid: gate.pyq.qid,
    examYear: `${gate.pyq.exam} ${gate.pyq.year}`,
    topic: gate.pyq.topic,
    roleTag: gate.pyq.roleTag,
    userChoice: gate.userAnswer,
    correctChoice: gate.pyq.correctAnswer,
    isCorrect: !!gate.isCorrect,
    concept: gate.pyq.conceptTested || 'High-yield clinical concept',
    consequence: gate.consequenceMessage || 'Standard clinical outcome.',
  }));

  const correctGates = gateResults.filter((g) => g.isCorrect).length;
  const totalGates = gateResults.length || 1;
  const pyqPercentage = Math.round((correctGates / totalGates) * 100);

  // Over-ordering list (orders placed that were not indicative)
  const allOrders = [...session.completedOrders, ...session.pendingOrders];
  const overOrders = allOrders.filter((ord) => {
    const keyMatch = Object.keys(scaffold.investigationsMap).find((k) => ord.orderName.toLowerCase().includes(k));
    if (!keyMatch) return true; // Not in scaffold map = unindicated
    return !scaffold.investigationsMap[keyMatch].isIndicative;
  });

  const overOrderingList = overOrders.map(
    (o) => `${o.orderName} — not indicated here; it cost ${o.turnaroundMinutes} minutes.`
  );

  // Critical Delays
  const currentTotalMins = simTimeToMinutes(session.simTime);
  const totalElapsedMinutes = currentTotalMins - simTimeToMinutes({ day: 1, hour: 9, minute: 0 });
  const criticalDelays: string[] = [];

  scaffold.criticalInterventions.forEach((crit) => {
    const placed = allOrders.find((o) => crit.orderOrActionPattern.test(o.orderName));
    if (!placed && totalElapsedMinutes > crit.targetMilestoneMinutes) {
      criticalDelays.push(`${crit.name} — not done within the ${crit.targetMilestoneMinutes}-minute window.`);
    }
  });

  // Incidental Findings Report
  const incidentalReport = session.incidentalFindings.map((inc) => ({
    title: inc.title,
    outcome: inc.description,
    status: inc.status,
    scoreNote:
      inc.status === 'noticed_addressed'
        ? 'Noticed and handled correctly.'
        : 'Missed, or noticed but not acted on.',
  }));

  const addressedIncCount = session.incidentalFindings.filter((i) => i.status === 'noticed_addressed').length;

  // Top concepts to revise (missed gates)
  const missedGates = gateResults.filter((g) => !g.isCorrect);
  const topConceptsToRevise = missedGates.slice(0, 3).map((m) => ({
    concept: m.concept,
    sourceQIDs: [m.qid],
  }));

  if (session.isQuestionLed) {
    let qGrade: 'S' | 'A' | 'B' | 'C' | 'F' = 'B';
    if (pyqPercentage >= 90) qGrade = 'S';
    else if (pyqPercentage >= 75) qGrade = 'A';
    else if (pyqPercentage >= 60) qGrade = 'B';
    else if (pyqPercentage >= 45) qGrade = 'C';
    else qGrade = 'F';

    return {
      finalDiagnosis: '',
      clinchingClue: '',
      clinchingTime: '',
      pyqScore: {
        correct: correctGates,
        total: totalGates,
        percentage: pyqPercentage,
      },
      gateResults,
      incidentalFindingsReport: [],
      criticalDelays: [],
      overOrderingList: [],
      preventionChecklist: [],
      topConceptsToRevise,
      overallGrade: qGrade,
      overallScore: pyqPercentage,
      summaryFeedback: `Completed question-led set. Solved ${correctGates}/${totalGates} questions correctly (${pyqPercentage}%). Grade: ${qGrade}.`,
    };
  }

  // Calculate Overall Score for scaffold simulation
  const overOrderingPenalty = overOrders.length * 5;
  const rawScore = Math.round((correctGates / totalGates) * 80 + addressedIncCount * 10 - overOrderingPenalty);
  const overallScore = Math.min(100, Math.max(0, rawScore));

  let grade: 'S' | 'A' | 'B' | 'C' | 'F' = 'B';
  if (overallScore >= 90) grade = 'S';
  else if (overallScore >= 75) grade = 'A';
  else if (overallScore >= 60) grade = 'B';
  else if (overallScore >= 45) grade = 'C';
  else grade = 'F';

  return {
    finalDiagnosis: session.patient.diagnosis,
    clinchingClue: session.patient.clinchingClue,
    clinchingTime: session.patient.clinchingClueTime,
    pyqScore: {
      correct: correctGates,
      total: totalGates,
      percentage: pyqPercentage,
    },
    gateResults,
    incidentalFindingsReport: incidentalReport,
    criticalDelays,
    overOrderingList,
    preventionChecklist: [
      { item: 'Adult Tdap Booster Vaccination', status: addressedIncCount > 0 ? 'done' : 'missed' },
    ],
    topConceptsToRevise,
    overallGrade: grade,
    overallScore,
    summaryFeedback: `Completed clinical case for ${session.patient.diagnosis}. Solved ${correctGates}/${totalGates} decision gates correctly. Score: ${overallScore}/100 (Grade: ${grade}).`,
  };
}
