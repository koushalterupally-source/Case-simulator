import { PYQItem, SubjectType, RoleTag, ExamType } from '../types';

export interface ParseQBankResult {
  parsedItems: PYQItem[];
  skippedBlocksCount: number;
  missingAnswerCount: number;
}

/**
 * Extracts options A, B, C, D reliably from text block using clean string indexing
 */
function extractOptionsFromBlock(block: string): { A: string; B: string; C: string; D: string } {
  const options = { A: '', B: '', C: '', D: '' };

  const findMarkerIndex = (text: string, letter: string): number => {
    const patterns = [`(${letter})`, `${letter}.`, `${letter})`, `${letter}:` ];
    let minIdx = -1;
    for (const p of patterns) {
      const idx = text.indexOf(p);
      if (idx !== -1 && (minIdx === -1 || idx < minIdx)) {
        minIdx = idx;
      }
    }
    return minIdx;
  };

  const idxA = findMarkerIndex(block, 'A');
  const idxB = findMarkerIndex(block, 'B');
  const idxC = findMarkerIndex(block, 'C');
  const idxD = findMarkerIndex(block, 'D');

  if (idxA !== -1 && idxB !== -1 && idxC !== -1 && idxD !== -1 && idxA < idxB && idxB < idxC && idxC < idxD) {
    options.A = block.slice(idxA + 2, idxB).trim().replace(/^[.)\:]\s*/, '');
    options.B = block.slice(idxB + 2, idxC).trim().replace(/^[.)\:]\s*/, '');
    options.C = block.slice(idxC + 2, idxD).trim().replace(/^[.)\:]\s*/, '');

    // End of D
    const ansIdx = block.search(/(?:Ans|Answer|Key|Explanation|Concept)/i);
    if (ansIdx > idxD) {
      options.D = block.slice(idxD + 2, ansIdx).trim().replace(/^[.)\:]\s*/, '');
    } else {
      options.D = block.slice(idxD + 2).trim().replace(/^[.)\:]\s*/, '');
    }
  } else {
    // Fallback regex using string construction
    const regA = new RegExp('(?:\\(A\\)|A[\\.\\)\\:]|1[\\.\\)])\\s*([\\s\\S]*?)(?=(?:\\(B\\)|B[\\.\\)\\:]|2[\\.\\)]|Ans|$))', 'i');
    const regB = new RegExp('(?:\\(B\\)|B[\\.\\)\\:]|2[\\.\\)])\\s*([\\s\\S]*?)(?=(?:\\(C\\)|C[\\.\\)\\:]|3[\\.\\)]|Ans|$))', 'i');
    const regC = new RegExp('(?:\\(C\\)|C[\\.\\)\\:]|3[\\.\\)])\\s*([\\s\\S]*?)(?=(?:\\(D\\)|D[\\.\\)\\:]|4[\\.\\)]|Ans|$))', 'i');
    const regD = new RegExp('(?:\\(D\\)|D[\\.\\)\\:]|4[\\.\\)])\\s*([\\s\\S]*?)(?=(?:Ans|Answer|Key|Explanation|$))', 'i');

    const mA = block.match(regA);
    const mB = block.match(regB);
    const mC = block.match(regC);
    const mD = block.match(regD);

    options.A = mA ? mA[1].trim() : 'Option A';
    options.B = mB ? mB[1].trim() : 'Option B';
    options.C = mC ? mC[1].trim() : 'Option C';
    options.D = mD ? mD[1].trim() : 'Option D';
  }

  return options;
}

/**
 * Offline Question Bank Parser
 * Parses pasted raw QBank text into structured PYQItem records using pattern matching.
 * NEVER guesses the correct answer if not explicitly present in the source.
 */
export function parseRawQBankTextOffline(rawText: string, existingIndex: PYQItem[] = []): ParseQBankResult {
  if (!rawText || !rawText.trim()) {
    return { parsedItems: [], skippedBlocksCount: 0, missingAnswerCount: 0 };
  }

  const existingQIDs = new Set(existingIndex.map((q) => q.qid));
  const parsedItems: PYQItem[] = [];
  let skippedBlocksCount = 0;
  let missingAnswerCount = 0;

  // Global Answer Key Map
  const globalAnswerKeyMap = new Map<number, 'A' | 'B' | 'C' | 'D'>();
  const answerKeySectionMatch = rawText.match(/(?:Answer\s*Key|Key\s*List|Answers\:\n)[\s\S]*$/i);
  if (answerKeySectionMatch) {
    const keySection = answerKeySectionMatch[0];
    const globalKeyMatches = keySection.matchAll(/(?:Q|Question|\b)(\d+)[\s\.\:\)-]+([A-D])\b/gi);
    for (const m of globalKeyMatches) {
      const qNum = parseInt(m[1]);
      const ans = m[2].toUpperCase() as 'A' | 'B' | 'C' | 'D';
      if (qNum > 0 && qNum < 1000) {
        globalAnswerKeyMap.set(qNum, ans);
      }
    }
  }

  // Split raw text into question blocks
  const blockReg = new RegExp('\\n(?=(?:\\d+[\\.\\)]|Q\\d+[\\.\\:\\)]|NEETPG|INICET|Question\\s*\\d+))', 'i');
  const blocks = rawText.split(blockReg);

  let autoQCounter = existingIndex.length + 1;

  for (let idx = 0; idx < blocks.length; idx++) {
    const block = blocks[idx].trim();
    if (block.length < 25) {
      if (block.length > 0) skippedBlocksCount++;
      continue;
    }

    const qNumMatch = block.match(/^(?:Q|Question\s*)?(\d+)[.\):]/i);
    const qNum = qNumMatch ? parseInt(qNumMatch[1]) : null;

    let exam: ExamType = 'NEET-PG';
    if (/INICET|INI-CET/i.test(block)) {
      exam = 'INI-CET';
    } else if (/CUSTOM/i.test(block)) {
      exam = 'CUSTOM';
    }

    let year: number | string = 2023;
    const yearMatch = block.match(/\b(201[5-9]|202[0-6])\b/);
    if (yearMatch) {
      year = parseInt(yearMatch[1]);
    }

    let qid = `${exam.replace('-', '')}-${year}-${String(autoQCounter).padStart(3, '0')}`;
    while (existingQIDs.has(qid)) {
      autoQCounter++;
      qid = `${exam.replace('-', '')}-${year}-${String(autoQCounter).padStart(3, '0')}`;
    }

    const options = extractOptionsFromBlock(block);

    let correctAnswer: 'A' | 'B' | 'C' | 'D' | 'ANSWER-NOT-IN-SOURCE' = 'ANSWER-NOT-IN-SOURCE';
    const ansInBlockMatch = block.match(/(?:Ans|Answer|Correct\s*Option|Key)[\:\s\*-]*([A-D])\b/i);
    if (ansInBlockMatch) {
      correctAnswer = ansInBlockMatch[1].toUpperCase() as 'A' | 'B' | 'C' | 'D';
    } else if (qNum !== null && globalAnswerKeyMap.has(qNum)) {
      correctAnswer = globalAnswerKeyMap.get(qNum)!;
    }

    if (correctAnswer === 'ANSWER-NOT-IN-SOURCE') {
      missingAnswerCount++;
    }

    let explanation = '';
    const expMatch = block.match(/(?:Explanation|Exp|Rationale)[\:\s\*-]*([\s\S]*?)(?=(?:\n\s*(?:Question|Q\d+)|$))/i);
    if (expMatch) {
      explanation = expMatch[1].trim();
    }

    let conceptTested = '';
    const conceptMatch = block.match(/(?:Concept\s*Tested|Concept|Key\s*Point)[\:\s\*-]*([^\n]+)/i);
    if (conceptMatch) {
      conceptTested = conceptMatch[1].trim();
    } else if (explanation) {
      conceptTested = explanation.split('.')[0].slice(0, 100);
    }

    let subject: SubjectType = 'Medicine';
    if (/surgery|append|trauma|hernia|fracture|burn|laparoscopy|incision/i.test(block)) subject = 'Surgery';
    else if (/preeclampsia|eclampsia|gestation|uterus|ovary|labor|pregnancy|primigravida/i.test(block)) subject = 'OBGY';
    else if (/pediatric|child|infant|malnutrition|sam|resomal|newborn|neonate/i.test(block)) subject = 'Pediatrics';
    else if (/drug|toxicity|dose|mechanism|colistin|pharmacology/i.test(block)) subject = 'Pharmacology';
    else if (/vaccine|prevention|epidemiology|psm|splenectomy|immunization/i.test(block)) subject = 'PSM';
    else if (/pathology|biopsy|smear|histology|ferritin|anemia/i.test(block)) subject = 'Pathology';

    let roleTag: RoleTag = 'DIAGNOSIS';
    if (/investigation|test|gold standard|imaging|ctpa|ecg|xray|ultrasound/i.test(block)) roleTag = 'INVESTIGATION';
    else if (/management|drug of choice|treatment|procedure|first step|intubation|surgery/i.test(block)) roleTag = 'MANAGEMENT';
    else if (/emergency|stat|shock|tension|resuscitation|unstable|seizure/i.test(block)) roleTag = 'EMERGENCY';
    else if (/vaccine|prophylaxis|screening|counseling/i.test(block)) roleTag = 'PREVENTION';
    else if (/toxicity|side effect|dose|pharmacology/i.test(block)) roleTag = 'PHARM';

    let stem = block;
    const optAIdx = block.search(/(?:\(A\)|A[.\):]|1[.\)])/i);
    if (optAIdx > 0) {
      stem = block.slice(0, optAIdx).replace(/^(?:Q|Question\s*)?\d+[.\):]\s*/i, '').trim();
    } else {
      stem = block.replace(/^(?:Q|Question\s*)?\d+[.\):]\s*/i, '').trim();
    }

    const topicMatch = block.match(/(?:Topic|Category|System)[\:\s\*-]*([^\n]+)/i);
    const topic = topicMatch ? topicMatch[1].trim() : `${subject} Clinical Scenario`;

    const pyqItem: PYQItem = {
      qid,
      exam,
      year,
      subject,
      system: subject,
      topic,
      stem: stem || 'Clinical stem not formatted properly.',
      options,
      correctAnswer,
      conceptTested,
      roleTag,
      explanation: explanation || undefined,
      isDraft: !conceptTested || correctAnswer === 'ANSWER-NOT-IN-SOURCE',
    };

    parsedItems.push(pyqItem);
    existingQIDs.add(qid);
    autoQCounter++;
  }

  return {
    parsedItems,
    skippedBlocksCount,
    missingAnswerCount,
  };
}

export function exportQBankToJSON(qbank: PYQItem[]): string {
  return JSON.stringify({ version: '1.0', exportDate: new Date().toISOString(), items: qbank }, null, 2);
}

export function importQBankFromJSON(jsonStr: string): PYQItem[] {
  try {
    const data = JSON.parse(jsonStr);
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.items)) return data.items;
    throw new Error('Invalid QBank JSON structure.');
  } catch (err) {
    throw new Error('Failed to parse JSON file: ' + (err as Error).message);
  }
}
