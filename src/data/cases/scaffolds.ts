import { CaseScaffold } from '../../types';

export const CASE_SCAFFOLDS: CaseScaffold[] = [
  // 1. Acute STEMI
  {
    id: 'scaffold_stemi',
    title: 'Acute Chest Pain in Emergency',
    conditionName: 'Acute Anterior Wall STEMI',
    subject: 'Medicine',
    system: 'Cardiology',
    demographics: {
      name: 'Ramesh Kumar',
      age: 54,
      gender: 'Male',
      setting: 'Emergency',
    },
    openingVignette: 'A 54-year-old male presents to the triage room with 90 minutes of acute, severe retrosternal crushing discomfort, profuse sweating, and mild dyspnea while at work. Pain radiates to the inner aspect of left arm and lower jaw. History of Type 2 Diabetes for 8 years.',
    initialVitals: {
      hr: 110,
      bp: '140/90',
      rr: 22,
      spo2: 94,
      temp: '37.0°C',
      grbs: 186,
    },
    clinchingClue: '12-lead ECG reveals 4mm convex-upward ST-segment elevation in leads V1-V4 with reciprocal ST depression in inferior leads.',
    clinchingClueTimeMinutes: 10,
    examFindingsMap: {
      cvs: 'S1 S2 heard, soft S4 gallop present at apex. JVP 3 cm above sternal angle. No pericardial rub.',
      chest: 'Bilateral basal fine end-inspiratory crepitations up to lower 1/3rd of lung fields.',
      abdomen: 'Soft, non-tender, no hepatomegaly, bowel sounds present.',
      neuro: 'Alert, oriented x3, gross cranial nerves intact, no focal motor deficits.',
      general: 'Pale, diaphoretic, anxious, no peripheral cyanosis or pedal edema.',
    },
    historyMap: {
      allergies: 'No known drug allergies.',
      past: 'Type 2 Diabetes Mellitus for 8 years on metformin. Smoker 15 pack-years.',
      medications: 'Metformin 500 mg BD. Irregular compliance.',
      family: 'Father died of sudden cardiac death at age 52.',
    },
    investigationsMap: {
      'ecg': {
        resultText: '12-lead ECG: Sinus tachycardia at 110 bpm. Hyperacute T waves progressing to 4mm ST elevations in V1-V4. Reciprocal ST depressions in II, III, aVF.',
        turnaroundMinutes: 5,
        category: 'imaging',
        isIndicative: true,
      },
      'troponin': {
        resultText: 'STAT Troponin I: 3.4 ng/mL (Reference <0.04 ng/mL) — Significantly elevated. CK-MB: 48 U/L.',
        turnaroundMinutes: 30,
        category: 'labs',
        isIndicative: true,
      },
      'cbc': {
        resultText: 'CBC: Hb 14.2 g/dL, WBC 11,400/mcL (78% Neutrophils), Platelets 240,000/mcL.',
        turnaroundMinutes: 25,
        category: 'labs',
        isIndicative: true,
      },
      'kft': {
        resultText: 'KFT / Renal Panel: Blood Urea 32 mg/dL, Serum Creatinine 1.0 mg/dL, Na+ 138 mEq/L, K+ 4.2 mEq/L.',
        turnaroundMinutes: 30,
        category: 'labs',
        isIndicative: true,
      },
      'cxr': {
        resultText: 'Portable CXR (PA view): Mild pulmonary venous congestion, heart size upper limit of normal. No pneumothorax.',
        turnaroundMinutes: 20,
        category: 'imaging',
        isIndicative: true,
      },
      'echo': {
        resultText: 'Bedside Echocardiogram: Regional wall motion abnormality (anterior wall and apex hypokinesis). LVEF 42%. No pericardial effusion or VSR.',
        turnaroundMinutes: 25,
        category: 'imaging',
        isIndicative: true,
      },
    },
    criticalInterventions: [
      {
        orderOrActionPattern: /aspirin|clopidogrel|ticagrelor|dual antiplatelet|dapt/i,
        name: 'Dual Antiplatelet Therapy (Aspirin + P2Y12 inhibitor)',
        targetMilestoneMinutes: 20,
      },
      {
        orderOrActionPattern: /pci|catheterization|thromboly|streptokinase|tenecteplase/i,
        name: 'Reperfusion Therapy (PCI or Fibrinolysis)',
        targetMilestoneMinutes: 60,
      },
    ],
    incidentalPool: [
      {
        id: 'inc_stemi_1',
        title: 'Asymptomatic Solitary Gallstone',
        description: 'Bedside abdominal ultrasound shows a single 9mm hyperechoic gallstone in gallbladder with acoustic shadowing. Wall thickness 2mm, no sludge or tenderness.',
        correctAction: 'Conservative observation — asymptomatic cholelithiasis requires no surgical intervention.',
        status: 'unnoticed',
      },
      {
        id: 'inc_stemi_2',
        title: 'Missed Tdap Booster Vaccination',
        description: 'Immunization history review indicates last tetanus toxoid booster was received 12 years ago.',
        correctAction: 'Administer adult Tdap booster prior to hospital discharge.',
        status: 'unnoticed',
      },
    ],
    gateMilestones: [
      {
        roleTag: 'EMERGENCY',
        patientContext: 'Patient presenting with acute chest pain and diaphoresis within golden hour.',
        consequenceOnRight: 'Immediate loading doses administered. Ischemic chest pain begins to subside.',
        consequenceOnWrong: 'Reperfusion delay incurred! Myocardial ischemia continues to expand.',
      },
      {
        roleTag: 'DIAGNOSIS',
        patientContext: 'Patient develops cold clammy extremities and new holosystolic murmur on day 3.',
        consequenceOnRight: 'Mechanical complication correctly identified. Urgent surgical consult requested.',
        consequenceOnWrong: 'Misdiagnosed mechanical complication! Cardiogenic shock worsens.',
      },
      {
        roleTag: 'MANAGEMENT',
        patientContext: 'ECG obtained. Nearest catheterisation lab is over 120 minutes away from this centre.',
        consequenceOnRight: 'Fibrinolytic therapy initiated rapidly with complete ST-resolution.',
        consequenceOnWrong: 'Delayed reperfusion leads to extensive anterior wall necrosis.',
      },
      {
        roleTag: 'PHARM',
        patientContext: 'Selecting the antiplatelet and anticoagulant regimen for this presentation.',
        consequenceOnRight: 'Optimal antithrombotic therapy maintained without major bleeding.',
        consequenceOnWrong: 'Suboptimal dosing or inappropriate combination increases complication risk.',
      },
      {
        roleTag: 'PREVENTION',
        patientContext: 'Secondary prevention planning prior to discharge.',
        consequenceOnRight: 'Statin, ACE inhibitor, Beta-blocker, and DAPT prescribed appropriately.',
        consequenceOnWrong: 'Missing secondary prevention medications increases 1-year re-infarction risk.',
      },
    ],
  },

  // 2. Acute Pulmonary Embolism
  {
    id: 'scaffold_pe',
    title: 'Sudden Dyspnea Post-Operatively',
    conditionName: 'Acute Pulmonary Embolism',
    subject: 'Medicine',
    system: 'Pulmonology',
    demographics: {
      name: 'Sunita Sharma',
      age: 48,
      gender: 'Female',
      setting: 'Emergency',
    },
    openingVignette: 'A 48-year-old female 6 days post total knee replacement presents with sudden onset sharp pleuritic chest pain and severe breathlessness. She appears anxious, tachypneic, and diaphoretic. No cough or hemoptysis.',
    initialVitals: {
      hr: 124,
      bp: '96/62',
      rr: 28,
      spo2: 86,
      temp: '37.2°C',
      grbs: 108,
    },
    clinchingClue: 'CT Pulmonary Angiography (CTPA) demonstrates a large saddle embolus extending into both main pulmonary arteries with RV strain.',
    clinchingClueTimeMinutes: 30,
    examFindingsMap: {
      chest: 'Lungs clear to auscultation bilaterally. No wheeze, rales, or rhonchi. Marked tachypnea.',
      cvs: 'Tachycardic, loud P2 component of second heart sound. No gallop or murmurs.',
      extremities: 'Left calf exhibits 3cm edema compared to right, with mild tenderness on palpation.',
      neuro: 'Anxious, alert, oriented.',
      general: 'Tachypneic, cyanotic lip margins on room air.',
    },
    historyMap: {
      allergies: 'No known drug allergies.',
      past: 'Hypertension 4 years. Total knee arthroplasty 6 days ago. Immobilized at home.',
      medications: 'Amlodipine 5 mg OD.',
    },
    investigationsMap: {
      'ctpa': {
        resultText: 'CTPA STAT: Large filling defect at pulmonary arterial bifurcation (Saddle Embolus) causing subtotal occlusion of right and left main pulmonary arteries. RV/LV ratio 1.4 (RV strain).',
        turnaroundMinutes: 30,
        category: 'imaging',
        isIndicative: true,
      },
      'ddimer': {
        resultText: 'Serum D-Dimer (ELISA): 4,850 ng/mL (Reference <500 ng/mL) — Markedly elevated.',
        turnaroundMinutes: 20,
        category: 'labs',
        isIndicative: true,
      },
      'abg': {
        resultText: 'ABG (Room Air): pH 7.48, PaCO2 28 mmHg, PaO2 54 mmHg, HCO3 21 mEq/L, SaO2 86% — Acute respiratory alkalosis with severe hypoxemia.',
        turnaroundMinutes: 10,
        category: 'labs',
        isIndicative: true,
      },
      'ecg': {
        resultText: '12-lead ECG: Sinus tachycardia at 124 bpm. S1Q3T3 pattern present (S wave in I, Q wave in III, inverted T wave in III). Right axis deviation.',
        turnaroundMinutes: 5,
        category: 'imaging',
        isIndicative: true,
      },
      'doppler': {
        resultText: 'Venous Doppler Lower Limbs: Non-compressible femoral and popliteal vein on left limb with luminal thrombus.',
        turnaroundMinutes: 25,
        category: 'imaging',
        isIndicative: true,
      },
      'cxr': {
        resultText: 'Chest X-ray PA view: Oligemia in right lung field (Westermark sign) and subtle wedge-shaped opacity at periphery (Hampton hump). No effusion.',
        turnaroundMinutes: 15,
        category: 'imaging',
        isIndicative: true,
      },
    },
    criticalInterventions: [
      {
        orderOrActionPattern: /oxygen|o2|high flow/i,
        name: 'Supplemental High-Flow Oxygen',
        targetMilestoneMinutes: 5,
      },
      {
        orderOrActionPattern: /heparin|lmwh|enoxaparin|anticoagul|thromboly/i,
        name: 'Immediate Parenteral Anticoagulation',
        targetMilestoneMinutes: 20,
      },
    ],
    incidentalPool: [
      {
        id: 'inc_pe_1',
        title: 'Incidental 6mm Thyroid Nodule',
        description: 'CT chest lower neck cuts note a well-circumscribed 6mm hypoattenuating non-calcified nodule in right lobe of thyroid.',
        correctAction: 'Recommend routine outpatient thyroid ultrasound in 6-12 months.',
        status: 'unnoticed',
      },
    ],
    gateMilestones: [
      {
        roleTag: 'INVESTIGATION',
        patientContext: 'Post-operative patient with sudden severe hypoxaemia and pleuritic chest pain.',
        consequenceOnRight: 'CTPA ordered immediately confirming massive pulmonary embolism.',
        consequenceOnWrong: 'Non-diagnostic investigations ordered leading to delayed treatment.',
      },
      {
        roleTag: 'MANAGEMENT',
        patientContext: 'Imaging now available; the patient remains haemodynamically unstable at 90/60 mmHg.',
        consequenceOnRight: 'Therapeutic anticoagulation and thrombolytic evaluation initiated.',
        consequenceOnWrong: 'Delayed anticoagulation leads to recurrent embolization and obstructive shock.',
      },
      {
        roleTag: 'PHARM',
        patientContext: 'Selecting initial anticoagulant dosing in a haemodynamically unstable patient.',
        consequenceOnRight: 'Weight-adjusted LMWH or Unfractionated Heparin bolus administered.',
        consequenceOnWrong: 'Inadequate heparinization fails to halt clot propagation.',
      },
    ],
  },

  // 3. Diabetic Ketoacidosis (DKA)
  {
    id: 'scaffold_dka',
    title: 'Altered Sensorium with Vomiting',
    conditionName: 'Diabetic Ketoacidosis (DKA)',
    subject: 'Medicine',
    system: 'Endocrinology',
    demographics: {
      name: 'Aman Verma',
      age: 21,
      gender: 'Male',
      setting: 'Emergency',
    },
    openingVignette: 'A 21-year-old male is brought to casualty by parents with 2 days of abdominal pain, frequent vomiting, severe thirst, and progressive lethargy. On exam, he is confused with deep, rapid respirations and a fruity acetone odor on his breath.',
    initialVitals: {
      hr: 128,
      bp: '92/58',
      rr: 32,
      spo2: 97,
      temp: '37.8°C',
      grbs: 480,
    },
    clinchingClue: 'Serum Beta-hydroxybutyrate is 5.8 mmol/L, ABG shows pH 7.12, HCO3 8 mEq/L (High Anion Gap Metabolic Acidosis), Serum Ketones strongly positive 4+.',
    clinchingClueTimeMinutes: 15,
    examFindingsMap: {
      general: 'Deep rapid breathing (Kussmaul respiration), dry mucous membranes, sunken eyes, acetone breath odor.',
      chest: 'Lungs clear bilaterally. Tachypneic without focal rales.',
      cvs: 'Tachycardic, regular rhythm, weak peripheral pulses.',
      abdomen: 'Diffuse mild tenderness without rigidity or rebound. Bowel sounds sluggish.',
      neuro: 'GCS 13/15 (E3V4M6), confused, no focal neurological deficits.',
    },
    historyMap: {
      allergies: 'No known allergies.',
      past: 'Type 1 Diabetes Mellitus diagnosed 3 years ago. Missed insulin doses for 3 days due to gastroenteritis.',
      medications: 'Insulin Glargine + Insulin Lispro.',
    },
    investigationsMap: {
      'grbs': {
        resultText: 'GRBS: 480 mg/dL (High).',
        turnaroundMinutes: 2,
        category: 'labs',
        isIndicative: true,
      },
      'abg': {
        resultText: 'ABG: pH 7.12, PaCO2 20 mmHg, PaO2 96 mmHg, HCO3 8 mEq/L, Anion Gap 24 mEq/L (High Anion Gap Metabolic Acidosis).',
        turnaroundMinutes: 10,
        category: 'labs',
        isIndicative: true,
      },
      'electrolytes': {
        resultText: 'Serum Electrolytes: Na+ 130 mEq/L (corrected 136 mEq/L), K+ 4.8 mEq/L, Cl- 98 mEq/L, Serum Creatinine 1.6 mg/dL.',
        turnaroundMinutes: 20,
        category: 'labs',
        isIndicative: true,
      },
      'ketones': {
        resultText: 'Serum Ketones: Positive 4+ (Beta-hydroxybutyrate 5.8 mmol/L). Urine Ketones: 4+.',
        turnaroundMinutes: 15,
        category: 'labs',
        isIndicative: true,
      },
      'rft': {
        resultText: 'Renal Function: Urea 54 mg/dL, Creatinine 1.6 mg/dL (prerenal azotemia secondary to severe dehydration).',
        turnaroundMinutes: 25,
        category: 'labs',
        isIndicative: true,
      },
    },
    criticalInterventions: [
      {
        orderOrActionPattern: /normal saline|0\.9% saline|iv fluids|crystalloid/i,
        name: 'Aggressive IV Isotonic Saline Resuscitation',
        targetMilestoneMinutes: 15,
      },
      {
        orderOrActionPattern: /potassium|kcl|k\+/i,
        name: 'Potassium Evaluation & Replacement',
        targetMilestoneMinutes: 25,
      },
      {
        orderOrActionPattern: /insulin|regular insulin|actrapid/i,
        name: 'Continuous IV Regular Insulin Infusion',
        targetMilestoneMinutes: 30,
      },
    ],
    incidentalPool: [
      {
        id: 'inc_dka_1',
        title: 'Mild Asymptomatic Hyperuricemia',
        description: 'Serum Uric Acid level is 8.4 mg/dL. Patient reports no joint pain or history of gout.',
        correctAction: 'Recheck uric acid after hydration and recovery from ketoacidosis.',
        status: 'unnoticed',
      },
    ],
    gateMilestones: [
      {
        roleTag: 'PHARM',
        patientContext: 'Managing severe metabolic acidosis and the potassium shift anticipated on starting insulin.',
        consequenceOnRight: 'Potassium checked and replaced before/during regular insulin drip.',
        consequenceOnWrong: 'Starting insulin without monitoring potassium precipitates severe hypokalemia.',
      },
      {
        roleTag: 'MANAGEMENT',
        patientContext: 'Resuscitating a severely dehydrated patient with markedly elevated blood glucose.',
        consequenceOnRight: 'IV Normal Saline 1-1.5 L given in first hour restoring organ perfusion.',
        consequenceOnWrong: 'Inadequate fluid resuscitation delays clearance of ketoacids and worsening AKI.',
      },
    ],
  },

  // 4. Eclampsia
  {
    id: 'scaffold_eclampsia',
    title: 'Seizure in Pregnant Female at 34 Weeks',
    conditionName: 'Eclampsia (Severe Preeclampsia)',
    subject: 'OBGY',
    system: 'Obstetrics',
    demographics: {
      name: 'Priyanka Devi',
      age: 26,
      gender: 'Female',
      setting: 'Emergency',
    },
    openingVignette: 'A 26-year-old primigravida at 34 weeks gestation is rushed to casualty following a witnessed 2-minute generalized tonic-clonic seizure at home. On arrival, she is post-ictal, confused, with severe pedal edema and facial puffiness. BP is 174/112 mmHg.',
    initialVitals: {
      hr: 116,
      bp: '174/112',
      rr: 22,
      spo2: 92,
      temp: '37.1°C',
      grbs: 98,
    },
    clinchingClue: 'Urine Dipstick reveals 3+ Proteinuria, Blood Pressure 174/112 mmHg, hyperreflexia with clonus, post-seizure state.',
    clinchingClueTimeMinutes: 5,
    examFindingsMap: {
      general: 'Drowsy, post-ictal state, generalized edema (facial and bilateral lower limb 3+ pitting edema).',
      cvs: 'S1 S2 heard, no murmurs, BP elevated 174/112 mmHg.',
      chest: 'Lungs clear bilaterally, no rales.',
      abdomen: 'Gravid uterus corresponding to 32-34 weeks, non-tender, relaxed between uterine contractions. Fetal heart rate 142 bpm.',
      neuro: 'Post-ictal lethargy, hyperreflexic knee jerks (4+) with 3 beats of ankle clonus.',
    },
    historyMap: {
      allergies: 'No known drug allergies.',
      past: 'Primigravida 34 weeks. Unbooked pregnancy. Complained of severe frontal headache and epigastric pain since morning.',
    },
    investigationsMap: {
      'urinalysis': {
        resultText: 'Urine Dipstick: 3+ Proteinuria (24-hour urine protein 3.8 g). No glucosuria or nitrites.',
        turnaroundMinutes: 5,
        category: 'labs',
        isIndicative: true,
      },
      'lft': {
        resultText: 'LFT / HELLP Panel: AST 142 U/L, ALT 128 U/L, Total Bilirubin 1.8 mg/dL, LDH 780 U/L.',
        turnaroundMinutes: 25,
        category: 'labs',
        isIndicative: true,
      },
      'cbc': {
        resultText: 'CBC: Hb 11.0 g/dL, WBC 12,200/mcL, Platelets 88,000/mcL (Thrombocytopenia).',
        turnaroundMinutes: 20,
        category: 'labs',
        isIndicative: true,
      },
      'usg_fetal': {
        resultText: 'Obstetric USG: Single live fetus 33 weeks, EFW 1.8 kg (IUGR), Oligohydramnios (AFI 6 cm), Doppler shows umbilical artery reversed end-diastolic flow.',
        turnaroundMinutes: 20,
        category: 'imaging',
        isIndicative: true,
      },
    },
    criticalInterventions: [
      {
        orderOrActionPattern: /magnesium sulfate|mgso4|pritchard|zuspan/i,
        name: 'IV Magnesium Sulfate Loading Dose',
        targetMilestoneMinutes: 10,
      },
      {
        orderOrActionPattern: /labetalol|hydralazine|nifedipine|antihypertensive/i,
        name: 'Rapid-Acting Antihypertensive Therapy',
        targetMilestoneMinutes: 15,
      },
    ],
    incidentalPool: [
      {
        id: 'inc_eclamp_1',
        title: 'Asymptomatic Bacteriuria',
        description: 'Urine microscopy notes 15-20 WBCs/HPF and Gram-negative bacilli.',
        correctAction: 'Start oral Nitrofurantoin or Amoxicillin-Clavulanate for asymptomatic bacteriuria in pregnancy after acute seizure stabilization.',
        status: 'unnoticed',
      },
    ],
    gateMilestones: [
      {
        roleTag: 'EMERGENCY',
        patientContext: 'Third-trimester patient with an active generalised tonic-clonic seizure.',
        consequenceOnRight: 'Magnesium sulfate IV bolus administered halting recurrence.',
        consequenceOnWrong: 'Inappropriate anticonvulsant (e.g. Diazepam alone) fails to prevent recurrent eclamptic fits.',
      },
      {
        roleTag: 'MANAGEMENT',
        patientContext: 'Severe hypertension above 160/110 mmHg in a pregnant patient.',
        consequenceOnRight: 'IV Labetalol titrated to achieve target diastolic BP 90-100 mmHg.',
        consequenceOnWrong: 'Uncontrolled severe BP increases risk of maternal hemorrhagic stroke.',
      },
    ],
  },

  // 5. Tension Pneumothorax
  {
    id: 'scaffold_pneumothorax',
    title: 'Severe Respiratory Distress Post-Trauma',
    conditionName: 'Tension Pneumothorax',
    subject: 'Surgery',
    system: 'Trauma & Emergency',
    demographics: {
      name: 'Vikram Singh',
      age: 30,
      gender: 'Male',
      setting: 'Emergency',
    },
    openingVignette: 'A 30-year-old male is brought to casualty following a high-speed motor vehicle collision. He is in severe respiratory distress, struggling for breath, cyanotic, and sweating profusely. Jugular veins are markedly engorged.',
    initialVitals: {
      hr: 138,
      bp: '72/44',
      rr: 36,
      spo2: 78,
      temp: '36.8°C',
      grbs: 112,
    },
    clinchingClue: 'Trachea deviated to the left, right hemithorax hyperresonant on percussion with completely absent breath sounds, BP 72/44 mmHg.',
    clinchingClueTimeMinutes: 2,
    examFindingsMap: {
      chest: 'Right hemithorax expanded with minimal excursion, hyperresonant percussion note, absent breath sounds on right. Left side vesicular breath sounds present.',
      neck: 'Trachea palpably deviated to left side. Distended neck veins (JVP elevated).',
      cvs: 'Tachycardic at 138 bpm, distant heart sounds, severe hypotension 72/44 mmHg.',
      neuro: 'Agitated, hypoxic encephalopathy, GCS 12/15.',
    },
    historyMap: {
      allergies: 'No known allergies.',
      past: 'Healthy male, driver in head-on road traffic accident 25 minutes ago.',
    },
    investigationsMap: {
      'cxr': {
        resultText: 'Portable CXR: Massive right-sided tension pneumothorax with complete right lung collapse and marked mediastinal shift to the left.',
        turnaroundMinutes: 15,
        category: 'imaging',
        isIndicative: true,
      },
      'fast': {
        resultText: 'eFAST Exam: Absence of lung sliding on right hemithorax (Barcode sign on M-mode). No pericardial effusion or intra-abdominal free fluid.',
        turnaroundMinutes: 5,
        category: 'imaging',
        isIndicative: true,
      },
    },
    criticalInterventions: [
      {
        orderOrActionPattern: /needle|decompression|thoracostomy|chest tube|icd/i,
        name: 'Immediate Needle Thoracostomy or Intercostal Drain Placement',
        targetMilestoneMinutes: 5,
      },
    ],
    incidentalPool: [
      {
        id: 'inc_pneu_1',
        title: 'Nondisplaced Left 8th Rib Fracture',
        description: 'Secondary chest survey reveals mild localized left rib cage tenderness without flail segment.',
        correctAction: 'Provide adequate analgesia (oral/IV Paracetamol) and deep breathing exercises.',
        status: 'unnoticed',
      },
    ],
    gateMilestones: [
      {
        roleTag: 'EMERGENCY',
        patientContext: 'Shocked trauma patient with tracheal deviation, unilateral absent breath sounds and hyperresonance.',
        consequenceOnRight: 'Immediate 14G needle thoracostomy inserted in 2nd ICS MCL. Rush of air heard, BP jumps to 110/70 mmHg.',
        consequenceOnWrong: 'Delaying decompression for CXR causes cardiac arrest due to impaired venous return!',
      },
    ],
  },

  // 6. Bacterial Meningitis
  {
    id: 'scaffold_meningitis',
    title: 'Fever, Severe Headache, and Neck Stiffness',
    conditionName: 'Acute Bacterial Meningitis',
    subject: 'Medicine',
    system: 'Infectious Disease',
    demographics: {
      name: 'Kavita Patel',
      age: 35,
      gender: 'Female',
      setting: 'Emergency',
    },
    openingVignette: 'A 35-year-old female presents with 18 hours of high-grade fever with chills, severe holocranial headache, photophobia, and persistent vomiting. On exam, she lies with hips and knees flexed and cries out on passive neck flexion.',
    initialVitals: {
      hr: 118,
      bp: '110/72',
      rr: 22,
      spo2: 96,
      temp: '39.4°C',
      grbs: 104,
    },
    clinchingClue: 'Positive Kernig and Brudzinski signs, CSF turbid with WBC 2,400/mm3 (90% Neutrophils), CSF Protein 280 mg/dL, CSF Glucose 18 mg/dL (Serum 104 mg/dL).',
    clinchingClueTimeMinutes: 20,
    examFindingsMap: {
      general: 'Febrile (39.4°C), ill-looking, photophobic, petechial rash noted on lower trunk and extremities.',
      neuro: 'Marked nuchal rigidity. Positive Kernig sign (pain on extending knee beyond 130 degrees). Positive Brudzinski sign (flexion of hips when neck is flexed). Fundoscopy: optic discs sharp.',
      cvs: 'Tachycardic, S1 S2 heard.',
      chest: 'Clear to auscultation.',
    },
    historyMap: {
      allergies: 'No known drug allergies.',
      past: 'Sinusitis 2 weeks ago untreated.',
    },
    investigationsMap: {
      'csf': {
        resultText: 'CSF Analysis: Turbid appearance, Opening Pressure 28 cm H2O (elevated). WBC count 2,800/mm3 (88% Polymorphs), Protein 310 mg/dL, Glucose 16 mg/dL (CSF/Serum ratio 0.15). Gram stain: Gram-negative intracellular diplococci.',
        turnaroundMinutes: 45,
        category: 'labs',
        isIndicative: true,
      },
      'blood_cultures': {
        resultText: 'Blood Cultures x2 STAT: Plated for aerobic/anaerobic organisms. Pending 24-48h incubations.',
        turnaroundMinutes: 60,
        category: 'labs',
        isIndicative: true,
      },
      'ct_head': {
        resultText: 'Non-contrast CT Head: No mass effect, no midline shift, no cerebral edema or hydrocephalus. Cisterns clear.',
        turnaroundMinutes: 30,
        category: 'imaging',
        isIndicative: true,
      },
    },
    criticalInterventions: [
      {
        orderOrActionPattern: /ceftriaxone|cefotaxime|vancomycin|ampicillin|antibiotic/i,
        name: 'Empiric IV High-Dose Antibiotics (Ceftriaxone + Vancomycin)',
        targetMilestoneMinutes: 20,
      },
      {
        orderOrActionPattern: /dexamethasone|steroid/i,
        name: 'IV Dexamethasone Prior to or With First Antibiotic Dose',
        targetMilestoneMinutes: 20,
      },
    ],
    incidentalPool: [
      {
        id: 'inc_mening_1',
        title: 'Mild Asymptomatic Iron Deficiency',
        description: 'Hemogram notes Hb 10.2 g/dL, MCV 74 fL, Serum Ferritin 14 ng/mL.',
        correctAction: 'Initiate oral iron supplementation after acute infection resolves.',
        status: 'unnoticed',
      },
    ],
    gateMilestones: [
      {
        roleTag: 'EMERGENCY',
        patientContext: 'Febrile patient with headache, photophobia and neck stiffness; deciding the next step.',
        consequenceOnRight: 'Blood cultures drawn and IV Ceftriaxone + Vancomycin + Dexamethasone administered within 20 mins.',
        consequenceOnWrong: 'Delaying antibiotics for imaging/LP increases mortality and permanent neurological sequelae!',
      },
    ],
  },

  // 7. Acute Appendicitis
  {
    id: 'scaffold_appendicitis',
    title: 'Migratory Abdominal Pain in Young Male',
    conditionName: 'Acute Appendicitis',
    subject: 'Surgery',
    system: 'Gastroenterology',
    demographics: {
      name: 'Rohan Mehta',
      age: 22,
      gender: 'Male',
      setting: 'Emergency',
    },
    openingVignette: 'A 22-year-old male presents with 16 hours of right lower quadrant abdominal pain. Pain started periumbilically last night, then migrated to right iliac fossa. Associated with low-grade fever, nausea, and anorexia.',
    initialVitals: {
      hr: 98,
      bp: '122/78',
      rr: 18,
      spo2: 99,
      temp: '38.1°C',
      grbs: 94,
    },
    clinchingClue: 'Marked tenderness at McBurney point with localized guarding, rebound tenderness (Rovsing sign positive), Alvarado Score 8.',
    clinchingClueTimeMinutes: 10,
    examFindingsMap: {
      abdomen: 'Flat, moves with respiration. Maximal tenderness at McBurney point (1/3 distance from ASIS to umbilicus). Guarding present in RIF. Positive Rovsing sign (left-sided pressure elicits RIF pain). Positive Psoas sign.',
      general: 'Low grade fever (38.1°C), dry tongue.',
      cvs: 'HR 98, regular pulse.',
      chest: 'Clear bilaterally.',
    },
    historyMap: {
      allergies: 'No known allergies.',
      past: 'No previous surgeries. No chronic illness.',
    },
    investigationsMap: {
      'cbc': {
        resultText: 'CBC: Leukocytosis WBC 14,800/mcL with 84% Neutrophils (Left shift). Hb 14.8 g/dL, Platelets 260,000/mcL.',
        turnaroundMinutes: 20,
        category: 'labs',
        isIndicative: true,
      },
      'usg_abdomen': {
        resultText: 'Ultrasound Abdomen: Non-compressible, blind-ending tubular structure in right iliac fossa measuring 8.2mm in diameter with target sign appearance and surrounding periappendiceal fat striding.',
        turnaroundMinutes: 25,
        category: 'imaging',
        isIndicative: true,
      },
      'urinalysis': {
        resultText: 'Urine Routine: Normal, 1-2 WBCs/HPF, no RBCs or nitrites.',
        turnaroundMinutes: 10,
        category: 'labs',
        isIndicative: true,
      },
    },
    criticalInterventions: [
      {
        orderOrActionPattern: /npo|nil per os|iv fluids/i,
        name: 'Keep NPO & Start Maintenance IV Fluids',
        targetMilestoneMinutes: 15,
      },
      {
        orderOrActionPattern: /appendectomy|surgery|consult surgery/i,
        name: 'Urgent Surgical Consult / Appendectomy',
        targetMilestoneMinutes: 45,
      },
    ],
    incidentalPool: [
      {
        id: 'inc_app_1',
        title: 'Solitary Left Renal Cyst',
        description: 'USG notes a 12mm simple thin-walled cortical cyst in left kidney (Bosniak I).',
        correctAction: 'Reassure patient — benign finding requiring no follow-up.',
        status: 'unnoticed',
      },
    ],
    gateMilestones: [
      {
        roleTag: 'MANAGEMENT',
        patientContext: 'Migratory right lower quadrant pain with an Alvarado score of 8; deciding definitive management.',
        consequenceOnRight: 'Patient kept NPO, started on IV prophylactic antibiotics and posted for appendectomy.',
        consequenceOnWrong: 'Conservative management leads to appendiceal perforation and peritonitis.',
      },
    ],
  },

  // 8. Severe Acute Malnutrition (SAM) with Shock
  {
    id: 'scaffold_sam_shock',
    title: 'Severe Lethargy & Diarrhea in 14-Month Child',
    conditionName: 'SAM with Septic/Hypovolemic Shock',
    subject: 'Pediatrics',
    system: 'Gastroenterology',
    demographics: {
      name: 'Aarav (Child)',
      age: 1,
      gender: 'Male',
      setting: 'Emergency',
    },
    openingVignette: 'A 14-month-old male toddler is brought to pediatric emergency by mother with 3 days of watery diarrhea, poor feeding, and extreme lethargy. Weight is 5.8 kg (MUAC 10.5 cm, < -3 SD WFH). He is obtunded with weak rapid pulse and cold peripheries.',
    initialVitals: {
      hr: 168,
      bp: '60/38',
      rr: 44,
      spo2: 91,
      temp: '35.6°C',
      grbs: 42,
    },
    clinchingClue: 'Severe Acute Malnutrition (MUAC 10.5 cm, visible severe wasting) in fluid-refractory shock with Hypoglycemia (GRBS 42 mg/dL) and Hypothermia (35.6°C).',
    clinchingClueTimeMinutes: 5,
    examFindingsMap: {
      general: 'Severe muscle wasting, loss of subcutaneous fat (baggy pants appearance), MUAC 10.5 cm, lethargic, hypothermic (35.6°C).',
      cvs: 'Tachycardic 168 bpm, weak thready radial pulses, capillary refill time 5 seconds, cold extremities.',
      chest: 'Tachypneic, vesicular breath sounds.',
      abdomen: 'Scaphoid, skin pinch goes back very slowly (>2 seconds).',
      neuro: 'Lethargic, responds weakly to painful stimuli.',
    },
    historyMap: {
      allergies: 'No known allergies.',
      past: 'Weaned prematurely at 3 months, fed diluted buffalo milk. Unvaccinated.',
    },
    investigationsMap: {
      'grbs': {
        resultText: 'STAT GRBS: 42 mg/dL — Severe Hypoglycemia!',
        turnaroundMinutes: 2,
        category: 'labs',
        isIndicative: true,
      },
      'electrolytes': {
        resultText: 'Serum Electrolytes: Na+ 124 mEq/L, K+ 2.8 mEq/L (Severe Hypokalemia), Ca2+ 7.2 mg/dL.',
        turnaroundMinutes: 20,
        category: 'labs',
        isIndicative: true,
      },
      'cbc': {
        resultText: 'CBC: Hb 6.4 g/dL (Severe Microcytic Hypochromic Anemia), WBC 16,500/mcL, Platelets 180,000/mcL.',
        turnaroundMinutes: 20,
        category: 'labs',
        isIndicative: true,
      },
    },
    criticalInterventions: [
      {
        orderOrActionPattern: /10% dextrose|d10w|glucose/i,
        name: 'Immediate 10% Dextrose Bolus for Hypoglycemia',
        targetMilestoneMinutes: 5,
      },
      {
        orderOrActionPattern: /resomal|half strength darrow|cautious fluids/i,
        name: 'ReSoMal Fluid Therapy (Avoiding Rapid Standard Fluid Boluses)',
        targetMilestoneMinutes: 15,
      },
      {
        orderOrActionPattern: /ampicillin|gentamicin|ceftriaxone|antibiotic/i,
        name: 'Empiric Broad-Spectrum Parenteral Antibiotics',
        targetMilestoneMinutes: 20,
      },
    ],
    incidentalPool: [
      {
        id: 'inc_sam_1',
        title: 'Vitamin A Deficiency / Bitot Spots',
        description: 'Ophthalmic survey notes bilateral triangular foamy plaques on temporal conjunctiva (Bitot spots).',
        correctAction: 'Administer WHO Vitamin A protocol (200,000 IU orally on Days 1, 2, and 14).',
        status: 'unnoticed',
      },
    ],
    gateMilestones: [
      {
        roleTag: 'MANAGEMENT',
        patientContext: 'Severely malnourished child in shock; selecting the rehydration fluid.',
        consequenceOnRight: 'ReSoMal fluid given cautiously at 10 mL/kg/hr preventing cardiac overload.',
        consequenceOnWrong: 'Rapid standard RL bolus (e.g. 30 mL/kg) causes acute heart failure and pulmonary edema!',
      },
    ],
  },

  // 9. Acute Ischemic Stroke
  {
    id: 'scaffold_stroke',
    title: 'Sudden Right Hemiparesis & Aphasia',
    conditionName: 'Acute Ischemic Stroke (L MCA Territory)',
    subject: 'Medicine',
    system: 'Neurology',
    demographics: {
      name: 'Gopal Krishnan',
      age: 62,
      gender: 'Male',
      setting: 'Emergency',
    },
    openingVignette: 'A 62-year-old male arrives in emergency 75 minutes after sudden onset right-sided weakness, facial droop, and inability to speak while eating breakfast. Accompanied by daughter.',
    initialVitals: {
      hr: 88,
      bp: '168/96',
      rr: 18,
      spo2: 98,
      temp: '36.9°C',
      grbs: 124,
    },
    clinchingClue: 'NIHSS Score 14 (Expressive aphasia, Right hemiplegia 1/5 MRC, Right upper motor neuron facial palsy). Non-contrast CT Head rules out hemorrhage.',
    clinchingClueTimeMinutes: 20,
    examFindingsMap: {
      neuro: 'NIHSS 14. Expressive Broca aphasia. Right UMN facial palsy. Right arm motor 1/5, Right leg motor 2/5. Right plantar extensor (Babinski positive). Left side normal.',
      cvs: 'S1 S2 heard, irregular pulse noted (Atrial Fibrillation). BP 168/96 mmHg.',
      general: 'No external head trauma.',
    },
    historyMap: {
      allergies: 'No known allergies.',
      past: 'Hypertension 10 years, Atrial Fibrillation non-compliant with oral anticoagulation.',
    },
    investigationsMap: {
      'ct_head': {
        resultText: 'Non-contrast CT Head STAT: No acute intracranial hemorrhage. Subtle loss of insular ribbon on left and hyperdense left MCA sign. ASPECT Score 9/10.',
        turnaroundMinutes: 20,
        category: 'imaging',
        isIndicative: true,
      },
      'ecg': {
        resultText: '12-lead ECG: Atrial Fibrillation with controlled ventricular response at 88 bpm. No ST elevation.',
        turnaroundMinutes: 5,
        category: 'imaging',
        isIndicative: true,
      },
      'grbs': {
        resultText: 'GRBS: 124 mg/dL (Rules out hypoglycemia mimicking stroke).',
        turnaroundMinutes: 2,
        category: 'labs',
        isIndicative: true,
      },
    },
    criticalInterventions: [
      {
        orderOrActionPattern: /ct head|ct brain|imaging/i,
        name: 'Immediate Non-Contrast CT Head to Exclude Hemorrhage',
        targetMilestoneMinutes: 25,
      },
      {
        orderOrActionPattern: /tpa|alteplase|tenecteplase|thromboly/i,
        name: 'IV Thrombolysis (Alteplase) within 4.5 Hour Window',
        targetMilestoneMinutes: 45,
      },
    ],
    incidentalPool: [
      {
        id: 'inc_stroke_1',
        title: 'Mild Asymptomatic Carotid Plaque',
        description: 'Carotid Doppler reveals 35% non-stenotic calcified plaque at right carotid bulb.',
        correctAction: 'Initiate high-intensity statin therapy (Atorvastatin 80 mg OD).',
        status: 'unnoticed',
      },
    ],
    gateMilestones: [
      {
        roleTag: 'INVESTIGATION',
        patientContext: 'Acute focal neurological deficit within 4.5 hours onset.',
        consequenceOnRight: 'STAT NCCT Head performed ruling out hemorrhage.',
        consequenceOnWrong: 'Starting antiplatelet or thrombolysis before CT head risks fatal intracranial bleed!',
      },
    ],
  },

  // 10. Acute Upper GI Bleed
  {
    id: 'scaffold_ugib',
    title: 'Hematemesis and Melena in Emergency',
    conditionName: 'Acute Variceal Upper GI Bleed',
    subject: 'Medicine',
    system: 'Gastroenterology',
    demographics: {
      name: 'Mukesh Sharma',
      age: 51,
      gender: 'Male',
      setting: 'Emergency',
    },
    openingVignette: 'A 51-year-old male is brought to emergency by family after vomiting 400 mL of fresh red blood with clots 1 hour ago. He reports passing dark sticky foul-smelling stools for 2 days. On exam, he is pale, sweating, with postural dizziness and spider nevi on chest.',
    initialVitals: {
      hr: 122,
      bp: '88/54',
      rr: 24,
      spo2: 95,
      temp: '36.7°C',
      grbs: 110,
    },
    clinchingClue: 'Urgent Upper GI Endoscopy demonstrates grade 3 bleeding esophageal varices in lower third with active spurting blood.',
    clinchingClueTimeMinutes: 45,
    examFindingsMap: {
      general: 'Pale, diaphoretic, spider angiomas on upper chest, palmar erythema, mild jaundice in sclera.',
      cvs: 'Tachycardic 122 bpm, postural drop in BP to 78/46 mmHg on sitting.',
      chest: 'Clear to auscultation bilaterally.',
      abdomen: 'Distended with flank dullness, palpable splenomegaly 3cm below costal margin, non-tender.',
      neuro: 'Mild asterixis (flapping tremor), lethargic but easily arousable.',
    },
    historyMap: {
      allergies: 'No known allergies.',
      past: 'Chronic alcohol intake for 18 years (120g/day). Known Cirrhosis of liver for 2 years.',
      medications: 'Spironolactone, Propranolol (discontinued 3 days ago).',
    },
    investigationsMap: {
      'endoscopy': {
        resultText: 'Upper GI Endoscopy STAT: Grade III esophageal varices in lower 5cm with active oozing. Endoscopic Variceal Ligation (EVL) bands applied successfully with complete hemostasis.',
        turnaroundMinutes: 45,
        category: 'imaging',
        isIndicative: true,
      },
      'cbc': {
        resultText: 'CBC: Hb 6.8 g/dL (Severe Acute Anemia), WBC 9,200/mcL, Platelets 68,000/mcL (Thrombocytopenia secondary to hypersplenism).',
        turnaroundMinutes: 20,
        category: 'labs',
        isIndicative: true,
      },
      'lft': {
        resultText: 'LFT / Liver Panel: Total Bilirubin 3.2 mg/dL, Direct Bilirubin 2.1 mg/dL, AST 88 U/L, ALT 54 U/L, Serum Albumin 2.6 g/dL, INR 1.8.',
        turnaroundMinutes: 25,
        category: 'labs',
        isIndicative: true,
      },
      'blood_grouping': {
        resultText: 'Blood Grouping & Crossmatch: B Positive. 2 units Packed Red Blood Cells (PRBC) matched and ready.',
        turnaroundMinutes: 20,
        category: 'labs',
        isIndicative: true,
      },
    },
    criticalInterventions: [
      {
        orderOrActionPattern: /iv fluids|normal saline|wide bore|fluid resuscitation/i,
        name: 'Wide-Bore IV Access & Crystalloid Resuscitation',
        targetMilestoneMinutes: 10,
      },
      {
        orderOrActionPattern: /octreotide|terlipressin|somatostatin/i,
        name: 'Vasoactive Agent (Terlipressin or Octreotide) Infusion',
        targetMilestoneMinutes: 15,
      },
      {
        orderOrActionPattern: /ceftriaxone|norfloxacin|antibiotic/i,
        name: 'Prophylactic IV Antibiotics (Ceftriaxone)',
        targetMilestoneMinutes: 20,
      },
    ],
    incidentalPool: [
      {
        id: 'inc_ugib_1',
        title: 'Mild Asymptomatic Umbilical Hernia',
        description: 'Abdominal exam notes 1.5cm reducible non-tender umbilical hernia.',
        correctAction: 'Conservative observation — surgical repair deferred until ascites and liver disease stabilized.',
        status: 'unnoticed',
      },
    ],
    gateMilestones: [
      {
        roleTag: 'MANAGEMENT',
        patientContext: 'Active upper gastrointestinal bleeding with haemodynamic instability.',
        consequenceOnRight: 'Terlipressin + IV Ceftriaxone started and urgent EVL endoscopy performed.',
        consequenceOnWrong: 'Delaying octreotide/terlipressin and endoscopy leads to exsanguinating shock!',
      },
    ],
  },

  // 11. Urosepsis with Septic Shock
  {
    id: 'scaffold_urosepsis',
    title: 'High Fever, Rigors, and Confusion in Elderly Female',
    conditionName: 'Urosepsis with Septic Shock',
    subject: 'Medicine',
    system: 'Infectious Disease',
    demographics: {
      name: 'Kamla Devi',
      age: 70,
      gender: 'Female',
      setting: 'Emergency',
    },
    openingVignette: 'A 70-year-old diabetic female is brought to casualty with 24 hours of high-grade fever with shaking chills, dysuria, flank pain, and progressive altered mental status. On exam, she is lethargic, hypotensive (BP 82/48 mmHg), and oliguric.',
    initialVitals: {
      hr: 132,
      bp: '82/48',
      rr: 28,
      spo2: 93,
      temp: '39.8°C',
      grbs: 260,
    },
    clinchingClue: 'Left costovertebral angle tenderness, Urine Microscopy >100 WBCs/HPF with Gram-negative bacilli, Serum Lactate 4.6 mmol/L, refractory hypotension requiring vasopressors.',
    clinchingClueTimeMinutes: 15,
    examFindingsMap: {
      general: 'Febrile (39.8°C), toxic-looking, obtunded, dry oral mucosa.',
      abdomen: 'Left costovertebral angle (CVA) marked tenderness on light percussion. Suprapubic tenderness present.',
      cvs: 'Tachycardic 132 bpm, weak peripheral pulses, BP 82/48 mmHg.',
      chest: 'Bilateral basal crackles.',
      neuro: 'GCS 12/15 (E3V4M5), disoriented to time and place.',
    },
    historyMap: {
      allergies: 'No known allergies.',
      past: 'Type 2 Diabetes Mellitus for 15 years, recurrent UTIs.',
    },
    investigationsMap: {
      'lactate': {
        resultText: 'Serum Lactate STAT: 4.6 mmol/L (Reference <1.5 mmol/L) — Severe Tissue Hypoperfusion / Lactic Acidosis.',
        turnaroundMinutes: 10,
        category: 'labs',
        isIndicative: true,
      },
      'urinalysis': {
        resultText: 'Urine Routine: Cloudy, Leukocyte Esterase positive, Nitrites positive, >100 WBCs/HPF, Gram-negative rods seen.',
        turnaroundMinutes: 10,
        category: 'labs',
        isIndicative: true,
      },
      'cbc': {
        resultText: 'CBC: WBC 22,400/mcL with 92% Neutrophils (Bandemia 12%), Hb 11.2 g/dL, Platelets 110,000/mcL.',
        turnaroundMinutes: 20,
        category: 'labs',
        isIndicative: true,
      },
      'usg_kubb': {
        resultText: 'USG KUB: Enlarged hydronephrotic left kidney with perinephric fluid collection consistent with acute pyelonephritis / impending abscess.',
        turnaroundMinutes: 25,
        category: 'imaging',
        isIndicative: true,
      },
    },
    criticalInterventions: [
      {
        orderOrActionPattern: /blood culture|urine culture|culture/i,
        name: 'Blood & Urine Cultures Before Antibiotics',
        targetMilestoneMinutes: 10,
      },
      {
        orderOrActionPattern: /meropenem|piperacillin|tazobactam|ceftriaxone|broad spectrum/i,
        name: 'Empiric Broad-Spectrum IV Antibiotics',
        targetMilestoneMinutes: 15,
      },
      {
        orderOrActionPattern: /fluid bolus|30 ml\/kg|crystalloid|normal saline/i,
        name: '30 mL/kg Crystalloid Fluid Resuscitation for Septic Shock',
        targetMilestoneMinutes: 20,
      },
    ],
    incidentalPool: [
      {
        id: 'inc_urosep_1',
        title: 'Asymptomatic 4mm Non-Obstructing Right Renal Calculus',
        description: 'USG KUB notes a 4mm non-shadowing stone in right lower pole calyx without hydronephrosis.',
        correctAction: 'Conservative management with oral hydration post-sepsis recovery.',
        status: 'unnoticed',
      },
    ],
    gateMilestones: [
      {
        roleTag: 'EMERGENCY',
        patientContext: 'Shock with a markedly raised serum lactate in a patient with urinary symptoms.',
        consequenceOnRight: 'Hour-1 Sepsis Bundle completed: Cultures, Lactate, IV Antibiotics, and 30 mL/kg fluid bolus.',
        consequenceOnWrong: 'Delayed fluid resuscitation and broad-spectrum coverage leads to multi-organ dysfunction syndrome (MODS).',
      },
    ],
  },

  // 12. Post-MI Mechanical Complication (VSR)
  {
    id: 'scaffold_post_mi_comp',
    title: 'Sudden Hypotension and New Murmur Post-MI',
    conditionName: 'Post-MI Ventricular Septal Rupture (VSR)',
    subject: 'Medicine',
    system: 'Cardiology',
    demographics: {
      name: 'Harish Chandra',
      age: 65,
      gender: 'Male',
      setting: 'ICU',
    },
    openingVignette: 'A 65-year-old male on Day 4 post extensive anterior wall MI develops sudden collapse, dyspnea, and severe hypotension in the cardiac ward. On exam, he is cold, clammy, with a new harsh pan-systolic murmur with palpable thrill at lower left sternal border.',
    initialVitals: {
      hr: 126,
      bp: '76/42',
      rr: 30,
      spo2: 84,
      temp: '36.5°C',
      grbs: 140,
    },
    clinchingClue: 'Bedside Echocardiogram reveals 14mm solution of continuity in muscular interventricular septum with left-to-right shunt and RV volume overload.',
    clinchingClueTimeMinutes: 15,
    examFindingsMap: {
      cvs: 'Tachycardic 126 bpm, Grade 4/6 harsh pansystolic murmur loudest at 4th left intercostal space with palpable thrill. Elevated JVP.',
      chest: 'Bilateral extensive crepitations throughout lung fields (Acute Pulmonary Edema).',
      general: 'Cardiogenic shock, cold clammy extremities, oliguria.',
      neuro: 'Drowsy, confused due to low cerebral perfusion.',
    },
    historyMap: {
      allergies: 'No known drug allergies.',
      past: 'Anterior wall STEMI 4 days ago managed conservatively at home before presentation.',
    },
    investigationsMap: {
      'echo': {
        resultText: 'Bedside Transthoracic Echocardiogram: 14mm ventricular septal defect in apical septum with high velocity Left-to-Right shunt on color Doppler. Severe RV strain, severe pulmonary hypertension.',
        turnaroundMinutes: 15,
        category: 'imaging',
        isIndicative: true,
      },
      'cxr': {
        resultText: 'Bedside CXR: Bilateral dense pulmonary edema (butterfly/bat-wing appearance) with cardiomegaly.',
        turnaroundMinutes: 15,
        category: 'imaging',
        isIndicative: true,
      },
      'abg': {
        resultText: 'ABG: pH 7.22, PaCO2 32 mmHg, PaO2 52 mmHg, HCO3 13 mEq/L, Lactate 5.2 mmol/L (Cardiogenic Shock with Lactic Acidosis).',
        turnaroundMinutes: 10,
        category: 'labs',
        isIndicative: true,
      },
    },
    criticalInterventions: [
      {
        orderOrActionPattern: /iabp|intra-aortic balloon|inotropes|norepinephrine|dobutamine/i,
        name: 'Hemodynamic Support (Inotropes / IABP)',
        targetMilestoneMinutes: 15,
      },
      {
        orderOrActionPattern: /cardiac surgery|surgical consult|vsr repair/i,
        name: 'Urgent Cardiac Surgical Consult for Operative Repair',
        targetMilestoneMinutes: 30,
      },
    ],
    incidentalPool: [
      {
        id: 'inc_vsr_1',
        title: 'Prostate Enlargement',
        description: 'Abdominal ultrasound notes 45cc enlarged prostate with mild bladder wall thickening.',
        correctAction: 'Place Foley catheter for accurate urine output monitoring in shock.',
        status: 'unnoticed',
      },
    ],
    gateMilestones: [
      {
        roleTag: 'DIAGNOSIS',
        patientContext: 'Day 4 post-MI patient presenting with sudden cardiogenic shock and new pansystolic murmur with thrill.',
        consequenceOnRight: 'Ventricular Septal Rupture correctly diagnosed and urgent IABP + surgical repair initiated.',
        consequenceOnWrong: 'Misdiagnosed as recurrent ischemia or free mitral regurgitation delaying definitive surgical repair.',
      },
    ],
  }
];

