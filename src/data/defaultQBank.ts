import { PYQItem } from '../types';

export const DEFAULT_PYQ_INDEX: PYQItem[] = [
  // Medicine - Emergency / Cardiology / Pulmonology / Endocrine / Nephrology
  {
    qid: 'NEETPG-2017-034',
    exam: 'NEET-PG',
    year: 2017,
    subject: 'Medicine',
    system: 'Cardiology',
    topic: 'Acute Coronary Syndrome',
    stem: 'A 54-year-old diabetic male presents with 2 hours of crushing retrosternal chest pain and diaphoresis. ECG shows ST elevation in leads V1-V4. Which is the initial drug of choice if PCI is delayed by >120 minutes?',
    options: {
      A: 'Aspirin 300 mg + Clopidogrel 300 mg + Streptokinase IV',
      B: 'Intravenous Heparin bolus only',
      C: 'Oral Nitroglycerin and observe for 6 hours',
      D: 'Sublingual Nifedipine 10 mg'
    },
    correctAnswer: 'A',
    conceptTested: 'Thrombolytic therapy in STEMI when primary PCI is delayed >120 min',
    roleTag: 'EMERGENCY',
    explanation: 'In STEMI presenting within 12 hours of symptom onset where primary PCI cannot be performed within 120 minutes, immediate fibrinolysis (e.g. Streptokinase or Tenecteplase) combined with dual antiplatelet therapy (Aspirin + Clopidogrel) is recommended unless contraindicated.'
  },
  {
    qid: 'INICET-2021-112',
    exam: 'INI-CET',
    year: 2021,
    subject: 'Medicine',
    system: 'Cardiology',
    topic: 'Myocardial Infarction Complications',
    stem: 'A patient with anterior wall MI on day 3 suddenly develops severe hypotension, cold clammy extremities, and a new harsh holosystolic murmur at the lower left sternal border with a palpable thrill. What is the diagnosis?',
    options: {
      A: 'Ventricular Septal Rupture (VSR)',
      B: 'Acute Papillary Muscle Rupture',
      C: 'Free Wall Rupture with Tamponade',
      D: 'Right Ventricular Infarction'
    },
    correctAnswer: 'A',
    conceptTested: 'Post-MI mechanical complications - VSR vs Papillary Muscle Rupture',
    roleTag: 'DIAGNOSIS',
    explanation: 'Post-MI Ventricular Septal Rupture presents with cardiogenic shock and a harsh holosystolic murmur with thrill at the left sternal border. Acute mitral regurgitation from papillary muscle rupture produces an apical murmur blowing to the axilla usually without thrill.'
  },
  {
    qid: 'NEETPG-2020-045',
    exam: 'NEET-PG',
    year: 2020,
    subject: 'Medicine',
    system: 'Cardiology',
    topic: 'Arrhythmia Management',
    stem: 'A 60-year-old female presents with acute palpitation and lightheadedness. ECG reveals narrow QRS tachycardia with HR 180 bpm and absent P waves. Vitals show BP 118/76 mmHg. After carotid sinus massage fails, what is the drug of choice?',
    options: {
      A: 'Intravenous Adenosine 6 mg rapid bolus',
      B: 'Intravenous Amiodarone 150 mg slow infusion',
      C: 'Synchronized DC cardioversion 100 J',
      D: 'Oral Digoxin 0.25 mg'
    },
    correctAnswer: 'A',
    conceptTested: 'Acute management of hemodynamically stable SVT',
    roleTag: 'MANAGEMENT',
    explanation: 'In hemodynamically stable PSVT (narrow complex tachycardia), vagal maneuvers are first-line, followed by IV Adenosine 6 mg rapid push. DC cardioversion is indicated if the patient becomes hemodynamically unstable.'
  },
  {
    qid: 'INICET-2022-088',
    exam: 'INI-CET',
    year: 2022,
    subject: 'Medicine',
    system: 'Pulmonology',
    topic: 'Community Acquired Pneumonia',
    stem: 'A 42-year-old alcoholic male presents with high fever, rust-colored sputum, and right lower lobe consolidation. Gram stain shows Gram-positive lancet-shaped diplococci. Which investigation clinches the etiology?',
    options: {
      A: 'Sputum culture and urinary pneumococcal antigen test',
      B: 'Serum cold agglutinins assay',
      C: 'HRCT Chest with contrast',
      D: 'Bronchoalveolar lavage PCR for Legionella'
    },
    correctAnswer: 'A',
    conceptTested: 'Microbiological diagnosis of Streptococcus pneumoniae pneumonia',
    roleTag: 'INVESTIGATION',
    explanation: 'Streptococcus pneumoniae (Gram-positive lancet-shaped diplococci) causes pneumococcal pneumonia with rust-colored sputum. Rapid diagnosis is confirmed via urinary pneumococcal antigen and sputum culture.'
  },
  {
    qid: 'NEETPG-2019-102',
    exam: 'NEET-PG',
    year: 2019,
    subject: 'Medicine',
    system: 'Pulmonology',
    topic: 'Pulmonary Embolism',
    stem: 'A 38-year-old female 5 days post total hip replacement complains of sudden onset shortness of breath and pleuritic chest pain. HR 124 bpm, BP 90/60 mmHg, SpO2 86% on room air. D-dimer is strongly positive. What is the gold-standard diagnostic imaging?',
    options: {
      A: 'CT Pulmonary Angiography (CTPA)',
      B: 'Venous Doppler lower limbs',
      C: 'Chest X-ray posterior-anterior view',
      D: 'Ventilation-Perfusion (V/Q) Scan'
    },
    correctAnswer: 'A',
    conceptTested: 'Gold standard investigation for Pulmonary Embolism',
    roleTag: 'INVESTIGATION',
    explanation: 'CT Pulmonary Angiography (CTPA) is the diagnostic imaging modality of choice for suspected acute Pulmonary Embolism in patients without severe renal failure or dye allergy.'
  },
  {
    qid: 'INICET-2020-019',
    exam: 'INI-CET',
    year: 2020,
    subject: 'Medicine',
    system: 'Endocrinology',
    topic: 'Diabetic Ketoacidosis',
    stem: 'A 19-year-old Type 1 diabetic presents with confusion, deep rapid respirations (Kussmaul), serum glucose 480 mg/dL, pH 7.15, and positive serum ketones. What is the most critical immediate electrolyte monitoring during IV insulin therapy?',
    options: {
      A: 'Serum Potassium level (maintain >3.3 - 5.0 mEq/L)',
      B: 'Serum Calcium level',
      C: 'Serum Magnesium level',
      D: 'Serum Sodium level'
    },
    correctAnswer: 'A',
    conceptTested: 'Potassium management in DKA prior to and during insulin administration',
    roleTag: 'PHARM',
    explanation: 'Insulin shifts potassium into cells. Administering insulin when K+ is <3.3 mEq/L can cause lethal ventricular arrhythmias or respiratory muscle paralysis. Potassium must be checked and replaced before/during insulin infusion.'
  },
  {
    qid: 'NEETPG-2021-077',
    exam: 'NEET-PG',
    year: 2021,
    subject: 'Medicine',
    system: 'Nephrology',
    topic: 'Acute Kidney Injury',
    stem: 'A 65-year-old male with severe sepsis develops oliguria (urine output <0.3 mL/kg/h for 12 hrs). Serum creatinine rises from 0.9 to 2.8 mg/dL. Fractional Excretion of Sodium (FENa) is 0.4% and Urine Sodium is 12 mEq/L. What type of AKI is this?',
    options: {
      A: 'Prerenal Azotemia',
      B: 'Acute Tubular Necrosis (ATN)',
      C: 'Acute Interstitial Nephritis (AIN)',
      D: 'Postrenal Obstruction'
    },
    correctAnswer: 'A',
    conceptTested: 'Distinguishing Prerenal Azotemia (FENa <1%, Urine Na <20) from ATN (FENa >2%, Urine Na >40)',
    roleTag: 'DIAGNOSIS',
    explanation: 'Prerenal azotemia is characterized by preserved tubular reabsorptive capacity leading to low FENa (<1%) and low urinary sodium (<20 mEq/L), along with high urine osmolality (>500 mOsm/kg).'
  },
  {
    qid: 'INICET-2023-054',
    exam: 'INI-CET',
    year: 2023,
    subject: 'Surgery',
    system: 'Trauma & Emergency',
    topic: 'Tension Pneumothorax',
    stem: 'A road traffic accident victim arrives in casualty with severe respiratory distress, trachea shifted to the left, absent breath sounds on the right side, hyperresonant percussion, and BP 70/40 mmHg. What is the immediate life-saving step?',
    options: {
      A: 'Needle decompression in 2nd intercostal space midclavicular line (or 5th ICS anterior axillary line)',
      B: 'Immediate portable Chest X-ray',
      C: 'Endotracheal intubation with positive pressure ventilation',
      D: 'Urgent CT Scan of Chest'
    },
    correctAnswer: 'A',
    conceptTested: 'Immediate management of Tension Pneumothorax without waiting for CXR',
    roleTag: 'EMERGENCY',
    explanation: 'Tension pneumothorax is a clinical diagnosis requiring immediate needle thoracostomy prior to any radiographic imaging. Positive pressure ventilation without decompression will worsen cardiac collapse.'
  },
  {
    qid: 'NEETPG-2018-092',
    exam: 'NEET-PG',
    year: 2018,
    subject: 'Surgery',
    system: 'Gastroenterology',
    topic: 'Acute Appendicitis',
    stem: 'A 22-year-old male presents with 18 hours of migratory right lower quadrant pain, low-grade fever, anorexia, and tenderness at McBurney point. Alvarado score is 8. Ultrasound is non-conclusive. What is the definitive management?',
    options: {
      A: 'Laparoscopic or open Appendectomy',
      B: 'Intravenous antibiotics and discharge in 4 hours',
      C: 'Barium enema study',
      D: 'Repeated ultrasound in 7 days'
    },
    correctAnswer: 'A',
    conceptTested: 'Surgical indication for high-probability acute appendicitis',
    roleTag: 'MANAGEMENT',
    explanation: 'An Alvarado score of 7-10 strongly indicates acute appendicitis. Prompt appendectomy prevents perforation and peritonitis.'
  },
  {
    qid: 'INICET-2022-140',
    exam: 'INI-CET',
    year: 2022,
    subject: 'OBGY',
    system: 'Obstetrics',
    topic: 'Severe Preeclampsia / Eclampsia',
    stem: 'A 28-year-old primigravida at 34 weeks gestation presents with headache, epigastric pain, BP 170/110 mmHg, and 3+ proteinuria. She suddenly develops a generalized tonic-clonic seizure in the triage room. What is the drug of choice for seizure control and prophylaxis?',
    options: {
      A: 'Magnesium Sulfate IV (Pritchard or Zuspan regimen)',
      B: 'Intravenous Diazepam 10 mg',
      C: 'Intravenous Phenytoin loading dose',
      D: 'Intravenous Sodium Nitroprusside'
    },
    correctAnswer: 'A',
    conceptTested: 'First-line anticonvulsant in Eclampsia - Magnesium Sulfate',
    roleTag: 'EMERGENCY',
    explanation: 'Magnesium sulfate is the anticonvulsant of choice to prevent and treat eclamptic seizures (MAGPIE trial). Antihypertensives like Labetalol or Hydralazine are added to lower BP.'
  },
  {
    qid: 'NEETPG-2022-014',
    exam: 'NEET-PG',
    year: 2022,
    subject: 'Pharmacology',
    system: 'Infectious Disease',
    topic: 'Sepsis Antibiotic Stewardship',
    stem: 'A 58-year-old diabetic female with severe urosepsis and hypotension is started on empiric coverage. Urine culture grows Pseudomonas aeruginosa sensitive only to Colistin and Meropenem. What is the major toxicity to monitor with Colistin?',
    options: {
      A: 'Nephrotoxicity and Neuromuscular blockade',
      B: 'Ototoxicity and Vestibular dysfunction',
      C: 'Cardiotoxicity and QT prolongation',
      D: 'Hepatotoxicity and Aplastic anemia'
    },
    correctAnswer: 'A',
    conceptTested: 'Colistin / Polymyxin B toxicity profile',
    roleTag: 'PHARM',
    explanation: 'Colistin (Polymyxin E) primary dose-limiting toxicities are acute kidney injury (nephrotoxicity) and neurotoxicity (paresthesias, neuromuscular blockade, respiratory paralysis).'
  },
  {
    qid: 'INICET-2024-002',
    exam: 'INI-CET',
    year: 2024,
    subject: 'PSM',
    system: 'Preventive Healthcare',
    topic: 'Vaccination in Special Hosts / Spleen',
    stem: 'A 30-year-old trauma victim undergoes emergency splenectomy following road traffic accident. Which vaccines must be administered post-operatively prior to hospital discharge?',
    options: {
      A: 'Pneumococcal, Meningococcal, and Haemophilus influenzae type b (Hib)',
      B: 'BCG, Oral Polio, and Rotavirus',
      C: 'Hepatitis B, Rabies, and Tetanus Toxoid only',
      D: 'HPV, Varicella, and MMR'
    },
    correctAnswer: 'A',
    conceptTested: 'Post-splenectomy immunization against encapsulated organisms',
    roleTag: 'PREVENTION',
    explanation: 'Asplenic patients are at high risk for Overwhelming Post-Splenectomy Infection (OPSI) caused by encapsulated bacteria: S. pneumoniae, N. meningitidis, and H. influenzae type b. Vaccination is given 14 days post-op (or pre-op if elective).'
  },
  {
    qid: 'NEETPG-2023-099',
    exam: 'NEET-PG',
    year: 2023,
    subject: 'Pediatrics',
    system: 'Gastroenterology',
    topic: 'Severe Acute Malnutrition & Dehydration',
    stem: 'A 14-month-old child with severe acute malnutrition (SAM) presents with severe watery diarrhea and lethargy. Vitals show HR 160 bpm, weak pulses, cold extremities. What is the WHO recommended fluid for rehydration in SAM with shock?',
    options: {
      A: 'ReSoMal (Rehydration Solution for Malnutrition) or half-strength Darrow solution',
      B: 'Standard ORS at 100 mL/kg rapid bolus',
      C: 'Hypertonic 3% Saline IV infusion',
      D: 'Plain 10% Dextrose bolus without electrolytes'
    },
    correctAnswer: 'A',
    conceptTested: 'Fluid management in SAM - avoiding fluid overload with ReSoMal (lower sodium, higher potassium)',
    roleTag: 'MANAGEMENT',
    explanation: 'Children with SAM have reduced cardiac mass and altered sodium-potassium pumps. Standard WHO ORS can precipitate heart failure. ReSoMal (contains 45 mmol/L Na+, 40 mmol/L K+) is used slowly.'
  },
  {
    qid: 'INICET-2021-042',
    exam: 'INI-CET',
    year: 2021,
    subject: 'Pathology',
    system: 'Hematology',
    topic: 'Microcytic Anemia Differential',
    stem: 'A 28-year-old pregnant female presents with weakness. CBC shows Hb 8.2 g/dL, MCV 68 fL, Serum Ferritin 8 ng/mL (low), and TIBC 450 mcg/dL (high). Mentzer index (MCV/RBC count) is >13. What is the underlying diagnosis?',
    options: {
      A: 'Iron Deficiency Anemia',
      B: 'Beta-Thalassemia Trait',
      C: 'Sideroblastic Anemia',
      D: 'Anemia of Chronic Disease'
    },
    correctAnswer: 'A',
    conceptTested: 'Iron Deficiency Anemia diagnostic markers vs Thalassemia (Mentzer Index >13 in IDA, <13 in Thal)',
    roleTag: 'DIAGNOSIS',
    explanation: 'Iron deficiency anemia shows low ferritin, high TIBC, low serum iron, and Mentzer Index >13. In Beta-Thalassemia trait, RBC count is disproportionately high giving Mentzer Index <13.'
  }
];
