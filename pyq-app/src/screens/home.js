/**
 * Home screen — the app's front door.
 *
 * Reads only from the stores; loading a catalog or a shard belongs to the screens the grid links
 * to, not here. Every number on this screen must degrade to a sensible zero rather than NaN or a
 * thrown error, since this is the one screen guaranteed to render on a completely fresh install
 * with every store empty.
 *
 * Routing note: this screen navigates by name only ('tests', 'practice', 'gt', 'practice-resume')
 * and leaves resolving those names to app.js's router — exactly like gt-screen.js navigating to
 * 'analysis' with a bare sessionId. 'practice-resume' is the screen app.js's router already wires
 * to `store.get('sessions', sessionId)` followed by `practiceScreen.resume(root, session)`.
 */

import * as store from '../store.js';
import * as ui from '../ui.js';
import { el, clear, pct } from '../dom.js';

const APP_NAME = 'PYQ';
const TAGLINE = 'Previous-year questions & clinical cases, offline on your terms.';

const DAILY_QUOTES = [
  { quote: 'The good physician treats the disease; the great physician treats the patient who has the disease.', author: 'Sir William Osler' },
  { quote: 'Wherever the art of Medicine is loved, there is also a love of Humanity.', author: 'Hippocrates' },
  { quote: 'Medicine is a science of uncertainty and an art of probability.', author: 'Sir William Osler' },
  { quote: 'In the field of observation, chance favors only the prepared mind.', author: 'Louis Pasteur' },
  { quote: 'Better is possible. It does not take genius. It takes diligence and moral clarity.', author: 'Dr. Atul Gawande' },
  { quote: 'To study the phenomena of disease without books is to sail an uncharted sea; to study books without patients is not to go to sea at all.', author: 'Sir William Osler' },
  { quote: 'Observation, Reason, Human Understanding, Courage; these make the physician.', author: 'Dr. Martin H. Fischer' },
  { quote: 'The secret of the care of the patient is in caring for the patient.', author: 'Dr. Francis W. Peabody' },
  { quote: 'Cure sometimes, treat often, comfort always.', author: 'Dr. Edward L. Trudeau' },
  { quote: 'We are what we repeatedly do. Excellence, then, is not an act, but a habit.', author: 'Aristotle' },
  { quote: 'Every question practiced today is a patient saved tomorrow.', author: 'Clinical Adage' },
  { quote: 'Perseverance is not a long race; it is many short races one after the other.', author: 'Walter Elliot' },
];

const DAILY_QUESTIONS = [
  { id: 'qod_01', subject: 'Medicine', exam: 'NEET-PG High Yield', question: 'A 55-year-old male with a history of acute anterior MI presents 3 weeks later with sharp, pleuritic chest pain that worsens on lying supine and improves on leaning forward. Pericardial friction rub is heard. What is the most likely diagnosis?', options: ['Dressler Syndrome (Post-MI Pericarditis)', 'Myocardial Reinfarction', 'Ventricular Free Wall Rupture', 'Acute Papillary Muscle Rupture'], correct: 0, pearl: 'Dressler syndrome is an autoimmune pericarditis developing 2 to 10 weeks post-MI. Treatment: High-dose Aspirin + Colchicine.' },
  { id: 'qod_02', subject: 'Medicine', exam: 'NEET-PG High Yield', question: 'A patient with bilateral diffuse alveolar infiltrates on CXR has a PaO2/FiO2 ratio of 150 mmHg. PCWP is 12 mmHg. According to Berlin criteria, what is the severity of ARDS?', options: ['Mild', 'Moderate', 'Severe', 'Not ARDS'], correct: 1, pearl: 'Berlin criteria: Mild (200-300), Moderate (100-200), Severe (<100) with PEEP >= 5cmH2O.' },
  { id: 'qod_03', subject: 'Medicine', exam: 'NEET-PG High Yield', question: 'A diabetic patient presents with blood glucose of 800 mg/dL, pH 7.35, and negative serum ketones. What is the diagnosis?', options: ['DKA', 'HHS', 'Lactic acidosis', 'Alcoholic ketoacidosis'], correct: 1, pearl: 'HHS presents with severe hyperglycemia (>600 mg/dL) and high serum osmolality without significant ketoacidosis.' },
  { id: 'qod_04', subject: 'Medicine', exam: 'NEET-PG High Yield', question: 'A young patient with Kayser-Fleischer rings presents with chorea and altered behavior. Which serum finding is most expected?', options: ['Elevated ceruloplasmin', 'Decreased ceruloplasmin', 'Elevated copper', 'Normal ceruloplasmin'], correct: 1, pearl: 'Wilson disease is characterized by decreased serum ceruloplasmin and elevated urinary copper.' },
  { id: 'qod_05', subject: 'Medicine', exam: 'NEET-PG High Yield', question: 'A 25-year-old female presents with malar rash, joint pain, and proteinuria. Which of the following antibodies is most specific for her condition?', options: ['Anti-ANA', 'Anti-dsDNA', 'Anti-Ro', 'Anti-La'], correct: 1, pearl: 'Anti-dsDNA and Anti-Sm are highly specific for SLE.' },
  { id: 'qod_06', subject: 'Surgery', exam: 'NEET-PG High Yield', question: 'A patient presents with fever, jaundice, and RUQ pain. What is the diagnosis?', options: ['Acute cholecystitis', 'Acute cholangitis', 'Acute pancreatitis', 'Hepatitis'], correct: 1, pearl: "Charcot's triad (fever, jaundice, RUQ pain) is diagnostic for acute cholangitis." },
  { id: 'qod_07', subject: 'Surgery', exam: 'NEET-PG High Yield', question: 'Which of the following is associated with increased intracranial pressure?', options: ['Curling ulcer', 'Cushing ulcer', 'Marginal ulcer', 'Dieulafoy lesion'], correct: 1, pearl: 'Cushing ulcer is a gastric ulcer associated with elevated ICP. Curling ulcers are associated with severe burns.' },
  { id: 'qod_08', subject: 'Surgery', exam: 'NEET-PG High Yield', question: "What is NOT a component of Virchow's triad?", options: ['Endothelial injury', 'Venous stasis', 'Hypercoagulability', 'Hypertension'], correct: 3, pearl: "Virchow's triad for thrombosis includes: endothelial injury, stasis, and hypercoagulability." },
  { id: 'qod_09', subject: 'Surgery', exam: 'NEET-PG High Yield', question: 'Which criteria are used to assess the severity of acute pancreatitis on admission?', options: ['Ranson criteria', 'Duke criteria', 'Jones criteria', 'Light criteria'], correct: 0, pearl: 'Ranson criteria evaluate severity of acute pancreatitis; includes age, WBC, glucose, AST, and LDH.' },
  { id: 'qod_10', subject: 'Pharmacology', exam: 'NEET-PG High Yield', question: 'Which of the following antimicrobial agents causes Gray Baby Syndrome due to deficient hepatic glucuronidation in neonates?', options: ['Chloramphenicol', 'Ceftriaxone', 'Gentamicin', 'Tetracycline'], correct: 0, pearl: 'Chloramphenicol in neonates causes Gray Baby Syndrome due to immature UDP-glucuronyl transferase and reduced renal clearance.' },
  { id: 'qod_11', subject: 'Pharmacology', exam: 'NEET-PG High Yield', question: 'A patient on MAO inhibitors eats aged cheese and develops a hypertensive crisis. What causes this?', options: ['Tyramine', 'Tryptophan', 'Phenylalanine', 'Histamine'], correct: 0, pearl: 'Cheese reaction: Tyramine in aged cheese is not metabolized by MAO, causing massive catecholamine release.' },
  { id: 'qod_12', subject: 'Pharmacology', exam: 'NEET-PG High Yield', question: 'Which drug is known to cause drug-induced lupus with positive anti-histone antibodies?', options: ['Hydralazine', 'Aspirin', 'Penicillin', 'Metoprolol'], correct: 0, pearl: 'Hydralazine, Procainamide, and Isoniazid frequently cause drug-induced lupus (Anti-histone antibodies +).' },
  { id: 'qod_13', subject: 'Pathology', exam: 'NEET-PG High Yield', question: 'A lung biopsy from a shipyard worker shows golden-brown dumbbell-shaped bodies. What is the diagnosis?', options: ['Asbestosis', 'Silicosis', 'Coal worker pneumoconiosis', 'Berylliosis'], correct: 0, pearl: 'Ferruginous bodies are asbestos fibers coated with iron and protein, characteristic of asbestosis.' },
  { id: 'qod_14', subject: 'Pathology', exam: 'NEET-PG High Yield', question: 'Which of the following describes Reed-Sternberg cells?', options: ['Owl-eye nuclei', 'Coffee-bean nuclei', 'Orphan Annie eye nuclei', 'Smudge cells'], correct: 0, pearl: 'Reed-Sternberg cells in Hodgkin lymphoma have bilobed nuclei with prominent eosinophilic nucleoli (owl-eye appearance).' },
  { id: 'qod_15', subject: 'Pathology', exam: 'NEET-PG High Yield', question: 'Call-Exner bodies are seen in which ovarian tumor?', options: ['Granulosa cell tumor', 'Brenner tumor', 'Dysgerminoma', 'Yolk sac tumor'], correct: 0, pearl: 'Call-Exner bodies (rosette-like structures with eosinophilic centers) are characteristic of Granulosa cell tumors.' },
  { id: 'qod_16', subject: 'Anatomy', exam: 'NEET-PG High Yield', question: 'Which nerve is at risk in a mid-shaft humerus fracture?', options: ['Axillary nerve', 'Radial nerve', 'Median nerve', 'Ulnar nerve'], correct: 1, pearl: 'The radial nerve runs in the spiral groove and is frequently injured in mid-shaft humerus fractures, causing wrist drop.' },
  { id: 'qod_17', subject: 'Anatomy', exam: 'NEET-PG High Yield', question: 'What are the boundaries of the Triangle of Doom in inguinal hernia repair?', options: ['Vas deferens, gonadal vessels, peritoneal fold', 'Inferior epigastric vessels, inguinal ligament, rectus abdominis', 'Inguinal ligament, sartorius, adductor longus', 'None of the above'], correct: 0, pearl: 'Triangle of Doom is bounded by vas deferens medially, gonadal vessels laterally; contains external iliac vessels.' },
  { id: 'qod_18', subject: 'Physiology', exam: 'NEET-PG High Yield', question: 'According to the Frank-Starling law of the heart, the force of contraction depends on:', options: ['Heart rate', 'End-diastolic volume', 'Afterload', 'Stroke volume'], correct: 1, pearl: 'The Frank-Starling law states that the stroke volume increases in response to an increase in the volume of blood filling the heart (EDV).' },
  { id: 'qod_19', subject: 'Physiology', exam: 'NEET-PG High Yield', question: 'What is the principal determinant of resting membrane potential?', options: ['Sodium leak channels', 'Potassium leak channels', 'Calcium channels', 'Chloride channels'], correct: 1, pearl: 'Resting membrane potential is primarily determined by potassium leak channels and can be calculated using the Nernst equation.' },
  { id: 'qod_20', subject: 'Biochemistry', exam: 'NEET-PG High Yield', question: 'Von Gierke disease is caused by a deficiency of:', options: ['Glucose-6-phosphatase', 'Acid maltase', 'Debranching enzyme', 'Branching enzyme'], correct: 0, pearl: 'Type I Glycogen Storage Disease (Von Gierke) is due to Glucose-6-phosphatase deficiency, leading to severe fasting hypoglycemia.' },
  { id: 'qod_21', subject: 'Microbiology', exam: 'NEET-PG High Yield', question: 'Sulfur granules in exudate are characteristic of infection with:', options: ['Actinomyces israelii', 'Nocardia asteroides', 'Staphylococcus aureus', 'Mycobacterium tuberculosis'], correct: 0, pearl: 'Actinomyces causes cervicofacial infections with draining sinus tracts containing yellow sulfur granules.' },
  { id: 'qod_22', subject: 'OBGY', exam: 'NEET-PG High Yield', question: 'Which parameter is NOT part of the Bishop score?', options: ['Cervical dilation', 'Cervical effacement', 'Fetal station', 'Fetal heart rate'], correct: 3, pearl: 'Bishop score assesses cervical readiness for induction: Dilation, Effacement, Station, Consistency, Position.' },
  { id: 'qod_23', subject: 'Pediatrics', exam: 'NEET-PG High Yield', question: 'The Kasai procedure is performed for which condition?', options: ['Biliary atresia', 'Intussusception', 'Pyloric stenosis', 'Hirschsprung disease'], correct: 0, pearl: 'Hepatoportoenterostomy (Kasai procedure) is the surgical treatment for biliary atresia in infants.' },
  { id: 'qod_24', subject: 'Ophthalmology', exam: 'NEET-PG High Yield', question: 'A patient presents with sudden painless loss of vision. Fundoscopy shows a cherry-red spot at the macula. Diagnosis?', options: ['CRAO', 'CRVO', 'Retinal detachment', 'Macular degeneration'], correct: 0, pearl: 'Central Retinal Artery Occlusion (CRAO) typically presents with sudden painless vision loss and a cherry-red spot on the macula.' },
  { id: 'qod_25', subject: 'ENT', exam: 'NEET-PG High Yield', question: 'Gradenigo syndrome consists of otitis media, deep facial pain, and paralysis of which cranial nerve?', options: ['CN V', 'CN VI', 'CN VII', 'CN VIII'], correct: 1, pearl: 'Gradenigo syndrome (petrous apicitis) triad: Otorrhea, retro-orbital pain (CN V1), and ipsilateral abducens nerve (CN VI) palsy.' },
  { id: 'qod_26', subject: 'Ortho', exam: 'NEET-PG High Yield', question: 'Codman triangle on X-ray is most commonly associated with:', options: ['Osteosarcoma', 'Ewing sarcoma', 'Osteoid osteoma', 'Chondrosarcoma'], correct: 0, pearl: 'Codman triangle represents periosteal elevation and is a classic finding in aggressive bone tumors like Osteosarcoma.' },
  { id: 'qod_27', subject: 'PSM', exam: 'NEET-PG High Yield', question: 'The proportion of disease cases that die from the condition is called:', options: ['Case fatality rate', 'Mortality rate', 'Morbidity rate', 'Prevalence'], correct: 0, pearl: 'Case fatality rate indicates the severity of a disease, calculating the percentage of patients with the disease who die from it.' },
  { id: 'qod_28', subject: 'Dermatology', exam: 'NEET-PG High Yield', question: 'Auspitz sign (pinpoint bleeding upon removal of scales) is characteristic of:', options: ['Psoriasis', 'Lichen planus', 'Pityriasis rosea', 'Eczema'], correct: 0, pearl: 'Auspitz sign represents the exposure of dermal papillae when the overlying parakeratotic scales of a psoriatic plaque are scraped off.' },
  { id: 'qod_29', subject: 'Psychiatry', exam: 'NEET-PG High Yield', question: "Which of the following is one of Schneider's first-rank symptoms of schizophrenia?", options: ['Visual hallucinations', 'Thought broadcasting', 'Apathy', 'Anhedonia'], correct: 1, pearl: 'Thought insertion, withdrawal, broadcasting, and auditory hallucinations commenting on behavior are first-rank symptoms.' },
  { id: 'qod_30', subject: 'Radiology', exam: 'NEET-PG High Yield', question: 'A tree-in-bud appearance on HRCT of the chest typically indicates:', options: ['Endobronchial spread of infection', 'Pulmonary embolism', 'Interstitial fibrosis', 'Emphysema'], correct: 0, pearl: 'Tree-in-bud pattern is highly suggestive of small airway disease, classically endobronchial spread of TB or other infections.' },
  { id: 'qod_31', subject: 'Forensic Medicine', exam: 'NEET-PG High Yield', question: 'Cadaveric spasm most commonly occurs in:', options: ['Death after sudden exhaustion', 'Poisoning', 'Drowning', 'Hanging'], correct: 0, pearl: 'Cadaveric spasm is an instantaneous rigor mortis that occurs at the time of death, often in cases involving extreme emotional or physical stress before death.' },
  { id: 'qod_32', subject: 'Anaesthesia', exam: 'NEET-PG High Yield', question: 'A patient with mild systemic disease without functional limitations belongs to which ASA class?', options: ['ASA I', 'ASA II', 'ASA III', 'ASA IV'], correct: 1, pearl: 'ASA II patients have mild systemic disease (e.g., controlled HTN, non-insulin dependent diabetes) without substantive functional limitations.' }
];

let activeQuoteIndex = Math.floor((Date.now() / (1000 * 60 * 60 * 24)) % DAILY_QUOTES.length);
let activeQodIndex = Math.floor((Date.now() / (1000 * 60 * 60 * 24)) % DAILY_QUESTIONS.length);
let qodAnswerState = { answered: false, chosen: null };

export async function show(root) {
  clear(root);
  setTitle(APP_NAME);

  const [sessions, results, attempts, mistakes, bookmarks] = await Promise.all([
    safeGetAll('sessions'),
    safeGetAll('results'),
    safeGetAll('attempts'),
    safeGetAll('mistakes'),
    safeGetAll('bookmarks'),
  ]);

  const unfinished = pickUnfinished(sessions);

  root.appendChild(
    el('div', { class: 'screen screen--home' }, [
      // 1. Top Quote of the Day
      quoteCard(),

      // 2. Question of the Day (QOD)
      qodCard(),

      // Resume Active Session (if any)
      unfinished ? heroTile(unfinished) : null,

      // 3. Primary Navigation Options to the 5 Core Areas
      el('div', { class: 'section-title', text: 'Navigation & Study Modes' }, []),
      el('div', { class: 'grid grid--marrow' }, [
        // 1) QBank (Arrow / Cereb / PYQs - Subject Wise)
        marrowCard('📚', '1) QBank', 'ARROW / CEREB / PYQs with 19 Subject-Wise breakdowns', '49,293 Qs', 'badge--blue', () => ui.navigate('practice')),
        // 2) Tests
        marrowCard('📝', '2) Tests', '165 Full-Length Grand Tests under NBE exam conditions', '165 Tests', 'badge--emerald', () => ui.navigate('tests')),
        // 3) Analytics
        marrowCard('📊', '3) Analytics', 'Subject accuracy breakdown, speed metrics & mistake review', 'Diagnostics', 'badge--purple', () => ui.navigate('stats')),
        // 4) Anki
        marrowCard('📇', '4) Anki Flashcards', 'High-Yield Medical Spaced Repetition Decks & Pearls', 'Spaced Recall', 'badge--amber', () => ui.navigate('anki')),
        // 5) Clinical Case Simulator
        marrowCard('🩺', '5) Case Simulator', 'Emergency room case management with vitals & ICU decisions', 'Live Sim', 'badge--cyan', () => ui.navigate('cases')),
        // Review Mistake Book
        marrowCard('⭐', '6) Mistake Book', 'Instant revision for all bookmarked and incorrect attempts', `${mistakes.length} Mistakes`, 'badge--rose', () => ui.navigate('review')),
      ]),

      // Stats Summary Bar
      statsStrip({ results, attempts, mistakes, bookmarks }),
    ].filter(Boolean))
  );
}

function setTitle(text) {
  const t = document.getElementById('appbar-title');
  if (t) t.textContent = text;
}

async function safeGetAll(name) {
  try {
    return await store.getAll(name);
  } catch (err) {
    console.warn(`home: could not read store "${name}"`, err);
    return [];
  }
}

function pickUnfinished(sessions) {
  const running = sessions.filter((s) => s && s.status === 'running');
  if (running.length === 0) return null;
  running.sort((a, b) => (b.updatedAt || b.startedAt || 0) - (a.updatedAt || a.startedAt || 0));
  return running[0];
}

function quoteCard() {
  const q = DAILY_QUOTES[activeQuoteIndex % DAILY_QUOTES.length];
  const quoteText = el('p', { class: 'quote__text', text: `“${q.quote}”` });
  const quoteAuthor = el('span', { class: 'quote__author', text: `— ${q.author}` });

  const card = el('div', { class: 'quote-card' }, [
    el('div', { class: 'quote-card__header' }, [
      el('span', { class: 'quote-card__tag', text: '💡 QUOTE OF THE DAY' }),
      el('button', {
        class: 'quote-card__btn',
        type: 'button',
        'aria-label': 'Next Quote',
        title: 'Shuffle Quote',
        onclick: (e) => {
          e.stopPropagation();
          activeQuoteIndex = (activeQuoteIndex + 1) % DAILY_QUOTES.length;
          const next = DAILY_QUOTES[activeQuoteIndex];
          quoteText.textContent = `“${next.quote}”`;
          quoteAuthor.textContent = `— ${next.author}`;
        },
      }, [el('span', { text: '↻' })]),
    ]),
    quoteText,
    quoteAuthor,
  ]);

  return card;
}

function qodCard() {
  const qod = DAILY_QUESTIONS[activeQodIndex % DAILY_QUESTIONS.length];
  const card = el('div', { class: 'qod-card' });

  function renderQod() {
    clear(card);
    card.appendChild(
      el('div', { class: 'qod-card__header' }, [
        el('div', { class: 'qod-card__title-row' }, [
          el('span', { class: 'qod-card__badge', text: '⚡ QUESTION OF THE DAY' }),
          el('span', { class: 'chip chip--subject', text: qod.subject }),
          el('span', { class: 'chip chip--exam', text: qod.exam }),
        ]),
        el('button', {
          class: 'quote-card__btn',
          type: 'button',
          title: 'Next Question',
          onclick: (e) => {
            e.stopPropagation();
            activeQodIndex = (activeQodIndex + 1) % DAILY_QUESTIONS.length;
            qodAnswerState = { answered: false, chosen: null };
            renderQod();
          },
        }, [el('span', { text: '↻' })]),
      ])
    );

    card.appendChild(el('div', { class: 'qod-card__stem', text: qod.question }));

    const optionList = el('div', { class: 'qod-card__options' }, qod.options.map((opt, i) => {
      let stateClass = '';
      let badge = '';
      if (qodAnswerState.answered) {
        if (i === qod.correct) {
          stateClass = 'option--correct';
          badge = '✓ Correct';
        } else if (i === qodAnswerState.chosen) {
          stateClass = 'option--wrong';
          badge = '✕ Your Choice';
        }
      }
      return el('button', {
        class: `qod-option ${stateClass}`,
        type: 'button',
        disabled: qodAnswerState.answered,
        onclick: () => {
          qodAnswerState = { answered: true, chosen: i };
          renderQod();
        },
      }, [
        el('span', { class: 'qod-option__key', text: String.fromCharCode(65 + i) }),
        el('span', { class: 'qod-option__text', text: opt }),
        badge ? el('span', { class: 'qod-option__badge', text: badge }) : null,
      ]);
    }));
    card.appendChild(optionList);

    if (qodAnswerState.answered) {
      const isCorrect = qodAnswerState.chosen === qod.correct;
      card.appendChild(
        el('div', { class: `qod-feedback ${isCorrect ? 'qod-feedback--correct' : 'qod-feedback--wrong'}` }, [
          el('div', { class: 'qod-feedback__head', text: isCorrect ? '🎉 Correct Answer!' : `💡 Correct Answer: (${String.fromCharCode(65 + qod.correct)}) ${qod.options[qod.correct]}` }),
          el('div', { class: 'qod-feedback__pearl', text: `⭐ Key Pearl: ${qod.pearl}` }),
        ])
      );
    }
  }

  renderQod();
  return card;
}

function statsStrip({ results, attempts, mistakes, bookmarks }) {
  const gtAttempted = results.reduce((sum, r) => sum + (r.attempted || 0), 0);
  const gtCorrect = results.reduce((sum, r) => sum + (r.correct || 0), 0);
  const prAttempted = attempts.length;
  const prCorrect = attempts.filter((a) => a && a.isCorrect).length;

  const totalAnswered = gtAttempted + prAttempted;
  const totalCorrect = gtCorrect + prCorrect;
  const accuracy = totalAnswered > 0 ? totalCorrect / totalAnswered : 0;

  return el('div', { class: 'stats' }, [
    stat(totalAnswered, 'Answered'),
    stat(pct(accuracy), 'Accuracy'),
    stat(results.length, 'Tests taken'),
    stat(mistakes.length, 'Mistakes'),
    bookmarks ? stat(bookmarks.length, 'Bookmarks') : null,
  ].filter(Boolean));
}

function stat(value, label) {
  return el('div', { class: 'stat' }, [
    el('div', { class: 'stat__value', text: String(value) }),
    el('div', { class: 'stat__label', text: label }),
  ]);
}

function heroTile(session) {
  if (!session) {
    return el(
      'button',
      { class: 'hero', type: 'button', onclick: () => ui.navigate('tests') },
      [
        el('div', {}, [
          el('div', { class: 'hero__title', text: 'Start a Grand Test' }),
          el('div', {
            class: 'hero__sub',
            text: 'Sit a full-length mock paper under exam conditions — timed, negative marking optional.',
          }),
        ]),
        el('div', { class: 'hero__icon', text: '🎯' }),
      ]
    );
  }

  const answered = Object.keys(session.answers || {}).length;
  const left = Math.max(0, (session.count || 0) - answered);
  const isGT = session.kind === 'gt';
  const label = isGT ? session.paperName || 'your test' : session.groupName || session.title || 'your set';

  return el(
    'button',
    {
      class: 'hero',
      type: 'button',
      onclick: () => ui.navigate(isGT ? 'gt' : 'practice-resume', { sessionId: session.id }),
    },
    [
      el('div', {}, [
        el('div', { class: 'hero__title', text: 'Resume where you left off' }),
        el('div', { class: 'hero__sub', text: `${label} · ${left} of ${session.count || 0} left` }),
      ]),
      el('div', { class: 'hero__icon', text: isGT ? '⏱️' : '📖' }),
    ]
  );
}

function marrowCard(icon, title, sub, badgeText, badgeClass, onClick) {
  return el('button', { class: 'marrow-card', type: 'button', onclick: onClick }, [
    el('div', { class: 'marrow-card__top' }, [
      el('span', { class: 'marrow-card__icon', text: icon }),
      el('span', { class: `marrow-card__badge ${badgeClass || ''}`, text: badgeText }),
    ]),
    el('div', { class: 'marrow-card__title', text: title }),
    el('div', { class: 'marrow-card__sub', text: sub }),
  ]);
}

function marrowSubCard(icon, title, sub, onClick) {
  return el('button', { class: 'marrow-card marrow-card--sub', type: 'button', onclick: onClick }, [
    el('div', { class: 'marrow-card__top' }, [
      el('span', { class: 'marrow-card__icon', text: icon }),
      el('span', { class: 'marrow-card__badge badge--cyan', text: 'Overview' }),
    ]),
    el('div', { class: 'marrow-card__title', text: title }),
    el('div', { class: 'marrow-card__sub', text: sub }),
  ]);
}

function navCard(icon, title, sub, onClickOrScreen) {
  const handler = typeof onClickOrScreen === 'function' ? onClickOrScreen : () => ui.navigate(onClickOrScreen);
  return el('button', { class: 'card', type: 'button', onclick: handler }, [
    el('span', { class: 'card__icon', text: icon }),
    el('div', { class: 'card__title', text: title }),
    el('div', { class: 'card__sub', text: sub }),
  ]);
}
