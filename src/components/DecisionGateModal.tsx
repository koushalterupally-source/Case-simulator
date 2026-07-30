import React, { useState } from 'react';
import { Zap, AlertTriangle, CheckCircle2, XCircle, ArrowRight, BookOpen, ShieldAlert, Sparkles, X } from 'lucide-react';
import { DecisionGate } from '../types';

interface DecisionGateModalProps {
  gate: DecisionGate;
  onCommitAnswer: (answer: string) => void;
  onClose: () => void;
  blindMode?: boolean;
}

export const DecisionGateModal: React.FC<DecisionGateModalProps> = ({
  gate,
  onCommitAnswer,
  onClose,
  blindMode = false,
}) => {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [freeTextAnswer, setFreeTextAnswer] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(!!gate.userAnswer);

  const pyq = gate.pyq;

  // Reset local form state whenever a new gate is passed
  React.useEffect(() => {
    setSelectedOption(null);
    setFreeTextAnswer('');
    setIsSubmitted(!!gate.userAnswer);
  }, [gate.id, gate.pyq.qid, gate.userAnswer]);

  const handleSubmit = (choice: string) => {
    if (!choice) return;
    setIsSubmitted(true);
    onCommitAnswer(choice);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border-2 border-amber-500/80 rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in duration-200 relative">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600/30 via-slate-900 to-indigo-900/40 p-4 sm:p-5 border-b border-amber-500/30 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-amber-500/20 text-amber-400 p-2 rounded-lg border border-amber-500/40 animate-pulse">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-amber-400 font-bold font-mono text-sm tracking-wide">
                  ⚡ DECISION GATE
                </span>
                <span className="bg-slate-800 text-amber-300 border border-amber-500/30 font-mono text-xs px-2.5 py-0.5 rounded-md font-semibold">
                  QID: {pyq.qid}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {pyq.exam} {pyq.year} • {pyq.subject} ({pyq.system}) • Role: <span className="text-amber-300 font-mono font-bold">{pyq.roleTag}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <span className="bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[10px] uppercase tracking-wider font-mono font-bold px-2 py-1 rounded hidden sm:inline-block">
              Clock Frozen
            </span>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 p-1.5 rounded-lg transition"
              title="Close and return to simulation"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-6">
          
          {/* Patient Context Note */}
          <div className="bg-slate-800/80 border-l-4 border-amber-500 p-3.5 rounded-r-lg text-xs text-slate-200 font-sans">
            <span className="font-bold text-amber-400">Clinical Context: </span>
            {gate.patientContext}
          </div>

          {/* Question Stem */}
          <div className="bg-slate-950 p-4 sm:p-5 rounded-xl border border-slate-800 text-slate-100 leading-relaxed font-sans text-sm sm:text-base">
            <p className="font-medium">{pyq.stem}</p>
          </div>

          {/* Options A/B/C/D or Blind Mode */}
          {!isSubmitted ? (
            blindMode ? (
              <div className="space-y-3">
                <label className="block text-xs font-mono text-amber-300 uppercase tracking-wider font-semibold">
                  Blind Mode: Enter your free-text clinical decision / order before viewing options
                </label>
                <textarea
                  value={freeTextAnswer}
                  onChange={(e) => setFreeTextAnswer(e.target.value)}
                  placeholder="Type your precise management plan, drug, or investigation..."
                  className="w-full h-28 bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
                <button
                  onClick={() => handleSubmit(freeTextAnswer || 'Submitted')}
                  disabled={!freeTextAnswer.trim()}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-3 rounded-xl shadow-lg transition flex items-center justify-center space-x-2 text-sm disabled:opacity-50 cursor-pointer"
                >
                  <span>Commit Free-Text Decision</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs font-mono text-slate-400 uppercase tracking-wider font-semibold">
                  Commit with one letter. No hints until you commit.
                </p>
                <div className="grid grid-cols-1 gap-2.5">
                  {(['A', 'B', 'C', 'D'] as const).map((key) => {
                    const text = pyq.options[key];
                    const isSelected = selectedOption === key;
                    return (
                      <button
                        key={key}
                        onClick={() => setSelectedOption(key)}
                        className={`w-full text-left p-3.5 rounded-xl border transition flex items-start space-x-3 text-sm cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500/20 border-amber-500 text-white shadow-md'
                            : 'bg-slate-950/60 border-slate-800 text-slate-200 hover:bg-slate-800/80 hover:border-slate-700'
                        }`}
                      >
                        <span className={`font-mono font-bold px-2 py-0.5 rounded text-xs ${
                          isSelected ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {key}
                        </span>
                        <span className="flex-1 leading-snug">{text}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => selectedOption && handleSubmit(selectedOption)}
                    disabled={!selectedOption}
                    className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold py-3 rounded-xl shadow-lg transition flex items-center justify-center space-x-2 text-sm disabled:opacity-50 cursor-pointer"
                  >
                    <span>Commit Decision Gate Answer</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          ) : (
            /* Result Feedback & Explanation */
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className={`p-4 rounded-xl border ${
                gate.isCorrect
                  ? 'bg-emerald-950/50 border-emerald-500/80 text-emerald-100'
                  : 'bg-rose-950/50 border-rose-500/80 text-rose-100'
              }`}>
                <div className="flex items-center space-x-2 font-bold font-mono text-sm">
                  {gate.isCorrect ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      <span>CORRECT DECISION (Choice {pyq.correctAnswer})</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-5 h-5 text-rose-400" />
                      <span>INCORRECT DECISION (Your answer: {gate.userAnswer} | Correct: {pyq.correctAnswer})</span>
                    </>
                  )}
                </div>

                <div className="mt-2 text-xs leading-relaxed opacity-90 font-sans">
                  {gate.consequenceMessage}
                </div>
              </div>

              {/* High-Yield Concept Explanation */}
              <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-2">
                <div className="flex items-center space-x-2 text-indigo-400 font-mono text-xs font-bold uppercase tracking-wider">
                  <BookOpen className="w-4 h-4" />
                  <span>High-Yield Concept Tested</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed font-sans">
                  {pyq.explanation || pyq.conceptTested}
                </p>
              </div>

              <button
                onClick={onClose}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl shadow-md transition flex items-center justify-center space-x-2 text-sm cursor-pointer"
              >
                <span>Continue Patient Simulation</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

