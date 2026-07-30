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

    narrative = `[DECISION GATE COMMITTED]: ${isCorrect ? '✅ Correct decision' : isSelfReview ? '🔍 Self-review required' : '❌ Suboptimal commitment'}. ${consequence}`;

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
        const newLoc = (locMatch[1].charAt(0).toUpperCase() + locMatch[1].slice(1).toLowerCase()) as LocationType;
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
      const orderName = userCommand.replace(/^(?:order\:|give|start|administer|order)\s*/i, '').trim();
      timeSpentMins = 5;

      // Look up order in scaffold investigations map
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
      let isIndicative = false;

      if (matchedKey) {
        const item = scaffold.investigationsMap[matchedKey];
        resultText = item.resultText;
        turnaround = item.turnaroundMinutes;
        category = item.category;
        isIndicative = item.isIndicative;
      } else {
        // Not modeled in scaffold - express honestly!
        resultText = `Result for "${orderName}": Not modeled in this specific clinical case scenario.`;
        turnaround = 20;
        category = 'labs';
        isIndicative = false;
      }

      const readySimTimeObj = addMinutesToSimTime(updatedSession.simTime, turnaround);
      const readySimTimeStr = formatSimTime(readySimTimeObj);

      const newOrder: OrderResultItem = {
        id: `ord_${Date.now()}_${Math.random()}`,
        orderName,
        category,
        placedSimTime: formatSimTime(updatedSession.simTime),
        readySimTime: readySimTimeStr,
        isReady: false,
        resultText,
        turnaroundMinutes: turnaround,
      };

      updatedSession.pendingOrders.push(newOrder);

      // Check incidental finding triggers
      updatedSession.incidentalFindings.forEach((inc) => {
        if (inc.status === 'unnoticed') {
          if (orderLower.includes('usg') || orderLower.includes('ultrasound') || orderLower.includes('ct') || orderLower.includes('cxr') || orderLower.includes('xray') || orderLower.includes('vaccine') || orderLower.includes('tdap')) {
            inc.status = 'noticed_addressed';
          }
        }
      });

      narrative = `Order placed: "${orderName}". Turnaround time: ${turnaround} mins (Ready @ ${readySimTimeStr}).`;
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

  // 5. Evaluate Trajectory & Patient Deterioration
  const allPlaced = [...updatedSession.completedOrders, ...updatedSession.pendingOrders];
  const totalElapsedMinutes = currentTotalMinutes - simTimeToMinutes({ day: 1, hour: 9, minute: 0 });

  scaffold.criticalInterventions.forEach((critical) => {
    const executed = allPlaced.some((o) => critical.orderOrActionPattern.test(o.orderName));
    if (!executed && totalElapsedMinutes > critical.targetMilestoneMinutes) {
      // Deteriorate vitals!
      updatedSession.patient.currentVitals.hr = Math.min(180, updatedSession.patient.currentVitals.hr + 4);
      updatedSession.patient.currentVitals.spo2 = Math.max(70, updatedSession.patient.currentVitals.spo2 - 2);
      narrative += ` ⚠️ [CLINICAL DETERIORATION]: ${critical.name} delayed past target window (${critical.targetMilestoneMinutes} min)! Tachycardia and hypoxia worsening.`;
    } else if (executed) {
      // Improve vitals
      updatedSession.patient.currentVitals.hr = Math.max(72, updatedSession.patient.currentVitals.hr - 2);
      updatedSession.patient.currentVitals.spo2 = Math.min(99, updatedSession.patient.currentVitals.spo2 + 1);
    }
  });

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
    (o) => `⚠️ ${o.orderName}: Unindicated test ordered (${o.turnaroundMinutes} min turnaround delay added).`
  );

  // Critical Delays
  const currentTotalMins = simTimeToMinutes(session.simTime);
  const totalElapsedMinutes = currentTotalMins - simTimeToMinutes({ day: 1, hour: 9, minute: 0 });
  const criticalDelays: string[] = [];

  scaffold.criticalInterventions.forEach((crit) => {
    const placed = allOrders.find((o) => crit.orderOrActionPattern.test(o.orderName));
    if (!placed && totalElapsedMinutes > crit.targetMilestoneMinutes) {
      criticalDelays.push(`⚠️ ${crit.name}: Not performed within target milestone window (${crit.targetMilestoneMinutes} min).`);
    }
  });

  // Incidental Findings Report
  const incidentalReport = session.incidentalFindings.map((inc) => ({
    title: inc.title,
    outcome: inc.description,
    status: inc.status,
    scoreNote:
      inc.status === 'noticed_addressed'
        ? '✅ Addressed correctly with standard recommendation (+10 pts)'
        : '⚠️ Noticed but unaddressed or missed',
  }));

  const addressedIncCount = session.incidentalFindings.filter((i) => i.status === 'noticed_addressed').length;

  // Top concepts to revise (missed gates)
  const missedGates = gateResults.filter((g) => !g.isCorrect);
  const topConceptsToRevise = missedGates.slice(0, 3).map((m) => ({
    concept: m.concept,
    sourceQIDs: [m.qid],
  }));

  // Calculate Overall Score
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
