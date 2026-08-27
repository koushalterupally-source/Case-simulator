/**
 * Anki Spaced Repetition Flashcard Screen
 * Interactive medical flashcards with 3D card flips, high-yield pearls, and rating intervals.
 */

import * as store from '../store.js';
import * as ui from '../ui.js';
import { el, clear } from '../dom.js';

const ANKI_DECKS = [
  {
    id: 'anki_01',
    subject: 'Medicine',
    front: 'What is the diagnostic triad of Normal Pressure Hydrocephalus (NPH)?',
    back: 'Triad: Wet, Wacky, Wobbly\n1. Urinary Incontinence\n2. Dementia / Cognitive Decline\n3. Gait Apraxia (Magnetic Gait)\n\nHigh-Yield Pearl: Large-volume lumbar puncture is both diagnostic and therapeutic (Miller Fisher Test).',
    tag: 'Neurology'
  },
  {
    id: 'anki_02',
    subject: 'Pharmacology',
    front: 'What is the Drug of Choice (DOC) for Paroxysmal Supraventricular Tachycardia (PSVT)?',
    back: 'Drug of Choice: IV Adenosine (rapid bolus 6mg, followed by 12mg if needed).\n\nMechanism: Activates A1 adenosine receptors -> opens K+ channels -> slows AV nodal conduction.\nContraindication: Bronchial asthma / severe COPD.',
    tag: 'Cardiology'
  },
  {
    id: 'anki_03',
    subject: 'Pathology',
    front: 'What is the pathognomonic biopsy finding in Asbestosis?',
    back: 'Asbestos Bodies / Ferruginous Bodies\n(Golden-brown dumbbell-shaped beaded rods coated with iron and protein, stain positive with Prussian blue).\n\nKey Association: Malignant Mesothelioma (calretinin positive) & Bronchogenic Carcinoma (most common tumor).',
    tag: 'Pulmonology'
  },
  {
    id: 'anki_04',
    subject: 'Surgery',
    front: 'What is Charcot''s Triad and Reynolds'' Pentad in Acute Cholangitis?',
    back: 'Charcot''s Triad: Right upper quadrant pain + Jaundice + Fever with chills.\n\nReynolds'' Pentad: Charcot''s Triad + Hypotension (Shock) + Altered Mental Status.\n\nTreatment: Urgent biliary decompression (ERCP) + IV broad-spectrum antibiotics.',
    tag: 'GI Surgery'
  },
  {
    id: 'anki_05',
    subject: 'Pediatrics',
    front: 'What are the classic radiographic signs in (A) Croup and (B) Epiglottitis?',
    back: 'A) Croup (Laryngotracheobronchitis):\n-> Steeple Sign (subglottic tracheal narrowing on AP X-ray).\n\nB) Acute Epiglottitis:\n-> Thumbprint Sign (swollen epiglottis on Lateral Neck X-ray).\n\nEtiology: Croup = Parainfluenza; Epiglottitis = H. influenzae type b.',
    tag: 'Pediatrics'
  },
  {
    id: 'anki_06',
    subject: 'OBGY',
    front: 'What is the diagnostic ultrasound sign of a Complete Hydatidiform Mole?',
    back: '"Snowstorm" or "Bunch of Grapes" appearance on pelvic ultrasound (vesicular echogenic mass without fetal parts).\n\nKaryotype: 46,XX (90%) — androgenetic origin (fertilization of an empty ovum by a single sperm that duplicates).\nTumor Marker: Markedly elevated serum beta-hCG (>100,000 mIU/mL).',
    tag: 'Obstetrics'
  },
  {
    id: 'anki_07',
    subject: 'Microbiology',
    front: 'What is the hallmark microscopic feature of Rabies viral infection?',
    back: 'Negri Bodies\n(Eosinophilic, sharply demarcated, intracytoplasmic inclusions found in the pyramidal cells of the hippocampus and Purkinje cells of the cerebellum).',
    tag: 'Virology'
  },
  {
    id: 'anki_08',
    subject: 'Biochemistry',
    front: 'What enzyme is deficient in McArdle Disease (Glycogen Storage Disease Type V)?',
    back: 'Enzyme Deficient: Muscle Glycogen Phosphorylase (Myophosphorylase).\n\nClinical Presentation: Painful muscle cramps, exercise intolerance, second-wind phenomenon, myoglobinuria (burgundy urine after strenuous exercise).\nBlood test: Failure of blood lactate to rise after ischemic forearm exercise.',
    tag: 'Metabolism'
  },
  {
    id: 'anki_09',
    subject: 'Anatomy',
    front: 'What structure is at risk of injury during surgical ligation of the Superior Thyroid Artery?',
    back: 'External branch of the Superior Laryngeal Nerve (innervates the Cricothyroid muscle -> regulates vocal cord tension / pitch).\n\nInjury leads to: Loss of high-pitched voice and vocal fatigue.\n(Note: Inferior thyroid artery ligation risks the Recurrent Laryngeal Nerve).',
    tag: 'Head & Neck'
  },
  {
    id: 'anki_10',
    subject: 'Dermatology',
    front: 'What is Nikolsky''s sign, and in which blistering diseases is it positive vs negative?',
    back: 'Nikolsky''s Sign: Dislodgement of superficial epidermis by gentle lateral pressure.\n\nPositive (Intraepidermal split):\n1. Pemphigus vulgaris (anti-desmoglein 3/1)\n2. Staphylococcal Scalded Skin Syndrome (SSSS)\n3. Toxic Epidermal Necrolysis (TEN)\n\nNegative (Subepidermal split):\n1. Bullous Pemphigoid (anti-BP180 / BP230)',
    tag: 'Dermatology'
  }
];

let currentCardIndex = 0;
let isFlipped = false;
let selectedSubject = 'ALL';
let completedCount = 0;

export async function show(root) {
  clear(root);
  setTitle('Anki High-Yield Deck');

  function renderView() {
    clear(root);
    setTitle('Anki High-Yield Deck');

    const container = el('div', { class: 'screen screen--anki' });

    const filteredDeck = selectedSubject === 'ALL'
      ? ANKI_DECKS
      : ANKI_DECKS.filter((c) => c.subject === selectedSubject);

    if (currentCardIndex >= filteredDeck.length) {
      currentCardIndex = 0;
    }

    const card = filteredDeck[currentCardIndex];

    const header = el('div', { class: 'anki-header' }, [
      el('div', {}, [
        el('div', { class: 'anki-header__title', text: '📇 Medical Spaced Repetition' }),
        el('div', { class: 'anki-header__sub', text: ${filteredDeck.length} High-Yield Cards ·  Reviewed }),
      ]),
      el('div', { class: 'anki-badge', text: Card  /  }),
    ]);
    container.appendChild(header);

    const subjects = ['ALL', ...Array.from(new Set(ANKI_DECKS.map((c) => c.subject)))];
    const pills = el('div', { class: 'filter-pills' }, subjects.map((sub) =>
      el(
        'button',
        {
          class: ilter-pill ,
          type: 'button',
          onclick: () => {
            selectedSubject = sub;
            currentCardIndex = 0;
            isFlipped = false;
            renderView();
          },
        },
        [el('span', { text: sub === 'ALL' ? 'All Subjects' : sub })]
      )
    ));
    container.appendChild(pills);

    if (!card) {
      container.appendChild(el('div', { class: 'empty' }, [
        el('span', { class: 'empty__icon', text: '🎉' }),
        el('p', { text: 'All cards in this deck completed! Select another subject to continue.' }),
      ]));
      root.appendChild(container);
      return;
    }

    const flashcard = el('div', {
      class: nki-card ,
      onclick: () => {
        isFlipped = !isFlipped;
        renderView();
      }
    }, [
      el('div', { class: 'anki-card__side anki-card__front' }, [
        el('div', { class: 'anki-card__meta' }, [
          el('span', { class: 'chip chip--subject', text: card.subject }),
          el('span', { class: 'chip chip--topic', text: card.tag }),
          el('span', { class: 'anki-card__hint', text: 'Tap to flip' }),
        ]),
        el('div', { class: 'anki-card__content' }, [
          el('div', { class: 'anki-card__prompt', text: card.front }),
        ]),
        el('div', { class: 'anki-card__footer' }, [
          el('span', { text: '🔄 Tap anywhere to reveal High-Yield Pearl' }),
        ]),
      ]),
      el('div', { class: 'anki-card__side anki-card__back' }, [
        el('div', { class: 'anki-card__meta' }, [
          el('span', { class: 'chip chip--subject', text: card.subject }),
          el('span', { class: 'chip chip--exam', text: '⭐ High-Yield Answer' }),
          el('span', { class: 'anki-card__hint', text: 'Tap to flip back' }),
        ]),
        el('div', { class: 'anki-card__content' }, [
          el('div', { class: 'anki-card__answer', text: card.back }),
        ]),
      ]),
    ]);
    container.appendChild(flashcard);

    if (isFlipped) {
      const ratingBar = el('div', { class: 'anki-ratings' }, [
        el('button', {
          class: 'anki-btn anki-btn--again',
          type: 'button',
          onclick: (e) => {
            e.stopPropagation();
            rateCard(filteredDeck, 'again');
          }
        }, [
          el('div', { class: 'anki-btn__label', text: 'Again' }),
          el('div', { class: 'anki-btn__interval', text: '< 1m' }),
        ]),
        el('button', {
          class: 'anki-btn anki-btn--hard',
          type: 'button',
          onclick: (e) => {
            e.stopPropagation();
            rateCard(filteredDeck, 'hard');
          }
        }, [
          el('div', { class: 'anki-btn__label', text: 'Hard' }),
          el('div', { class: 'anki-btn__interval', text: '10m' }),
        ]),
        el('button', {
          class: 'anki-btn anki-btn--good',
          type: 'button',
          onclick: (e) => {
            e.stopPropagation();
            rateCard(filteredDeck, 'good');
          }
        }, [
          el('div', { class: 'anki-btn__label', text: 'Good' }),
          el('div', { class: 'anki-btn__interval', text: '1d' }),
        ]),
        el('button', {
          class: 'anki-btn anki-btn--easy',
          type: 'button',
          onclick: (e) => {
            e.stopPropagation();
            rateCard(filteredDeck, 'easy');
          }
        }, [
          el('div', { class: 'anki-btn__label', text: 'Easy' }),
          el('div', { class: 'anki-btn__interval', text: '4d' }),
        ]),
      ]);
      container.appendChild(ratingBar);
    } else {
      const revealBar = el('div', { class: 'anki-reveal-bar' }, [
        el('button', {
          class: 'btn btn--primary',
          type: 'button',
          style: { width: '100%', maxWidth: '320px', margin: '0 auto' },
          text: 'Show Answer / Pearl',
          onclick: () => {
            isFlipped = true;
            renderView();
          }
        }),
      ]);
      container.appendChild(revealBar);
    }

    root.appendChild(container);
  }

  function rateCard(filteredDeck, rating) {
    completedCount += 1;
    isFlipped = false;
    currentCardIndex = (currentCardIndex + 1) % filteredDeck.length;
    renderView();
  }

  function setTitle(text) {
    const t = document.getElementById('appbar-title');
    if (t) t.textContent = text;
  }

  renderView();
}
