import React, { useState } from 'react';
import { Send, Stethoscope, FileText, Pill, Activity, Compass, Clock, Sparkles, ChevronDown, Eye } from 'lucide-react';
import { OrderCategory } from '../types';

interface CommandPanelProps {
  onSendCommand: (command: string) => void;
  isProcessing: boolean;
  disabled?: boolean;
}

export const CommandPanel: React.FC<CommandPanelProps> = ({
  onSendCommand,
  isProcessing,
  disabled = false,
}) => {
  const [inputText, setInputText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<OrderCategory | 'quick' | 'exam'>('quick');

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isProcessing || disabled) return;
    onSendCommand(inputText.trim());
    setInputText('');
  };

  const handleQuickCommand = (cmd: string) => {
    if (isProcessing || disabled) return;
    onSendCommand(cmd);
  };

  // Quick Clinical Order Bundles
  const quickBundles = [
    { label: '🩺 Perform Full Hx & PE', cmd: 'hx: Detailed clinical history & physical examination' },
    { label: '🩸 STAT ACS Panel', cmd: 'order: ECG 12-lead, Troponin I, CK-MB, CBC, KFT, LFT, CXR portable' },
    { label: '🫁 STAT Dyspnea Panel', cmd: 'order: ABG, CXR PA view, D-Dimer, ECG, BNP, NT-proBNP' },
    { label: '🧪 Sepsis Workup', cmd: 'order: Blood Cultures x2, Urine Culture, Serum Lactate, CBC, Procalcitonin, IV Normal Saline 30mL/kg' },
    { label: '💉 IV Access & Vitals', cmd: 'order: 2 wide-bore IV cannulae, continuous ECG & SpO2 monitoring, Foley catheter' },
    { label: '🧠 Neuro Stroke Panel', cmd: 'order: Non-contrast CT Head STAT, GRBS, Serum Electrolytes, Coagulation Profile (PT/INR)' },
  ];

  const examTemplates = [
    { label: '📋 Focused Clinical History', cmd: 'hx: Obtain history of chief complaint, onset, duration, past illness, medications' },
    { label: '👁️ General Physical Exam', cmd: 'pe: Examine for pallor, icterus, cyanosis, clubbing, lymphadenopathy, edema' },
    { label: '🫀 Cardiovascular Exam', cmd: 'pe: Auscultate S1, S2, heart sounds, murmurs, jugular venous pressure' },
    { label: '🫁 Respiratory System Exam', cmd: 'pe: Inspection, percussion, auscultate bilateral breath sounds, crepitations' },
    { label: '🪵 Abdomen & Pelvis Exam', cmd: 'pe: Palpation for tenderness, guarding, rebound, organomegaly, bowel sounds' },
    { label: '🧠 Neurological Examination', cmd: 'pe: Cranial nerves, motor tone/power, reflexes, sensation, cerebellar signs' },
  ];

  const categoryTemplates: Record<OrderCategory, { label: string; cmd: string }[]> = {
    labs: [
      { label: 'CBC & Peripheral Smear', cmd: 'order: Complete Blood Count with differential and peripheral blood smear' },
      { label: 'Liver Function Tests (LFT)', cmd: 'order: Liver Function Tests (Bilirubin, SGOT, SGPT, ALP, Serum Albumin)' },
      { label: 'Renal Function & Electrolytes', cmd: 'order: Kidney Function Test (Urea, Creatinine) and Serum Na+, K+, Cl-, Ca2+' },
      { label: 'Cardiac Biomarkers', cmd: 'order: High-sensitivity Troponin I and CK-MB' },
      { label: 'Coagulation Profile', cmd: 'order: Prothrombin Time (PT/INR) and Activated Partial Thromboplastin Time (aPTT)' },
    ],
    imaging: [
      { label: '12-Lead ECG', cmd: 'order: STAT 12-lead Electrocardiogram' },
      { label: 'Chest X-Ray PA View', cmd: 'order: Chest X-Ray PA view upright' },
      { label: 'CT Pulmonary Angiography (CTPA)', cmd: 'order: CT Pulmonary Angiography with IV contrast' },
      { label: 'USG Abdomen & Pelvis', cmd: 'order: Ultrasonography of whole abdomen and FAST scan' },
      { label: 'HRCT Chest', cmd: 'order: High Resolution CT Chest non-contrast' },
    ],
    drugs: [
      { label: 'Aspirin + Clopidogrel (ACS)', cmd: 'order: Aspirin 300mg chewed + Clopidogrel 300mg PO STAT' },
      { label: 'IV Streptokinase 1.5M IU', cmd: 'order: IV Streptokinase 1.5 million units in 100mL 5% Dextrose over 60 min' },
      { label: 'IV Normal Saline Bolus', cmd: 'order: IV 0.9% Normal Saline 1000mL rapid bolus' },
      { label: 'IV Ceftriaxone + Azithromycin', cmd: 'order: IV Ceftriaxone 2g STAT + IV Azithromycin 500mg' },
      { label: 'IV Magnesium Sulfate 4g', cmd: 'order: IV Magnesium Sulfate 4g slow IV push over 10-15 min' },
    ],
    consults: [
      { label: 'Cardiology Consult STAT', cmd: 'order: Urgent Cardiology consultation for Primary PCI evaluation' },
      { label: 'General Surgery Consult', cmd: 'order: Emergency General Surgery consultation for acute abdomen' },
      { label: 'ICU / Critical Care Consult', cmd: 'order: Critical Care team consult for ventilator and vasopressor management' },
      { label: 'Pulmonology Consult', cmd: 'order: Pulmonology opinion for solitary pulmonary nodule follow-up' },
    ],
    procedures: [
      { label: 'Endotracheal Intubation', cmd: 'order: Endotracheal intubation and mechanical ventilation' },
      { label: 'Needle Thoracostomy', cmd: 'order: Emergency needle thoracostomy in 2nd intercostal space midclavicular line' },
      { label: 'Intercostal Chest Drain (ICD)', cmd: 'order: Insertion of Intercostal Chest Drain on affected side' },
      { label: 'Foley Catheterization', cmd: 'order: Insertion of Foley urethral catheter for strict urine output monitoring' },
    ],
    monitoring: [
      { label: 'Transfer to ICU', cmd: 'move to ICU' },
      { label: 'Transfer to Operating Room (OT)', cmd: 'move to OT' },
      { label: 'Transfer to Inpatient Ward', cmd: 'move to Ward' },
      { label: 'Advance Clock 30 minutes', cmd: 'advance 30 minutes' },
      { label: 'Advance Clock 2 hours', cmd: 'advance 2 hours' },
    ]
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
      {/* Input Command Form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-slate-400 font-semibold flex items-center space-x-1.5">
            <Stethoscope className="w-3.5 h-3.5 text-cyan-400" />
            <span>USMLE STEP 3 ORDER & INTERACTION BAR:</span>
          </span>
          <span className="text-slate-500 hidden sm:inline">
            Prefixes: <code className="text-cyan-300">order:</code> | <code className="text-amber-300">hx:</code> | <code className="text-emerald-300">pe:</code> | <code className="text-purple-300">move to</code> | <code className="text-blue-300">advance</code>
          </span>
        </div>

        <div className="relative flex items-center">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isProcessing || disabled}
            placeholder='e.g., order: STAT 12-lead ECG, Troponin I, Aspirin 300mg | hx: allergies | pe: chest exam'
            className="w-full bg-slate-950 border border-slate-700/80 rounded-xl py-3 pl-4 pr-28 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-50 font-sans"
          />

          <button
            type="submit"
            disabled={!inputText.trim() || isProcessing || disabled}
            className="absolute right-1.5 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-medium px-4 py-2 rounded-lg text-xs transition shadow flex items-center space-x-1.5 disabled:opacity-40 cursor-pointer"
          >
            {isProcessing ? (
              <span className="flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                <span>Executing...</span>
              </span>
            ) : (
              <>
                <span>Execute Order</span>
                <Send className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </form>

      {/* Category Tabs for Quick Templates */}
      <div className="space-y-2 pt-1">
        <div className="flex space-x-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          <button
            type="button"
            onClick={() => setSelectedCategory('quick')}
            className={`px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap cursor-pointer ${
              selectedCategory === 'quick'
                ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            ⚡ STAT Bundles
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory('exam')}
            className={`px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap cursor-pointer ${
              selectedCategory === 'exam'
                ? 'bg-amber-600/30 text-amber-300 border border-amber-500/40'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            🩺 Hx & Physical Exam
          </button>
          {(['labs', 'imaging', 'drugs', 'consults', 'procedures', 'monitoring'] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg font-medium transition capitalize whitespace-nowrap cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Templates Grid */}
        <div className="flex flex-wrap gap-2 pt-1">
          {selectedCategory === 'quick' ? (
            quickBundles.map((b, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleQuickCommand(b.cmd)}
                disabled={isProcessing || disabled}
                className="bg-slate-950/80 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 px-3 py-1.5 rounded-lg text-xs transition flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
              >
                <span>{b.label}</span>
              </button>
            ))
          ) : selectedCategory === 'exam' ? (
            examTemplates.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleQuickCommand(item.cmd)}
                disabled={isProcessing || disabled}
                className="bg-slate-950/80 hover:bg-slate-800 text-amber-200 border border-slate-800 hover:border-amber-500/40 px-3 py-1.5 rounded-lg text-xs transition flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
              >
                <span>{item.label}</span>
              </button>
            ))
          ) : (
            categoryTemplates[selectedCategory]?.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleQuickCommand(item.cmd)}
                disabled={isProcessing || disabled}
                className="bg-slate-950/80 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 px-3 py-1.5 rounded-lg text-xs transition flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
              >
                <span>{item.label}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

