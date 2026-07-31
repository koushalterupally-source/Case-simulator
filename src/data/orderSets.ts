/**
 * The order sheet catalogue.
 *
 * Written the way it would appear on an Indian hospital CPOE / CCS order sheet,
 * grouped the way a doctor reaches for things, not the way the data model
 * happens to be shaped. Names are what the engine matches against the
 * scaffold's investigationsMap, so keep them conventional.
 */

export interface OrderGroup {
  id: string;
  label: string;
  /** Sub-headings inside a group, to avoid one flat list of ninety items. */
  sections: { label: string; items: string[] }[];
}

export const ORDER_GROUPS: OrderGroup[] = [
  {
    id: 'bloods',
    label: 'Bloods',
    sections: [
      {
        label: 'Routine',
        items: [
          'CBC / Hemogram',
          'Peripheral smear',
          'ESR',
          'CRP',
          'Procalcitonin',
          'Blood grouping & cross-match',
        ],
      },
      {
        label: 'Biochemistry',
        items: [
          'RFT / KFT (urea, creatinine)',
          'LFT',
          'Serum electrolytes (Na, K, Cl)',
          'Serum calcium',
          'Serum magnesium',
          'Serum phosphate',
          'RBS / GRBS',
          'HbA1c',
          'Serum lactate',
          'Serum amylase & lipase',
          'Serum ammonia',
          'TFT (TSH, free T4)',
          'Iron studies & ferritin',
        ],
      },
      {
        label: 'Cardiac & coagulation',
        items: [
          'Troponin I',
          'CK-MB',
          'NT-proBNP',
          'D-dimer',
          'PT / INR',
          'aPTT',
          'Fibrinogen',
        ],
      },
      {
        label: 'Gases & cultures',
        items: [
          'ABG',
          'VBG',
          'Blood culture ×2 (before antibiotics)',
          'Serum ketones',
          'Serum osmolality',
        ],
      },
    ],
  },
  {
    id: 'urine',
    label: 'Urine & other',
    sections: [
      {
        label: 'Urine',
        items: [
          'Urine routine & microscopy',
          'Urine culture & sensitivity',
          'Urine ketones',
          'Urine pregnancy test',
          'Urine protein / creatinine ratio',
          'Urine output charting',
        ],
      },
      {
        label: 'Fluids & taps',
        items: [
          'CSF analysis',
          'Pleural fluid analysis',
          'Ascitic fluid analysis',
          'Sputum Gram stain & culture',
          'Sputum AFB / CBNAAT',
          'Stool routine',
        ],
      },
    ],
  },
  {
    id: 'imaging',
    label: 'Imaging',
    sections: [
      {
        label: 'Plain film & ultrasound',
        items: [
          'Chest X-ray PA',
          'Chest X-ray portable',
          'X-ray abdomen erect',
          'USG abdomen & pelvis',
          'FAST scan',
          'USG chest for effusion',
          'Doppler lower limb veins',
          'Bedside ECHO',
          'Formal 2D ECHO',
        ],
      },
      {
        label: 'Cross-sectional',
        items: [
          'CT head plain',
          'CT head contrast',
          'CT pulmonary angiography (CTPA)',
          'CT chest',
          'CT abdomen & pelvis contrast',
          'MRI brain',
          'MR angiography',
          'Coronary angiography',
        ],
      },
    ],
  },
  {
    id: 'monitoring',
    label: 'Bedside',
    sections: [
      {
        label: 'Monitoring',
        items: [
          '12-lead ECG',
          'Continuous cardiac monitoring',
          'Continuous pulse oximetry',
          'NIBP monitoring',
          'Invasive arterial line',
          'Central venous pressure monitoring',
          'Hourly GCS charting',
          'Strict input-output charting',
          'Fundoscopy',
        ],
      },
    ],
  },
  {
    id: 'fluids',
    label: 'Fluids & blood',
    sections: [
      {
        label: 'Crystalloid',
        items: [
          'Normal saline 0.9% 500 mL bolus',
          'Normal saline 30 mL/kg bolus',
          'Ringer lactate 500 mL bolus',
          'Ringer lactate maintenance',
          'DNS maintenance',
          '5% Dextrose infusion',
          '25% Dextrose 100 mL IV',
          '3% Hypertonic saline',
          'ReSoMal (malnutrition rehydration)',
          'ORS oral',
        ],
      },
      {
        label: 'Blood products',
        items: [
          'Packed red cells',
          'Fresh frozen plasma',
          'Platelet concentrate',
          'Cryoprecipitate',
        ],
      },
    ],
  },
  {
    id: 'drugs',
    label: 'Drugs',
    sections: [
      {
        label: 'Cardiac',
        items: [
          'Aspirin 325 mg chewed',
          'Clopidogrel 300 mg loading',
          'Ticagrelor 180 mg loading',
          'Atorvastatin 80 mg',
          'Unfractionated heparin bolus',
          'Enoxaparin subcutaneous',
          'Tenecteplase (thrombolysis)',
          'Streptokinase infusion',
          'Metoprolol IV',
          'Nitroglycerin infusion',
          'Adenosine 6 mg rapid IV',
          'Amiodarone 150 mg IV',
          'Atropine 0.6 mg IV',
          'Adrenaline 1 mg IV',
          'Noradrenaline infusion',
          'Dobutamine infusion',
        ],
      },
      {
        label: 'Antimicrobial',
        items: [
          'Ceftriaxone 2 g IV',
          'Vancomycin IV',
          'Meropenem IV',
          'Piperacillin-tazobactam IV',
          'Metronidazole IV',
          'Azithromycin',
          'Doxycycline',
          'Colistin IV',
          'Acyclovir IV',
          'Artesunate IV',
        ],
      },
      {
        label: 'Critical care & other',
        items: [
          'Dexamethasone IV',
          'Hydrocortisone IV',
          'Insulin infusion',
          'Potassium chloride in infusion',
          'Sodium bicarbonate IV',
          'Magnesium sulfate (Pritchard regimen)',
          'Labetalol IV',
          'Hydralazine IV',
          'Nifedipine oral',
          'Mannitol 20%',
          'Levetiracetam IV',
          'Lorazepam IV',
          'Phenytoin loading',
          'Furosemide IV',
          'Pantoprazole infusion',
          'Octreotide infusion',
          'Terlipressin',
          'Tranexamic acid',
          'Salbutamol nebulisation',
          'Ipratropium nebulisation',
          'Morphine IV',
          'Paracetamol IV',
          'Ondansetron IV',
          'Naloxone IV',
          'Thiamine IV',
          'Vitamin K IV',
          'Supplemental oxygen',
        ],
      },
    ],
  },
  {
    id: 'procedures',
    label: 'Procedures',
    sections: [
      {
        label: 'Access & airway',
        items: [
          'Two wide-bore IV cannulae',
          'Central venous catheter',
          'Foley catheterisation',
          'Nasogastric tube',
          'Endotracheal intubation',
          'Mechanical ventilation',
          'Non-invasive ventilation',
          'High-flow nasal oxygen',
        ],
      },
      {
        label: 'Interventions',
        items: [
          'Needle decompression 2nd ICS',
          'Intercostal chest drain',
          'Lumbar puncture',
          'Ascitic tap',
          'Pleural tap',
          'Pericardiocentesis',
          'Synchronised cardioversion',
          'Defibrillation',
          'CPR',
          'Upper GI endoscopy',
          'Primary PCI',
          'Emergency laparotomy',
          'Haemodialysis',
        ],
      },
    ],
  },
  {
    id: 'consults',
    label: 'Consults & disposition',
    sections: [
      {
        label: 'Refer to',
        items: [
          'Cardiology consult',
          'Neurology consult',
          'General surgery consult',
          'Obstetrics consult',
          'Anaesthesia / ICU consult',
          'Nephrology consult',
          'Gastroenterology consult',
          'CTVS consult',
          'Paediatrics consult',
        ],
      },
      {
        label: 'Disposition & supportive',
        items: [
          'Move to ICU',
          'Move to Ward',
          'Move to OT',
          'Nil by mouth',
          'Head end elevation 30°',
          'DVT prophylaxis',
          'Stress ulcer prophylaxis',
          'Vaccination before discharge',
          'Counselling & discharge advice',
        ],
      },
    ],
  },
];

/** History questions offered on the history tab. */
export const HISTORY_PROMPTS: { label: string; section: string }[] = [
  { section: 'Presenting complaint', label: 'When did it start and how did it progress?' },
  { section: 'Presenting complaint', label: 'Where is the pain and does it radiate?' },
  { section: 'Presenting complaint', label: 'What makes it better or worse?' },
  { section: 'Presenting complaint', label: 'Any fever, chills or sweats?' },
  { section: 'Presenting complaint', label: 'Any breathlessness or chest pain?' },
  { section: 'Presenting complaint', label: 'Any vomiting, diarrhoea or urinary symptoms?' },
  { section: 'Background', label: 'Past medical and surgical history' },
  { section: 'Background', label: 'Current medications' },
  { section: 'Background', label: 'Drug allergies' },
  { section: 'Background', label: 'Family history' },
  { section: 'Background', label: 'Smoking, alcohol and substance use' },
  { section: 'Background', label: 'Immunisation history' },
  { section: 'Background', label: 'Menstrual and obstetric history' },
  { section: 'Background', label: 'Recent travel or contact history' },
];

/** Systems offered on the examination tab. */
export const EXAM_SYSTEMS: string[] = [
  'General examination',
  'Vitals recheck',
  'Cardiovascular',
  'Respiratory / chest',
  'Abdomen',
  'Central nervous system',
  'Neck stiffness & meningeal signs',
  'Peripheral pulses',
  'JVP',
  'Skin & extremities',
  'Fundus',
  'Obstetric examination',
];
