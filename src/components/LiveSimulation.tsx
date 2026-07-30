import React, { useState } from 'react';
import {
  Activity,
  Clock,
  MapPin,
  User,
  FileText,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Zap,
  ShieldAlert,
  Sparkles,
  AlertTriangle,
  Stethoscope,
  ChevronDown,
  ArrowRight
} from 'lucide-react';
import { CaseSession, OrderCategory } from '../types';
import { CommandPanel } from './CommandPanel';
import { DecisionGateModal } from './DecisionGateModal';

interface LiveSimulationProps {
  session: CaseSession;
  onSendCommand: (command: string) => void;
  onCommitGateAnswer: (answer: string) => void;
  isProcessing: boolean;
}

export const LiveSimulation: React.FC<LiveSimulationProps> = ({
  session,
  onSendCommand,
  onCommitGateAnswer,
  isProcessing,
}) => {
  const [activeModalGateIndex, setActiveModalGateIndex] = useState<number | null>(null);

  const activeGate =
    activeModalGateIndex !== null &&
    activeModalGateIndex >= 0 &&
    activeModalGateIndex < session.decisionGates.length
      ? session.decisionGates[activeModalGateIndex]
      : null;

  const currentGateToAnswer =
    session.currentGateIndex >= 0 && session.currentGateIndex < session.decisionGates.length
      ? session.decisionGates[session.currentGateIndex]
      : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Decision Gate Modal (Only opens when user explicitly triggers or reviews a gate) */}
      {activeGate && (
        <DecisionGateModal
          gate={activeGate}
          onCommitAnswer={onCommitGateAnswer}
          onClose={() => setActiveModalGateIndex(null)}
          blindMode={session.blindMode}
        />
      )}

      {/* Patient Overview Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <User className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-white font-sans">
                {session.patient.name}, {session.patient.age} y/o {session.patient.gender}
              </h2>
              <span className="bg-slate-800 text-slate-300 border border-slate-700 text-xs font-mono px-2.5 py-0.5 rounded-md">
                Setting: {session.patient.setting}
              </span>
              <span className="bg-cyan-950 text-cyan-300 border border-cyan-500/30 text-xs font-mono px-2.5 py-0.5 rounded-md flex items-center space-x-1">
                <MapPin className="w-3 h-3" />
                <span>Current Location: {session.currentLocation}</span>
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1.5 leading-relaxed font-sans">
              <strong className="text-amber-300 font-mono">Chief Complaint:</strong> {session.patient.chiefComplaint}
            </p>
          </div>
        </div>

        {/* Incidental Findings Silently Tracked Badge */}
        <div className="flex items-center space-x-2 bg-slate-950 border border-slate-800 px-3.5 py-2 rounded-xl text-xs font-mono">
          <ShieldAlert className="w-4 h-4 text-amber-400" />
          <div>
            <span className="text-slate-400">Incidental Actionables: </span>
            <span className="text-amber-300 font-bold">
              {session.incidentalFindings.filter((i) => i.status === 'noticed_addressed').length} / {session.incidentalFindings.length} Addressed
            </span>
          </div>
        </div>
      </div>

      {/* Active Milestone Gate Callout Banner (If active gate pending) */}
      {currentGateToAnswer && !currentGateToAnswer.userAnswer && (
        <div className="bg-gradient-to-r from-amber-950/60 via-slate-900 to-indigo-950/60 border-2 border-amber-500/80 rounded-2xl p-4 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in duration-300">
          <div className="flex items-start space-x-3">
            <div className="bg-amber-500/20 text-amber-400 p-2.5 rounded-xl border border-amber-500/40 mt-0.5 sm:mt-0 animate-pulse">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-amber-400 font-bold font-mono text-xs uppercase tracking-wider">
                  ⚡ CLINICAL DECISION MILESTONE READY
                </span>
                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-mono font-bold px-2 py-0.5 rounded">
                  QID: {currentGateToAnswer.pyq.qid}
                </span>
              </div>
              <p className="text-xs text-slate-200 mt-1 font-sans">
                {currentGateToAnswer.patientContext} — Key concept tested: <span className="text-indigo-300 font-semibold">{currentGateToAnswer.pyq.conceptTested}</span>
              </p>
            </div>
          </div>

          <button
            onClick={() => setActiveModalGateIndex(session.currentGateIndex)}
            className="w-full sm:w-auto bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold px-5 py-2.5 rounded-xl text-xs shadow-lg transition flex items-center justify-center space-x-2 cursor-pointer whitespace-nowrap"
          >
            <span>Respond to Decision Gate</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Grid: Simulation Narrative & Orders Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column (2 Cols): Live Timeline */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2 font-mono">
                <Activity className="w-4 h-4 text-cyan-400" />
                <span>USMLE STEP 3 CLINICAL ENCOUNTER TIMELINE</span>
              </h3>
              <span className="text-xs text-slate-500 font-mono">
                Turns Logged: {session.turns.length}
              </span>
            </div>

            {/* Turns List */}
            <div className="space-y-4 max-h-[520px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-800">
              {session.turns.map((turn, idx) => (
                <div key={idx} className="bg-slate-950 border border-slate-800/90 rounded-xl p-4 space-y-3">
                  
                  {/* Turn Header */}
                  <div className="flex items-center justify-between border-b border-slate-800/60 pb-2 text-xs font-mono">
                    <div className="flex items-center space-x-2 text-amber-400 font-semibold">
                      <Clock className="w-3.5 h-3.5" />
                      <span>
                        Day {turn.simTime.day}, {String(turn.simTime.hour).padStart(2, '0')}:{String(turn.simTime.minute).padStart(2, '0')}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 text-cyan-400 font-semibold">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>{turn.location}</span>
                    </div>
                  </div>

                  {/* User Command (if any) */}
                  {turn.userCommand && (
                    <div className="text-xs font-mono text-indigo-300 bg-indigo-950/40 border border-indigo-500/20 px-3 py-1.5 rounded-lg flex items-center space-x-2">
                      <span className="text-slate-500">&gt; Command:</span>
                      <span className="font-medium text-indigo-200">{turn.userCommand}</span>
                    </div>
                  )}

                  {/* What Happened Narrative */}
                  <div className="text-xs sm:text-sm text-slate-200 leading-relaxed font-sans whitespace-pre-line">
                    <strong className="text-slate-400 font-mono text-xs block mb-1">WHAT HAPPENED:</strong>
                    {turn.whatHappened}
                  </div>

                  {/* Vitals Snapshot */}
                  <div className="bg-slate-900/80 p-2.5 rounded-lg text-xs font-mono text-slate-300 flex flex-wrap gap-3 border border-slate-800/50">
                    <span><strong className="text-slate-500">HR:</strong> {turn.vitals.hr} bpm</span>
                    <span><strong className="text-slate-500">BP:</strong> {turn.vitals.bp} mmHg</span>
                    <span><strong className="text-slate-500">RR:</strong> {turn.vitals.rr} /min</span>
                    <span><strong className="text-slate-500">SpO2:</strong> {turn.vitals.spo2}%</span>
                    <span><strong className="text-slate-500">Temp:</strong> {turn.vitals.temp}</span>
                    <span><strong className="text-slate-500">GRBS:</strong> {turn.vitals.grbs}</span>
                  </div>

                  {/* New Results Delivered */}
                  {turn.newResults && turn.newResults.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <span className="text-xs font-mono text-emerald-400 font-bold block flex items-center space-x-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>NEW RESULTS RELEASED:</span>
                      </span>
                      {turn.newResults.map((res, rIdx) => (
                        <div key={rIdx} className="bg-emerald-950/30 border border-emerald-500/30 p-3 rounded-lg text-xs font-mono space-y-1">
                          <div className="flex justify-between font-bold text-emerald-300">
                            <span>{res.orderName} ({res.category})</span>
                            <span className="text-slate-400">Ready at {res.readySimTime}</span>
                          </div>
                          <p className="text-slate-200 font-sans leading-normal whitespace-pre-line">
                            {res.resultText}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                </div>
              ))}
            </div>
          </div>

          {/* Command Interaction Panel */}
          <CommandPanel
            onSendCommand={onSendCommand}
            isProcessing={isProcessing}
            disabled={session.status === 'completed'}
          />
        </div>

        {/* Right Column (1 Col): Decision Gates & Orders Drawer */}
        <div className="space-y-4">
          
          {/* Decision Gates Drawer */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold font-mono text-amber-400 uppercase tracking-wider flex items-center space-x-1.5">
                <Zap className="w-4 h-4" />
                <span>PYQ Decision Gates ({session.decisionGates.length})</span>
              </h3>
            </div>

            <div className="space-y-2 text-xs">
              {session.decisionGates.map((gate, gIdx) => {
                const isActive = session.currentGateIndex === gIdx;
                const isAnswered = !!gate.userAnswer;
                return (
                  <div
                    key={gIdx}
                    className={`p-3 rounded-xl border flex flex-col space-y-2 font-mono transition ${
                      isAnswered
                        ? gate.isCorrect
                          ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                          : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
                        : isActive
                        ? 'bg-amber-500/10 border-amber-500/80 text-amber-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-200">{gate.pyq.qid}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-bold">
                          {gate.pyq.roleTag}
                        </span>
                      </div>
                      <span className="text-[11px] font-bold">
                        {isAnswered
                          ? gate.isCorrect
                            ? '✅ Correct'
                            : '❌ Wrong'
                          : isActive
                          ? '⚡ Active'
                          : 'Pending'}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-300 font-sans line-clamp-1">
                      {gate.pyq.conceptTested}
                    </p>

                    <button
                      onClick={() => setActiveModalGateIndex(gIdx)}
                      className={`w-full py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1 cursor-pointer ${
                        isAnswered
                          ? 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                          : isActive
                          ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow'
                          : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300'
                      }`}
                    >
                      <span>{isAnswered ? 'Review Explanation' : 'Open Milestone'}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Completed Orders Drawer */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
            <h3 className="text-xs font-bold font-mono text-emerald-400 uppercase tracking-wider flex items-center space-x-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>Completed Investigations ({session.completedOrders.length})</span>
            </h3>

            {session.completedOrders.length === 0 ? (
              <p className="text-xs text-slate-500 font-mono">No completed orders yet. Place orders using the panel.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-800">
                {session.completedOrders.map((ord, idx) => (
                  <div key={idx} className="bg-slate-950 border border-slate-800 p-2.5 rounded-lg text-xs space-y-1">
                    <div className="flex justify-between font-mono font-semibold text-slate-200">
                      <span>{ord.orderName}</span>
                      <span className="text-slate-500">{ord.readySimTime}</span>
                    </div>
                    <p className="text-slate-300 font-sans text-xs leading-normal">{ord.resultText}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending Orders Drawer */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
            <h3 className="text-xs font-bold font-mono text-cyan-400 uppercase tracking-wider flex items-center space-x-1.5">
              <Clock className="w-4 h-4" />
              <span>Pending Orders ({session.pendingOrders.length})</span>
            </h3>

            {session.pendingOrders.length === 0 ? (
              <p className="text-xs text-slate-500 font-mono">No orders currently pending turnaround.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-800">
                {session.pendingOrders.map((ord, idx) => (
                  <div key={idx} className="bg-slate-950 border border-slate-800 p-2.5 rounded-lg text-xs flex justify-between items-center font-mono">
                    <span className="text-slate-300 font-medium">{ord.orderName}</span>
                    <span className="text-cyan-400 text-[10px] bg-cyan-950 border border-cyan-500/30 px-2 py-0.5 rounded">
                      Ready @ {ord.readySimTime}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
};

