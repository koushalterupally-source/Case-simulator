/**
 * Clinical vocabulary for each authored case.
 *
 * The gate binder decides whether a question belongs in a case by looking for
 * words from the scaffold's `conditionName` in the question. That works only
 * when the exam happens to use the same words the scaffold does, and often it
 * does not: the entire 8,211-question bank contains the token "STEMI" exactly
 * zero times, so `scaffold_stemi` — the flagship cardiology case — bound no
 * decision gates at all and put the user in front of a patient with nothing to
 * decide. The questions were there the whole time; they say "myocardial
 * infarction".
 *
 * So each condition carries the words real exam questions actually use:
 *
 *   diagnosis  — synonyms for the condition itself. Naming one of these is as
 *                good as naming the condition, so each is worth a full
 *                diagnosis-level match and can bind a gate on its own.
 *   associated — investigations, drugs and findings that cluster around the
 *                condition. Supporting evidence only: their combined
 *                contribution is capped below the binding threshold, so a
 *                question that merely mentions troponin can never be dragged
 *                into a cardiology case on that alone. This cap is what keeps
 *                the old "meningitis case asks about STEMI thrombolysis" bug
 *                from coming back.
 *
 * Counts in the comments are occurrences in the shipped bank at the time of
 * writing, measured, not estimated. They are a sanity check that a term is
 * worth listing — a term with zero hits today may still be right for a larger
 * bank, but a list where everything is zero means the case will not bind.
 */

export interface ConditionVocabulary {
  /** Synonyms for the diagnosis itself. Each is worth a full condition match. */
  diagnosis: string[];
  /** Condition-specific investigations, drugs and findings. Supporting only. */
  associated: string[];
}

/**
 * The most an `associated` list may contribute. Kept deliberately below
 * MIN_CONDITION_MATCH so association alone never binds a gate.
 */
export const MAX_ASSOCIATED_SCORE = 2;

export const CONDITION_VOCABULARY: Record<string, ConditionVocabulary> = {
  scaffold_stemi: {
    // "stemi" itself: 0 hits. This case bound nothing before these aliases.
    diagnosis: [
      'myocardial infarction', // 6
      'st elevation', // 2
      'acute coronary syndrome',
      'anterior wall mi',
      'heart attack',
      'stemi',
    ],
    associated: ['troponin', 'coronary', 'thrombolysis', 'reperfusion', 'antiplatelet'], // 13, 13, 3, 1, 1
  },

  scaffold_pe: {
    diagnosis: [
      'pulmonary embolism', // 5
      'pulmonary thromboembolism',
      'deep vein thrombosis', // 1
      'venous thromboembolism',
    ],
    associated: ['embolism', 'heparin', 'd-dimer'], // 10, 12, 1
  },

  scaffold_dka: {
    diagnosis: [
      'ketoacidosis', // 7
      'diabetic ketoacidosis',
      'dka',
    ],
    // "insulin" (71) is deliberately absent: it is common to every diabetes
    // question and would pull unrelated endocrine pharmacology into the case.
    associated: ['ketone', 'anion gap', 'ketonuria'], // 9, 9
  },

  scaffold_eclampsia: {
    diagnosis: [
      'eclampsia', // 17
      'pre-eclampsia', // 12
      'preeclampsia', // 6
      'toxaemia of pregnancy',
    ],
    associated: ['magnesium sulphate', 'magnesium sulfate', 'hellp', 'proteinuria'], // 4, 5, 4, 1
  },

  scaffold_pneumothorax: {
    diagnosis: [
      'pneumothorax', // 17
      'tension pneumothorax',
      'collapsed lung',
    ],
    associated: ['chest tube', 'intercostal drain', 'thoracostomy', 'needle decompression'], // 1
  },

  scaffold_meningitis: {
    diagnosis: [
      'meningitis', // 9
      'meningeal', // 3
      'meningococc',
    ],
    associated: ['lumbar puncture', 'kernig', 'brudzinski', 'ceftriaxone'], // 1, 1, 5
  },

  scaffold_appendicitis: {
    diagnosis: [
      'appendicitis', // 5
      'appendicular',
      'appendix',
    ],
    associated: ['mcburney', 'alvarado', 'appendicectomy', 'appendectomy'], // 2, 2, 1, 1
  },

  scaffold_sam_shock: {
    // The scaffold name leans on "shock", which is far too common a word to
    // identify this case — it was binding generic shock questions instead of
    // paediatric malnutrition ones.
    diagnosis: [
      'severe acute malnutrition', // 8
      'malnutrition', // 24
      'marasmus', // 9
      'kwashiorkor', // 7
      'protein energy malnutrition',
    ],
    associated: ['resomal', 'wasting', 'stunting', 'f-75', 'f-100'], // 3, 1
  },

  scaffold_stroke: {
    diagnosis: [
      'stroke', // 10
      'cerebrovascular accident',
      'cerebrovascular', // 1
      'cerebral infarct',
      'middle cerebral artery',
    ],
    associated: ['thrombolysis', 'hemiplegia', 'middle cerebral', 'alteplase'], // 3, 2, 3
  },

  scaffold_ugib: {
    diagnosis: [
      'variceal', // 2
      'varices', // 1
      'oesophageal varices', // 1
      'esophageal varices',
      'haematemesis',
      'hematemesis', // 1
      'upper gi bleed',
    ],
    associated: ['portal hypertension', 'octreotide', 'terlipressin', 'melena', 'melaena'], // 1
  },

  scaffold_urosepsis: {
    diagnosis: [
      'urosepsis',
      'pyelonephritis', // 1
      'urinary tract infection', // 2
      'septic shock', // 2
    ],
    // "sepsis" alone (14) is supporting evidence, not a diagnosis of urosepsis.
    associated: ['sepsis', 'bacteriuria', 'urine culture'], // 14
  },

  scaffold_post_mi_comp: {
    diagnosis: [
      'ventricular septal', // 10
      'septal rupture',
      'papillary muscle',
      'free wall rupture',
      'myocardial infarction', // 6
    ],
    associated: ['cardiogenic shock', 'holosystolic murmur', 'pansystolic murmur'], // 2
  },
};
