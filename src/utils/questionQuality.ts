import { PYQItem } from '../types';

/**
 * Question-bank hygiene.
 *
 * The bank is imported from real exam papers, and some of what comes across is
 * not usable as a decision gate no matter how well it matches the case. This
 * module decides what to keep and cleans up what it keeps.
 */

/**
 * Questions that cannot be answered because the thing being asked about is a
 * picture, and no picture ships with the bank.
 *
 * "Identify the organism stained with India Ink stain?" is a fair exam question
 * when the plate is in front of you. In this app it is four options and no way
 * to choose between them, so putting it at a decision gate asks the user to
 * guess and then tells them they were wrong. 142 of the 8,211 shipped questions
 * are like this.
 */
const IMAGE_DEPENDENT = [
  /\b(?:this|these|the (?:given|following|above|below|shown))\b[^.?]{0,40}\b(?:image|picture|photograph|photo|x-?ray|radiograph|scan|ct|mri|usg|slide|specimen|instrument|apparatus|graph|ecg|ekg|tracing|figure|diagram|chart)\b/i,
  /\bidentify the\b/i,
  /\bwhat (?:is|does) (?:this|the given|the following)\b/i,
  /\b(?:shown|seen|depicted|marked|labell?ed) (?:in|on) the (?:figure|image|picture|diagram|photograph|slide)\b/i,
  /\bthe (?:arrow|marked structure)\b/i,
];

export function isImageDependent(stem: string): boolean {
  return IMAGE_DEPENDENT.some((re) => re.test(stem || ''));
}

/**
 * Exam provenance stamped into the question text — "(INICET MAY 2019)",
 * "(NEET PG 2021)". 940 of the shipped stems carry one.
 *
 * It belongs in the item's metadata, which already has `exam` and `year`
 * fields, not in the sentence the patient's doctor is reading. Stripped for
 * display only; the underlying record keeps its provenance.
 */
const EXAM_TAG =
  /\s*[([]\s*(?:INI-?CET|NEET-?PG|NEET|AIIMS|JIPMER|PGI|FMGE|DNB|UPSC)[^)\]]*[)\]]\s*$/i;

export function cleanStem(stem: string): string {
  return (stem || '').replace(EXAM_TAG, '').trim();
}

/**
 * Whether a question can stand as a decision gate at all.
 *
 * Deliberately narrow: it rejects what is unusable, not what is merely
 * imperfect. Topical relevance is the binder's job, not this function's.
 */
export function isUsableAsGate(pyq: PYQItem): boolean {
  if (!pyq) return false;
  if (pyq.correctAnswer === 'ANSWER-NOT-IN-SOURCE' || pyq.isDraft) return false;

  const stem = cleanStem(pyq.stem);
  // A stem this short is a fragment, not a question. 285 shipped items are
  // under 25 characters, typically truncated during import.
  if (stem.length < 25) return false;
  if (isImageDependent(stem)) return false;

  const opts = pyq.options || ({} as PYQItem['options']);
  const values = (['A', 'B', 'C', 'D'] as const).map((k) => (opts[k] || '').trim());
  if (values.some((v) => !v)) return false;
  // All-identical options cannot be a question.
  if (new Set(values.map((v) => v.toLowerCase())).size < 2) return false;

  return true;
}
