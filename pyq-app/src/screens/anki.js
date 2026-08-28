/**
 * Anki Spaced Repetition Flashcard Screen
 * Interactive medical flashcards with 3D card flips, high-yield pearls, and rating intervals.
 *
 * Two deck sources, selectable via the pills at the top:
 *  - "High-Yield Deck": the 40 curated cards below, filterable by subject.
 *  - "From Your Mistakes": built at runtime from the `mistakes` + `bookmarks` stores, resolved to
 *    full questions the same way review.js does (see `resolveQuestions`, imported from there).
 *
 * Ratings are real: each Again/Hard/Good/Easy press runs the card through srs.js's scheduler and
 * persists the result to the `srs` store keyed by questionId. Only cards that are actually due
 * are shown, soonest-due first; a card just rated drops out of the current session's queue
 * immediately (it won't reappear until it's due again, which for a fresh Good/Easy press is not
 * this session). The due-filtering, ordering, and mistake-record de-duplication are pure logic —
 * see src/anki-deck.js and tests/anki.test.mjs.
 */

import * as store from '../store.js';
import * as data from '../data.js';
import { el, html, clear, optionKey } from '../dom.js';
import { resolveQuestions } from './review.js';
import {
  RATINGS,
  formatInterval,
  previewIntervals,
  nextStateFor,
  selectDueCards,
  formatDueEta,
  collectMistakeRecords,
  toMistakeCard,
  curatedToCard,
} from '../anki-deck.js';

const ANKI_DECKS = [
  { id: 'anki_01', subject: 'Medicine', front: 'What is the diagnostic triad of Normal Pressure Hydrocephalus (NPH)?', back: 'Triad: Wet, Wacky, Wobbly\n1. Urinary Incontinence\n2. Dementia / Cognitive Decline\n3. Gait Apraxia (Magnetic Gait)\n\nHigh-Yield Pearl: Large-volume lumbar puncture is both diagnostic and therapeutic (Miller Fisher Test).', tag: 'Neurology' },
  { id: 'anki_02', subject: 'Medicine', front: 'What are the ECG findings of hyperkalemia?', back: '1. Tall peaked T waves\n2. Prolonged PR interval\n3. Widened QRS complex\n4. Sine wave pattern (severe)\n\nPearl: IV Calcium gluconate is given first to stabilize the myocardium.', tag: 'Cardiology' },
  { id: 'anki_03', subject: 'Medicine', front: 'What is the classic triad of reactive arthritis?', back: '1. Urethritis (can\'t pee)\n2. Conjunctivitis (can\'t see)\n3. Arthritis (can\'t climb a tree)\n\nPearl: HLA-B27 positive, usually follows Chlamydia or GI infection (Shigella, Salmonella).', tag: 'Rheumatology' },
  { id: 'anki_04', subject: 'Surgery', front: 'What is Charcot\'s Triad and Reynolds\' Pentad in Acute Cholangitis?', back: 'Charcot\'s Triad: Right upper quadrant pain + Jaundice + Fever with chills.\n\nReynolds\' Pentad: Charcot\'s Triad + Hypotension (Shock) + Altered Mental Status.\n\nTreatment: Urgent biliary decompression (ERCP) + IV broad-spectrum antibiotics.', tag: 'GI Surgery' },
  { id: 'anki_05', subject: 'Surgery', front: 'What is the most common benign tumor of the liver?', back: 'Cavernous Hemangioma.\n\nPearl: Biopsy is contraindicated due to risk of severe hemorrhage. Diagnosed via MRI or contrast CT showing peripheral-to-central enhancement.', tag: 'Hepatobiliary' },
  { id: 'anki_06', subject: 'Surgery', front: 'What are the branches of the celiac trunk?', back: '1. Left Gastric Artery\n2. Splenic Artery\n3. Common Hepatic Artery\n\nPearl: Supplies foregut structures.', tag: 'Vascular' },
  { id: 'anki_07', subject: 'Pharmacology', front: 'What is the Drug of Choice (DOC) for Paroxysmal Supraventricular Tachycardia (PSVT)?', back: 'Drug of Choice: IV Adenosine (rapid bolus 6mg, followed by 12mg if needed).\n\nMechanism: Activates A1 adenosine receptors -> opens K+ channels -> slows AV nodal conduction.\nContraindication: Bronchial asthma / severe COPD.', tag: 'Cardiology' },
  { id: 'anki_08', subject: 'Pharmacology', front: 'What is the antidote for Paracetamol (Acetaminophen) toxicity?', back: 'N-acetylcysteine (NAC).\n\nMechanism: Replenishes glutathione stores in the liver to neutralize the toxic NAPQI metabolite.', tag: 'Toxicology' },
  { id: 'anki_09', subject: 'Pharmacology', front: 'Which anti-TB drug causes red-orange discoloration of bodily fluids?', back: 'Rifampin.\n\nPearl: It induces CYP450 enzymes. Warn patients about orange urine, sweat, and tears (can stain contact lenses).', tag: 'Infectious' },
  { id: 'anki_10', subject: 'Pathology', front: 'What is the pathognomonic biopsy finding in Asbestosis?', back: 'Asbestos Bodies / Ferruginous Bodies\n(Golden-brown dumbbell-shaped beaded rods coated with iron and protein, stain positive with Prussian blue).\n\nKey Association: Malignant Mesothelioma (calretinin positive) & Bronchogenic Carcinoma (most common tumor).', tag: 'Pulmonology' },
  { id: 'anki_11', subject: 'Pathology', front: 'What do Councilman bodies represent?', back: 'Apoptotic hepatocytes, seen typically in viral hepatitis (e.g., Yellow Fever) or toxic liver injury.\n\nPearl: Eosinophilic globules on H&E stain.', tag: 'GI' },
  { id: 'anki_12', subject: 'Anatomy', front: 'What structure is at risk of injury during surgical ligation of the Superior Thyroid Artery?', back: 'External branch of the Superior Laryngeal Nerve (innervates the Cricothyroid muscle -> regulates vocal cord tension / pitch).\n\nInjury leads to: Loss of high-pitched voice and vocal fatigue.\n(Note: Inferior thyroid artery ligation risks the Recurrent Laryngeal Nerve).', tag: 'Head & Neck' },
  { id: 'anki_13', subject: 'Anatomy', front: 'Which dermatome is at the level of the umbilicus?', back: 'T10.\n\nPearl: "T10 for belly button". T4 is at the nipple line. L1 is at the inguinal ligament.', tag: 'Neurology' },
  { id: 'anki_14', subject: 'Anatomy', front: 'What nerve is injured in Erb-Duchenne palsy?', back: 'Upper trunk of the brachial plexus (C5-C6 roots).\n\nPearl: Presents as "waiter\'s tip" position: arm adducted, medially rotated, extended, and pronated.', tag: 'Upper Limb' },
  { id: 'anki_15', subject: 'Physiology', front: 'What is the effect of Aldosterone on the kidney?', back: 'Acts on the principal cells of the collecting duct to:\n1. Increase Na+ reabsorption (and thus water)\n2. Increase K+ secretion\n3. Increase H+ secretion (via alpha-intercalated cells)', tag: 'Renal' },
  { id: 'anki_16', subject: 'Physiology', front: 'What shifts the oxygen-hemoglobin dissociation curve to the right?', back: '"CADET face Right"\nC = pCO2 increase\nA = Acidosis (decreased pH)\nD = 2,3-DPG increase\nE = Exercise\nT = Temperature increase\n\nPearl: Right shift means decreased affinity, facilitating oxygen unloading to tissues.', tag: 'Respiratory' },
  { id: 'anki_17', subject: 'Biochemistry', front: 'What enzyme is deficient in McArdle Disease (Glycogen Storage Disease Type V)?', back: 'Enzyme Deficient: Muscle Glycogen Phosphorylase (Myophosphorylase).\n\nClinical Presentation: Painful muscle cramps, exercise intolerance, second-wind phenomenon, myoglobinuria (burgundy urine after strenuous exercise).\nBlood test: Failure of blood lactate to rise after ischemic forearm exercise.', tag: 'Metabolism' },
  { id: 'anki_18', subject: 'Biochemistry', front: 'What is the rate-limiting enzyme of glycolysis?', back: 'Phosphofructokinase-1 (PFK-1).\n\nPearl: Activated by AMP and Fructose-2,6-bisphosphate; inhibited by ATP and citrate.', tag: 'Carbohydrates' },
  { id: 'anki_19', subject: 'Microbiology', front: 'What is the hallmark microscopic feature of Rabies viral infection?', back: 'Negri Bodies\n(Eosinophilic, sharply demarcated, intracytoplasmic inclusions found in the pyramidal cells of the hippocampus and Purkinje cells of the cerebellum).', tag: 'Virology' },
  { id: 'anki_20', subject: 'Microbiology', front: 'Which organism classically shows a "safety pin" appearance on Gram stain?', back: 'Yersinia pestis.\n\nPearl: Bipolar staining. Causes bubonic plague, transmitted by rat fleas.', tag: 'Bacteriology' },
  { id: 'anki_21', subject: 'OBGY', front: 'What is the diagnostic ultrasound sign of a Complete Hydatidiform Mole?', back: '"Snowstorm" or "Bunch of Grapes" appearance on pelvic ultrasound (vesicular echogenic mass without fetal parts).\n\nKaryotype: 46,XX (90%) — androgenetic origin.\nTumor Marker: Markedly elevated serum beta-hCG (>100,000 mIU/mL).', tag: 'Obstetrics' },
  { id: 'anki_22', subject: 'OBGY', front: 'What is the most common cause of postpartum hemorrhage?', back: 'Uterine Atony (boggy uterus).\n\nPearl: Management involves fundal massage, Oxytocin, Methylergonovine (avoid in HTN), Carboprost (avoid in asthma), or Misoprostol.', tag: 'Obstetrics' },
  { id: 'anki_23', subject: 'OBGY', front: 'What is the triad of endometriosis?', back: '1. Dysmenorrhea\n2. Dyspareunia\n3. Dyschezia (painful defecation) / Infertility\n\nPearl: Classic "chocolate cysts" in ovaries.', tag: 'Gynecology' },
  { id: 'anki_24', subject: 'Pediatrics', front: 'What are the classic radiographic signs in (A) Croup and (B) Epiglottitis?', back: 'A) Croup (Laryngotracheobronchitis):\n-> Steeple Sign (subglottic tracheal narrowing on AP X-ray).\n\nB) Acute Epiglottitis:\n-> Thumbprint Sign (swollen epiglottis on Lateral Neck X-ray).\n\nEtiology: Croup = Parainfluenza; Epiglottitis = H. influenzae type b.', tag: 'Pediatrics' },
  { id: 'anki_25', subject: 'Pediatrics', front: 'What is the most common cause of congenital hypothyroidism?', back: 'Thyroid dysgenesis (agenesis, hypoplasia, or ectopic tissue).\n\nPearl: Presents with lethargy, large fontanelles, protruding tongue, umbilical hernia.', tag: 'Endocrine' },
  { id: 'anki_26', subject: 'Pediatrics', front: 'What is the triad of intussusception?', back: '1. Colicky abdominal pain\n2. "Currant jelly" stools\n3. Palpable sausage-shaped abdominal mass\n\nPearl: Target sign on ultrasound.', tag: 'GI' },
  { id: 'anki_27', subject: 'Ophthalmology', front: 'What does a "cherry-red spot" on the macula signify?', back: 'Central Retinal Artery Occlusion (CRAO) or Tay-Sachs/Niemann-Pick disease.\n\nPearl: In CRAO, it\'s accompanied by sudden, painless monocular vision loss.', tag: 'Retina' },
  { id: 'anki_28', subject: 'Ophthalmology', front: 'What is a Marcus Gunn pupil?', back: 'An Afferent Pupillary Defect (RAPD).\n\nPearl: When light is swung from the normal eye to the affected eye, both pupils appear to dilate instead of constrict. Often seen in optic neuritis (MS).', tag: 'Neuro-Ophtho' },
  { id: 'anki_29', subject: 'ENT', front: 'What is the triad of Meniere\'s disease?', back: '1. Episodic vertigo\n2. Sensorineural hearing loss\n3. Tinnitus (or aural fullness).\n\nPearl: Due to endolymphatic hydrops.', tag: 'Otology' },
  { id: 'anki_30', subject: 'ENT', front: 'What is a Bezold abscess?', back: 'A complication of coalescent mastoiditis where infection tracks through the mastoid tip into the sternocleidomastoid muscle sheath.\n\nPearl: Presents as a neck mass below the mastoid.', tag: 'Otology' },
  { id: 'anki_31', subject: 'Ortho', front: 'What is the classic X-ray finding in Ewing sarcoma?', back: '"Onion skin" periosteal reaction.\n\nPearl: Aggressive diaphysis tumor in children, associated with t(11;22) translocation.', tag: 'Tumors' },
  { id: 'anki_32', subject: 'Ortho', front: 'What does the Garden classification assess?', back: 'Femoral neck fractures.\n\nPearl: Higher grades (III, IV) are displaced and have a high risk of avascular necrosis of the femoral head, often requiring arthroplasty.', tag: 'Trauma' },
  { id: 'anki_33', subject: 'PSM', front: 'What is the difference between Case Fatality Rate and Cause-Specific Mortality Rate?', back: 'Case Fatality Rate = (Deaths from disease X / Total cases of disease X) * 100.\n\nMortality Rate = (Deaths from disease X / Total population) * 1000.', tag: 'Epidemiology' },
  { id: 'anki_34', subject: 'PSM', front: 'What is the formula for calculating positive predictive value (PPV)?', back: 'PPV = True Positives / (True Positives + False Positives)\n\nPearl: PPV is highly dependent on the prevalence of the disease in the population.', tag: 'Biostats' },
  { id: 'anki_35', subject: 'Dermatology', front: 'What is Nikolsky\'s sign, and in which blistering diseases is it positive vs negative?', back: 'Nikolsky\'s Sign: Dislodgement of superficial epidermis by gentle lateral pressure.\n\nPositive (Intraepidermal split): Pemphigus vulgaris (anti-desmoglein 3/1), SSSS, TEN.\n\nNegative (Subepidermal split): Bullous Pemphigoid (anti-BP180 / BP230)', tag: 'Dermatology' },
  { id: 'anki_36', subject: 'Dermatology', front: 'What is the Auspitz sign?', back: 'Pinpoint bleeding upon removal of scales from a plaque.\n\nPearl: Pathognomonic for Psoriasis (due to dilated capillaries in the dermal papillae).', tag: 'Dermatology' },
  { id: 'anki_37', subject: 'Psychiatry', front: 'What are the core features of Lewy Body Dementia?', back: '1. Visual hallucinations\n2. Parkinsonism (often preceded by cognitive decline)\n3. Fluctuating cognition\n4. REM sleep behavior disorder', tag: 'Cognitive' },
  { id: 'anki_38', subject: 'Psychiatry', front: 'What is the timeline for diagnosing Schizophrenia?', back: 'Symptoms must be present for at least 6 months.\n\nPearl: <1 month = Brief Psychotic Disorder.\n1-6 months = Schizophreniform Disorder.', tag: 'Psychosis' },
  { id: 'anki_39', subject: 'Radiology', front: 'What does a "ground-glass opacity" on HRCT suggest?', back: 'Partial filling of alveoli or interstitial thickening without obscuring the underlying pulmonary vessels.\n\nPearl: Seen in ARDS, PCP pneumonia, hypersensitivity pneumonitis, and COVID-19.', tag: 'Chest' },
  { id: 'anki_40', subject: 'Forensic Medicine', front: 'How is Rigor Mortis timed?', back: 'Starts in 1-2 hours (involves eyelids/jaw first), peaks at 12 hours, and passes off by 24-36 hours.\n\nPearl: Used to estimate time since death.', tag: 'Thanatology' },
  { id: 'anki_41', subject: 'Anaesthesia', front: 'What is the Mallampati score used for?', back: 'Predicting the ease of endotracheal intubation based on the visibility of the base of the uvula, faucial pillars, and soft palate.\n\nPearl: Class 1 = full visibility (easy); Class 4 = only hard palate visible (difficult).', tag: 'Airway' }
];

/* -------------------------------------------------------------------------- deck-source pills */

const DECK_SOURCES = [
  { key: 'curated', label: 'High-Yield Deck' },
  { key: 'mistakes', label: 'From Your Mistakes' },
];

/* --------------------------------------------------------------------------------- screen state */

let deckSource = 'curated';
let selectedSubject = 'ALL';
let sessionQueue = []; // due cards for the current deck/filter, soonest-due first
let currentCardIndex = 0;
let isFlipped = false;
let completedCount = 0;
let lastMeta = null; // { totalRecords, totalResolved, resolveError, nextDueAt, now } from the last paint()
let loadToken = 0; // guards against a stale async paint() clobbering a newer one

export async function show(root) {
  deckSource = 'curated';
  selectedSubject = 'ALL';
  sessionQueue = [];
  currentCardIndex = 0;
  isFlipped = false;
  lastMeta = null;

  try {
    const saved = await store.get('ankiProgress', 'count');
    if (saved && typeof saved.value === 'number') {
      completedCount = saved.value;
    }
  } catch (err) {
    console.warn('Failed to load anki progress', err);
  }

  await paint(root);
}

/* ------------------------------------------------------------------------- loading the deck */

/** Build the "from your mistakes" deck's raw card list (before due-filtering). */
async function loadMistakeCards() {
  let mistakeRecords = [];
  let bookmarkRecords = [];
  try {
    mistakeRecords = await store.getAll('mistakes');
  } catch (err) {
    console.warn('anki: could not read mistakes', err);
  }
  try {
    bookmarkRecords = await store.getAll('bookmarks');
  } catch (err) {
    console.warn('anki: could not read bookmarks', err);
  }

  const records = collectMistakeRecords(mistakeRecords, bookmarkRecords);
  if (records.length === 0) return { cards: [], totalRecords: 0, totalResolved: 0 };

  let catalog;
  try {
    catalog = await data.loadCatalog();
  } catch (err) {
    console.warn('anki: could not load catalog to resolve mistakes', err);
    return { cards: [], totalRecords: records.length, totalResolved: 0, error: true };
  }

  let resolved;
  try {
    resolved = await resolveQuestions(catalog, records);
  } catch (err) {
    console.warn('anki: could not resolve mistake/bookmark questions', err);
    return { cards: [], totalRecords: records.length, totalResolved: 0, error: true };
  }

  const cards = [];
  for (const r of records) {
    const q = resolved.get(r.questionId);
    if (!q) continue; // unresolved (paper/group gone, shard failed) — skip silently, per spec
    cards.push(toMistakeCard(r, q));
  }
  return { cards, totalRecords: records.length, totalResolved: cards.length };
}

/** Load the current deck source, apply due-filtering, and paint. */
async function paint(root) {
  const token = ++loadToken;
  clear(root);
  setTitle('Anki High-Yield Deck');
  root.appendChild(el('div', { class: 'spinner' }));

  const now = Date.now();
  let cards;
  let totalRecords;
  let totalResolved;
  let resolveError = null;

  if (deckSource === 'curated') {
    const raw = selectedSubject === 'ALL' ? ANKI_DECKS : ANKI_DECKS.filter((c) => c.subject === selectedSubject);
    cards = raw.map(curatedToCard);
    totalRecords = totalResolved = cards.length;
  } else {
    const built = await loadMistakeCards();
    if (token !== loadToken) return; // a newer paint() superseded this one
    cards = built.cards;
    totalRecords = built.totalRecords;
    totalResolved = built.totalResolved;
    resolveError = built.error || null;
  }

  let srsRecords = [];
  try {
    srsRecords = await store.getAll('srs');
  } catch (err) {
    console.warn('anki: could not read srs state', err);
  }
  if (token !== loadToken) return;

  const srsById = new Map(srsRecords.map((s) => [s.questionId, s]));
  const { dueCards, nextDueAt } = selectDueCards(cards, srsById, now);

  sessionQueue = dueCards;
  if (currentCardIndex >= sessionQueue.length) currentCardIndex = 0;

  lastMeta = { totalRecords, totalResolved, resolveError, nextDueAt, now };
  renderView(root);
}

/* ---------------------------------------------------------------------------------- rendering */

function renderView(root) {
  clear(root);
  setTitle('Anki High-Yield Deck');

  const container = el('div', { class: 'screen screen--anki' });

  const deckLabel = deckSource === 'curated' ? 'Medical Spaced Repetition' : 'From Your Mistakes';
  const subtitle =
    deckSource === 'curated'
      ? `${sessionQueue.length} due now · ${completedCount} Reviewed`
      : `${sessionQueue.length} due now · ${lastMeta.totalResolved} in deck · ${completedCount} Reviewed`;

  const header = el('div', { class: 'anki-header' }, [
    el('div', {}, [
      el('div', { class: 'anki-header__title', text: `📇 ${deckLabel}` }),
      el('div', { class: 'anki-header__sub', text: subtitle }),
    ]),
    el('div', {
      class: 'anki-badge',
      text: sessionQueue.length ? `Card ${currentCardIndex + 1} / ${sessionQueue.length}` : '0 / 0',
    }),
  ]);
  container.appendChild(header);

  const sourcePills = el(
    'div',
    { class: 'filter-pills' },
    DECK_SOURCES.map((d) =>
      el(
        'button',
        {
          class: `filter-pill ${deckSource === d.key ? 'filter-pill--active' : ''}`,
          type: 'button',
          onclick: () => {
            if (deckSource === d.key) return;
            deckSource = d.key;
            selectedSubject = 'ALL';
            currentCardIndex = 0;
            isFlipped = false;
            paint(root);
          },
        },
        [el('span', { text: d.label })]
      )
    )
  );
  container.appendChild(sourcePills);

  if (deckSource === 'curated') {
    const subjects = ['ALL', ...Array.from(new Set(ANKI_DECKS.map((c) => c.subject)))];
    const pills = el(
      'div',
      { class: 'filter-pills' },
      subjects.map((sub) =>
        el(
          'button',
          {
            class: `filter-pill ${selectedSubject === sub ? 'filter-pill--active' : ''}`,
            type: 'button',
            onclick: () => {
              if (selectedSubject === sub) return;
              selectedSubject = sub;
              currentCardIndex = 0;
              isFlipped = false;
              paint(root);
            },
          },
          [el('span', { text: sub === 'ALL' ? 'All Subjects' : sub })]
        )
      )
    );
    container.appendChild(pills);
  }

  const card = sessionQueue[currentCardIndex];

  if (!card) {
    container.appendChild(renderEmptyState());
    root.appendChild(container);
    return;
  }

  container.appendChild(renderFlashcard(root, card));
  container.appendChild(isFlipped ? renderRatingBar(root, card) : renderRevealBar(root));

  root.appendChild(container);
}

function renderEmptyState() {
  const meta = lastMeta || {};

  if (deckSource === 'mistakes' && meta.resolveError) {
    return el('div', { class: 'empty' }, [
      el('span', { class: 'empty__icon', text: '⚠️' }),
      el('p', { text: 'Could not load the question bank to build this deck right now.' }),
    ]);
  }
  if (deckSource === 'mistakes' && meta.totalRecords === 0) {
    return el('div', { class: 'empty' }, [
      el('span', { class: 'empty__icon', text: '🔖' }),
      el('p', {
        text: 'No mistakes or bookmarks yet — wrong answers from practice and starred questions will show up here.',
      }),
    ]);
  }
  if (deckSource === 'mistakes' && meta.totalResolved === 0) {
    return el('div', { class: 'empty' }, [
      el('span', { class: 'empty__icon', text: '🔍' }),
      el('p', { text: 'None of your saved mistakes or bookmarks could be found in the current question bank.' }),
    ]);
  }

  if (meta.nextDueAt != null) {
    return el('div', { class: 'empty' }, [
      el('span', { class: 'empty__icon', text: '🎉' }),
      el('p', {
        text: `All caught up! Next card is due ${formatDueEta(meta.nextDueAt, meta.now)} (${new Date(
          meta.nextDueAt
        ).toLocaleString()}).`,
      }),
    ]);
  }

  return el('div', { class: 'empty' }, [
    el('span', { class: 'empty__icon', text: '🎉' }),
    el('p', {
      text:
        deckSource === 'curated'
          ? 'All cards in this deck completed! Select another subject to continue.'
          : 'All caught up on your mistakes and bookmarks!',
    }),
  ]);
}

function renderFlashcard(root, card) {
  const frontContent = el('div', { class: 'anki-card__content' });
  if (card.kind === 'mistake') {
    const prompt = el('div', { class: 'anki-card__prompt qtext' });
    html(prompt, card.front);
    frontContent.appendChild(prompt);
  } else {
    frontContent.appendChild(el('div', { class: 'anki-card__prompt', text: card.front }));
  }

  const backContent = el('div', { class: 'anki-card__content' });
  if (card.kind === 'mistake') {
    const answerWrap = el('div', {
      class: 'anki-card__answer',
      style: { maxHeight: '380px', overflowY: 'auto' },
    });
    answerWrap.appendChild(
      el('div', {
        style: { fontWeight: '700', marginBottom: '10px' },
        text: `Correct answer: ${optionKey(card.correctIndex)}. ${card.optionText}`,
      })
    );
    if (card.hasExplanation) {
      const body = el('div', { class: 'explain__body' });
      html(body, card.detail);
      answerWrap.appendChild(
        el('div', { class: 'explain' }, [el('div', { class: 'explain__head', text: 'Explanation' }), body])
      );
    } else {
      // 27% of the corpus has no real explanation. Say so rather than showing an empty panel.
      answerWrap.appendChild(
        el('div', { class: 'explain explain--stub' }, [
          el('div', { class: 'explain__head', text: 'No explanation in the source' }),
          el('div', { text: card.short || `The answer is ${optionKey(card.correctIndex)}.` }),
        ])
      );
    }
    backContent.appendChild(answerWrap);
  } else {
    backContent.appendChild(el('div', { class: 'anki-card__answer', text: card.back }));
  }

  return el(
    'div',
    {
      class: `anki-card ${isFlipped ? 'anki-card--flipped' : ''}`,
      onclick: () => {
        isFlipped = !isFlipped;
        renderView(root);
      },
    },
    [
      el('div', { class: 'anki-card__side anki-card__front' }, [
        el('div', { class: 'anki-card__meta' }, [
          el('span', { class: 'chip chip--subject', text: card.subject }),
          el('span', { class: 'chip chip--topic', text: card.tag }),
          el('span', { class: 'anki-card__hint', text: 'Tap to flip' }),
        ]),
        frontContent,
        el('div', { class: 'anki-card__footer' }, [
          el('span', {
            text:
              card.kind === 'mistake'
                ? '🔄 Tap anywhere to reveal the answer'
                : '🔄 Tap anywhere to reveal High-Yield Pearl',
          }),
        ]),
      ]),
      el('div', { class: 'anki-card__side anki-card__back' }, [
        el('div', { class: 'anki-card__meta' }, [
          el('span', { class: 'chip chip--subject', text: card.subject }),
          el('span', {
            class: 'chip chip--exam',
            text: card.kind === 'mistake' ? '✅ Correct Answer' : '⭐ High-Yield Answer',
          }),
          el('span', { class: 'anki-card__hint', text: 'Tap to flip back' }),
        ]),
        backContent,
      ]),
    ]
  );
}

function renderRatingBar(root, card) {
  const intervals = previewIntervals(card.srsState, Date.now());
  return el(
    'div',
    { class: 'anki-ratings' },
    RATINGS.map((r) =>
      el(
        'button',
        {
          class: `anki-btn ${r.cls}`,
          type: 'button',
          onclick: (e) => {
            e.stopPropagation();
            rateCard(root, card, r.key);
          },
        },
        [
          el('div', { class: 'anki-btn__label', text: r.label }),
          el('div', { class: 'anki-btn__interval', text: formatInterval(intervals[r.key]) }),
        ]
      )
    )
  );
}

function renderRevealBar(root) {
  return el('div', { class: 'anki-reveal-bar' }, [
    el('button', {
      class: 'btn btn--primary',
      type: 'button',
      style: { width: '100%', maxWidth: '320px', margin: '0 auto' },
      text: 'Show Answer / Pearl',
      onclick: () => {
        isFlipped = true;
        renderView(root);
      },
    }),
  ]);
}

/* --------------------------------------------------------------------------------- rating */

async function rateCard(root, card, ratingKey) {
  const now = Date.now();
  const nextState = nextStateFor(card.srsState, ratingKey, now);

  try {
    await store.put('srs', { questionId: card.id, ...nextState });
  } catch (err) {
    console.warn('anki: could not save srs state', err);
  }

  completedCount += 1;
  try {
    await store.put('ankiProgress', { id: 'count', value: completedCount });
  } catch (err) {
    console.warn('anki: could not save anki progress', err);
  }

  // A card that isn't due yet must not keep reappearing in this session: drop it from the
  // in-memory queue now rather than recomputing due-ness against a clock that keeps advancing.
  const idx = sessionQueue.findIndex((c) => c.id === card.id);
  if (idx !== -1) sessionQueue.splice(idx, 1);
  if (currentCardIndex >= sessionQueue.length) currentCardIndex = Math.max(0, sessionQueue.length - 1);
  isFlipped = false;

  renderView(root);
}

function setTitle(text) {
  const t = document.getElementById('appbar-title');
  if (t) t.textContent = text;
}
