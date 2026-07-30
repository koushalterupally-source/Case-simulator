import { PYQItem, SubjectType, RoleTag, ExamType } from '../types';

/**
 * Client-Side Offline Question Bank Parser
 * Parses pasted raw QBank text into structured PYQItem records using pattern matching.
 */
export function parseRawQBankTextOffline(rawText: string): PYQItem[] {
  if (!rawText || !rawText.trim()) return [];

  const parsedItems: PYQItem[] = [];
  // Split input into candidate question blocks (looking for numbers or QIDs)
  const blocks = rawText.split(/\n(?=(?:\d+[\.\)]|Q\d+|NEETPG|INICET|Question))/i);

  let qCounter = 1;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (trimmed.length < 20) continue;

    // Detect QID or generate standard
    let qid = `NEETPG-2023-${String(qCounter).padStart(3, '0')}`;
    let exam: ExamType = 'NEET-PG';
    let year: number | string = 2023;

    if (/INICET|INI-CET/i.test(trimmed)) {
      exam = 'INI-CET';
      qid = `INICET-2023-${String(qCounter).padStart(3, '0')}`;
    }

    const yearMatch = trimmed.match(/\b(201[5-9]|202[0-6])\b/);
    if (yearMatch) {
      year = parseInt(yearMatch[1]);
      qid = `${exam.replace('-', '')}-${year}-${String(qCounter).padStart(3, '0')}`;
    }

    // Extract options A, B, C, D
    const optA = trimmed.match(/(?:A[\.\)]\s*|\(A\)\s*)(.*?)(?=(?:B[\.\)]|\(B\)|C[\.\)]|\(C\)|D[\.\)]|\(D\)|Ans|Answer|$))/i);
    const optB = trimmed.match(/(?:B[\.\)]\s*|\(B\)\s*)(.*?)(?=(?:C[\.\)]|\(C\)|D[\.\)]|\(D\)|Ans|Answer|$))/i);
    const optC = trimmed.match(/(?:C[\.\)]\s*|\(C\)\s*)(.*?)(?=(?:D[\.\)]|\(D\)|Ans|Answer|$))/i);
    const optD = trimmed.match(/(?:D[\.\)]\s*|\(D\)\s*)(.*?)(?=(?:Ans|Answer|Explanation|$))/i);

    // Extract Answer
    let correctAnswer: 'A' | 'B' | 'C' | 'D' = 'A';
    const ansMatch = trimmed.match(/(?:Ans|Answer|Key)[\:\s]*([A-D])/i);
    if (ansMatch) {
      correctAnswer = ansMatch[1].toUpperCase() as 'A' | 'B' | 'C' | 'D';
    }

    // Extract Subject / System / Role Tag heuristics
    let subject: SubjectType = 'Medicine';
    if (/surgery|append|trauma|hernia|fracture|burn|abdomen/i.test(trimmed)) subject = 'Surgery';
    else if (/preeclampsia|eclampsia|gestation|uterus|ovary|labor|pregnancy/i.test(trimmed)) subject = 'OBGY';
    else if (/pediatric|child|infant|malnutrition|sam|resomal|newborn/i.test(trimmed)) subject = 'Pediatrics';
    else if (/drug|toxicity|dose|mechanism|colistin|antibiotic/i.test(trimmed)) subject = 'Pharmacology';
    else if (/vaccine|prevention|epidemiology|psm|splenectomy/i.test(trimmed)) subject = 'PSM';

    let roleTag: RoleTag = 'DIAGNOSIS';
    if (/investigation|test|gold standard|imaging|ctpa|ecg|xray/i.test(trimmed)) roleTag = 'INVESTIGATION';
    else if (/management|drug of choice|treatment|procedure|first step|intubation/i.test(trimmed)) roleTag = 'MANAGEMENT';
    else if (/emergency|stat|shock|tension|resuscitation|unstable/i.test(trimmed)) roleTag = 'EMERGENCY';
    else if (/vaccine|prophylaxis|screening|counseling/i.test(trimmed)) roleTag = 'PREVENTION';
    else if (/toxicity|side effect|dose|pharmacology/i.test(trimmed)) roleTag = 'PHARM';

    // Extract Stem
    let stem = trimmed;
    const optionStartIndex = trimmed.search(/(?:A[\.\)]|\(A\))/i);
    if (optionStartIndex > 0) {
      stem = trimmed.slice(0, optionStartIndex).replace(/^\d+[\.\)]\s*/, '').trim();
    }

    parsedItems.push({
      qid,
      exam,
      year,
      subject,
      system: subject,
      topic: stem.slice(0, 40) + '...',
      stem: stem || trimmed.slice(0, 120),
      options: {
        A: optA ? optA[1].trim() : 'Option A',
        B: optB ? optB[1].trim() : 'Option B',
        C: optC ? optC[1].trim() : 'Option C',
        D: optD ? optD[1].trim() : 'Option D',
      },
      correctAnswer,
      conceptTested: `High-yield ${subject} concept tested in ${qid}`,
      roleTag,
    });

    qCounter++;
  }

  return parsedItems;
}
