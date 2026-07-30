import React from 'react';
import { Award, CheckCircle2, AlertTriangle, Clock, ShieldAlert, BookOpen, Sparkles, RefreshCw, Layers } from 'lucide-react';
import { EndOfCaseScorecard, CaseSession } from '../types';

interface ScorecardViewProps {
  session: CaseSession;
  onRestartCase: () => void;
}

export const ScorecardView: React.FC<ScorecardViewProps> = ({ session, onRestartCase }) => {
  const scorecard = session.scorecard;

  if (!scorecard) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <Award className="w-12 h-12 text-slate-600 mx-auto animate-bounce" />
        <h2 className="text-lg font-bold text-white font-mono">Case Simulation In Progress</h2>
        <p className="text-xs text-slate-400">
          Complete all Decision Gates or click "End & Score" in the header to generate your USMLE Step 3 / INI-CET Scorecard.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
      {/* Top Overall Grade Card */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Award className="w-48 h-48 text-indigo-400" />
        </div>

        <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">
          <div className="space-y-2">
            <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-mono font-bold px-3 py-1 rounded-full uppercase tracking-wider">
              END-OF-CASE SCORECARD
            </span>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white font-sans">
              {session.patient.name} ({session.patient.age}y/o {session.patient.gender})
            </h1>
            <p className="text-xs text-slate-300 font-mono">
              Final Diagnosis: <strong className="text-emerald-400">{scorecard.finalDiagnosis}</strong>
            </p>
            <p className="text-xs text-slate-400 font-mono">
              Clinching Clue: "{scorecard.clinchingClue}" (Revealed @ {scorecard.clinchingTime})
            </p>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-2xl text-center space-y-1 min-w-[180px]">
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider block">Overall Grade</span>
            <span className="text-4xl font-extrabold text-amber-400 font-mono block">
              {scorecard.overallGrade}
            </span>
            <span className="text-xs font-mono text-slate-300 block font-bold">
              Score: {scorecard.overallScore} / 100
            </span>
            <span className="text-[10px] font-mono text-slate-500 block pt-1 border-t border-slate-800">
              Formula: (Gate Accuracy × 80) + (Incidental Actions × 10) - (Unindicated Orders × 5)
            </span>
          </div>
        </div>
      </div>

      {/* Grid Section: PYQ Score & Incidental Findings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* PYQ Performance Breakdown */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-100 font-mono flex items-center space-x-2">
              <Award className="w-4 h-4 text-amber-400" />
              <span>PYQ DECISION GATES SCORE</span>
            </h3>
            <span className="text-xs font-mono font-bold text-amber-400">
              {scorecard.pyqScore.correct} / {scorecard.pyqScore.total} ({scorecard.pyqScore.percentage}%)
            </span>
          </div>

          <div className="space-y-3">
            {scorecard.gateResults.map((res, idx) => (
              <div key={idx} className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 text-xs space-y-1.5">
                <div className="flex justify-between items-center font-mono">
                  <span className="font-bold text-indigo-300">{res.qid} ({res.examYear})</span>
                  <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                    res.isCorrect ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30' : 'bg-rose-950 text-rose-400 border border-rose-500/30'
                  }`}>
                    {res.isCorrect ? 'CORRECT' : 'INCORRECT'}
                  </span>
                </div>
                <p className="text-slate-300 font-sans font-medium">{res.topic} ({res.roleTag})</p>
                <p className="text-slate-400 text-[11px]">Concept: {res.concept}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Incidental Findings Report */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-100 font-mono flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span>INCIDENTAL ACTIONABLE FINDINGS REPORT</span>
            </h3>
          </div>

          <div className="space-y-3">
            {scorecard.incidentalFindingsReport.map((inc, idx) => (
              <div key={idx} className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between font-mono font-bold">
                  <span className="text-amber-300">{inc.title}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded ${
                    inc.status === 'noticed_addressed' ? 'bg-emerald-950 text-emerald-400' : 'bg-amber-950 text-amber-400'
                  }`}>
                    {inc.status === 'noticed_addressed' ? 'Addressed' : 'Missed'}
                  </span>
                </div>
                <p className="text-slate-300 font-sans">{inc.outcome}</p>
                <span className="text-slate-500 font-mono text-[10px] block">{inc.scoreNote}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Over-Ordering Audit & Time Penalty Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <h3 className="text-sm font-bold text-rose-400 font-mono uppercase tracking-wider flex items-center space-x-2">
          <Clock className="w-4 h-4 text-rose-400" />
          <span>Over-Ordering & Time Penalty Audit ({scorecard.overOrderingList.length})</span>
        </h3>

        {scorecard.overOrderingList.length === 0 ? (
          <div className="text-xs text-emerald-400 font-mono bg-emerald-950/30 p-4 rounded-xl border border-emerald-500/30">
            ✅ Efficient clinical management! No unnecessary or high-cost invasive tests ordered. Zero turnaround time penalties incurred.
          </div>
        ) : (
          <div className="space-y-2 text-xs">
            {scorecard.overOrderingList.map((item, idx) => (
              <div key={idx} className="bg-rose-950/30 border border-rose-500/30 p-3 rounded-xl font-mono text-rose-200">
                {item}
              </div>
            ))}
          </div>
        )}

        {scorecard.criticalDelays && scorecard.criticalDelays.length > 0 && (
          <div className="space-y-2 pt-2">
            <h4 className="text-xs font-bold font-mono text-amber-400">Critical Delays Identified:</h4>
            {scorecard.criticalDelays.map((del, dIdx) => (
              <div key={dIdx} className="bg-amber-950/30 border border-amber-500/30 p-3 rounded-xl font-mono text-amber-200 text-xs">
                {del}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Revise This High-Yield Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <h3 className="text-sm font-bold text-amber-400 font-mono uppercase tracking-wider flex items-center space-x-2">
          <BookOpen className="w-4 h-4" />
          <span>Top High-Yield Concepts To Revise From This Case</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {scorecard.topConceptsToRevise.length === 0 ? (
            <div className="col-span-3 text-xs text-emerald-400 font-mono bg-emerald-950/30 p-4 rounded-xl border border-emerald-500/30 text-center">
              🎉 Perfect run! No major concepts missed in this simulation.
            </div>
          ) : (
            scorecard.topConceptsToRevise.map((c, idx) => (
              <div key={idx} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
                <span className="text-indigo-400 font-mono font-bold text-[10px] bg-indigo-950 px-2 py-0.5 rounded">
                  QIDs: {c.sourceQIDs.join(', ')}
                </span>
                <p className="text-slate-200 font-sans font-medium leading-relaxed">{c.concept}</p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Restart Button */}
      <div className="pt-4 text-center">
        <button
          onClick={onRestartCase}
          className="bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold px-8 py-3 rounded-xl shadow-lg transition inline-flex items-center space-x-2 text-sm cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Start Next CCS Case</span>
        </button>
      </div>

    </div>
  );
};
