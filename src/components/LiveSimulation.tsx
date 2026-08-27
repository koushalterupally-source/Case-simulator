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
  ArrowRight,
  ClipboardList,
  FlaskConical,
  ListFilter,
  BarChart2,
  Heart
} from 'lucide-react';
import { CaseSession, OrderCategory } from '../types';
import { CommandPanel } from './CommandPanel';
import { DecisionGateModal } from './DecisionGateModal';
import { CaseProgressBar } from './CaseProgressBar';
import { xpAwardedForGate } from '../utils/gamification';

interface LiveSimulationProps {
  session: CaseSession;
  onSendCommand: (command: string) => void;
  onCommitGateAnswer: (answer: string, gateIndex?: number) => void;
  isProcessing: boolean;
}

export const LiveSimulation: React.FC<LiveSimulationProps> = ({
  session,
  onSendCommand,
  onCommitGateAnswer,
  isProcessing,
}) => {
  const [activeModalGateIndex, setActiveModalGateIndex] = useState<number | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'timeline' | 'patient' | 'orders' | 'gates' | 'all'>('timeline');

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

  // Calculate Progress HUD Metrics
  const answeredGates = session.decisionGates.filter((g) => !!g.userAnswer).length;
  const totalGates = session.decisionGates.length;
  const gatesProgressPercent = totalGates > 0 ? Math.round((answeredGates / totalGates) * 100) : 0;
  const correctGates = session.decisionGates.filter((g) => g.isCorrect).length;

  const totalOrdersCount = session.completedOrders.length + session.pendingOrders.length;
  const incidentalsAddressed = session.incidentalFindings.filter((i) => i.status === 'noticed_addressed').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Decision Gate Modal */}
      {activeGate && (
        <DecisionGateModal
          gate={activeGate}
          onCommitAnswer={(answer) =>
            onCommitGateAnswer(
              answer,
              activeModalGateIndex !== null ? activeModalGateIndex : session.currentGateIndex
            )
          }
          onClose={() => setActiveModalGateIndex(null)}
          blindMode={session.blindMode}
          xpAwarded={
            activeModalGateIndex !== null ? xpAwardedForGate(session, activeModalGateIndex) : 0
          }
        />
      )}

      {/* Case HUD: rank, XP, streak, stability and the clickable gate stepper */}
      <CaseProgressBar session={session} onOpenGate={(idx) => setActiveModalGateIndex(idx)} />

      {/* Case Overall Progress HUD Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <User className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-white font-sans">
                  {session.patient.name}, {session.patient.age}y/o {session.patient.gender}
                </h2>
                <span className="bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-mono px-2 py-0.5 rounded">
                  Setting: {session.patient.setting}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 font-sans">
                Location: <strong className="text-cyan-300 font-mono">{session.currentLocation}</strong> • Day {session.simTime.day}, {String(session.simTime.hour).padStart(2, '0')}:{String(session.simTime.minute).padStart(2, '0')}
              </p>
            </div>
          </div>

          {/* Progress Ring / Percentage Stat */}
          <div className="flex items-center space-x-4 bg-slate-950 border border-slate-800/80 px-4 py-2 rounded-xl">
            <div>
              <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                <span>Case Milestone Progress</span>
                <span className="text-indigo-400 font-bold ml-3">{gatesProgressPercent}%</span>
              </div>
              <div className="w-40 bg-slate-800 h-2 rounded-full overflow-hidden mt-1.5">
                <div
                  className="bg-gradient-to-r from-indigo-500 via-cyan-500 to-emerald-400 h-full transition-all duration-500 rounded-full"
                  style={{ width: `${gatesProgressPercent}%` }}
                />
              </div>
            </div>
            <div className="border-l border-slate-800 pl-3 text-right">
              <div className="text-[11px] font-mono text-slate-400">Decision Gates</div>
              <div className="text-xs font-bold font-mono text-amber-400">
                {answeredGates} / {totalGates} Answered
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono pt-1">
          <div className="bg-slate-950 p-2 rounded-lg border border-slate-800/60 flex items-center justify-between">
            <span className="text-slate-400">Turns Elapsed:</span>
            <span className="font-bold text-slate-200">{session.turns.length}</span>
          </div>
          <div className="bg-slate-950 p-2 rounded-lg border border-slate-800/60 flex items-center justify-between">
            <span className="text-slate-400">Orders Placed:</span>
            <span className="font-bold text-cyan-300">{session.completedOrders.length} Done ({session.pendingOrders.length} Pend)</span>
          </div>
          <div className="bg-slate-950 p-2 rounded-lg border border-slate-800/60 flex items-center justify-between">
            <span className="text-slate-400">Correct Milestones:</span>
            <span className="font-bold text-emerald-400">{correctGates} / {answeredGates}</span>
          </div>
          <div className="bg-slate-950 p-2 rounded-lg border border-slate-800/60 flex items-center justify-between">
            <span className="text-slate-400">Incidental Findings:</span>
            <span className="font-bold text-amber-300">{incidentalsAddressed} / {session.incidentalFindings.length}</span>
          </div>
        </div>
      </div>

      {/* Active Milestone Gate Callout Banner */}
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
                {currentGateToAnswer.patientContext}
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

      {/* View Sub-Tabs for clean, easy-on-the-eye reading */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-1.5 flex flex-wrap gap-1 text-xs font-medium">
        <button
          onClick={() => setActiveSubTab('timeline')}
          className={`flex-1 min-w-[130px] py-2 px-3 rounded-lg flex items-center justify-center space-x-2 transition ${
            activeSubTab === 'timeline'
              ? 'bg-indigo-600 text-white font-bold shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Timeline & Actions</span>
          <span className="bg-indigo-950 text-indigo-200 text-[10px] px-1.5 py-0.2 rounded font-mono">
            {session.turns.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('patient')}
          className={`flex-1 min-w-[130px] py-2 px-3 rounded-lg flex items-center justify-center space-x-2 transition ${
            activeSubTab === 'patient'
              ? 'bg-indigo-600 text-white font-bold shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Stethoscope className="w-3.5 h-3.5" />
          <span>Patient Chart</span>
        </button>

        <button
          onClick={() => setActiveSubTab('orders')}
          className={`flex-1 min-w-[130px] py-2 px-3 rounded-lg flex items-center justify-center space-x-2 transition ${
            activeSubTab === 'orders'
              ? 'bg-indigo-600 text-white font-bold shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <FlaskConical className="w-3.5 h-3.5" />
          <span>Results & Orders</span>
          <span className="bg-indigo-950 text-indigo-200 text-[10px] px-1.5 py-0.2 rounded font-mono">
            {session.completedOrders.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('gates')}
          className={`flex-1 min-w-[130px] py-2 px-3 rounded-lg flex items-center justify-center space-x-2 transition ${
            activeSubTab === 'gates'
              ? 'bg-indigo-600 text-white font-bold shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>PYQ Milestones</span>
          <span className="bg-amber-500/20 text-amber-300 text-[10px] px-1.5 py-0.2 rounded font-mono font-bold">
            {answeredGates}/{totalGates}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('all')}
          className={`py-2 px-3 rounded-lg flex items-center justify-center space-x-1.5 transition ${
            activeSubTab === 'all'
              ? 'bg-slate-800 text-slate-100 font-bold border border-slate-700'
              : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/40'
          }`}
        >
          <ListFilter className="w-3.5 h-3.5" />
          <span>All Panels</span>
        </button>
      </div>

      {/* SUB-TAB CONTENT RENDERING */}

      {/* 1. TIMELINE & ACTIONS TAB */}
      {(activeSubTab === 'timeline' || activeSubTab === 'all') && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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

                    {/* User Command */}
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
                      <span><strong className="text-slate-500">GRBS:</strong> {turn.vitals.grbs} mg/dL</span>
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

          {/* Right Column in Timeline Tab */}
          <div className="space-y-4">
            {/* Quick Gates summary */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
              <h3 className="text-xs font-bold font-mono text-amber-400 uppercase tracking-wider flex items-center justify-between">
                <span>Next Decision Milestone</span>
                <span className="text-slate-400 font-normal">{answeredGates}/{totalGates}</span>
              </h3>
              {currentGateToAnswer ? (
                <div className="bg-slate-950 p-3 rounded-xl border border-amber-500/40 space-y-2 text-xs">
                  <div className="flex justify-between items-center font-mono">
                    <span className="font-bold text-amber-300">QID: {currentGateToAnswer.pyq.qid}</span>
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded font-bold uppercase">
                      {currentGateToAnswer.pyq.roleTag}
                    </span>
                  </div>
                  <p className="text-slate-200 font-sans line-clamp-2">
                    {currentGateToAnswer.patientContext}
                  </p>
                  <button
                    onClick={() => setActiveModalGateIndex(session.currentGateIndex)}
                    className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-1.5 rounded-lg transition text-xs shadow"
                  >
                    Answer Decision Gate
                  </button>
                </div>
              ) : (
                <p className="text-xs text-slate-400 font-mono">All decision gates completed for this case!</p>
              )}
            </div>

            {/* Recent Completed Orders Summary */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
              <h3 className="text-xs font-bold font-mono text-emerald-400 uppercase tracking-wider flex items-center justify-between">
                <span>Recent Test Results</span>
                <span className="text-slate-400 font-normal">{session.completedOrders.length}</span>
              </h3>
              {session.completedOrders.length === 0 ? (
                <p className="text-xs text-slate-500 font-mono">No results released yet.</p>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {session.completedOrders.slice(-4).map((ord, idx) => (
                    <div key={idx} className="bg-slate-950 border border-slate-800 p-2.5 rounded-lg text-xs space-y-1">
                      <div className="flex justify-between font-mono font-semibold text-slate-200">
                        <span>{ord.orderName}</span>
                        <span className="text-slate-500 text-[10px]">{ord.readySimTime}</span>
                      </div>
                      <p className="text-slate-300 font-sans text-xs line-clamp-2">{ord.resultText}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. PATIENT CHART TAB */}
      {(activeSubTab === 'patient' || activeSubTab === 'all') && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-6">
          <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
            <Stethoscope className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base font-bold text-white font-mono">CLINICAL PATIENT CHART & EXAMINATION</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Opening Vignette & Demographics */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-bold font-mono text-indigo-300 uppercase tracking-wider">
                1. Initial Presentation & Chief Complaint
              </h4>
              <p className="text-sm text-slate-200 font-sans leading-relaxed">
                {session.patient.chiefComplaint}
              </p>
              <div className="pt-2 text-xs font-mono text-slate-400 space-y-1 border-t border-slate-900">
                <div><strong className="text-slate-300">Name:</strong> {session.patient.name}</div>
                <div><strong className="text-slate-300">Age / Gender:</strong> {session.patient.age} years old, {session.patient.gender}</div>
                <div><strong className="text-slate-300">Setting:</strong> {session.patient.setting}</div>
              </div>
            </div>

            {/* Current Vitals */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-bold font-mono text-emerald-400 uppercase tracking-wider flex items-center space-x-2">
                <Heart className="w-4 h-4 text-emerald-400" />
                <span>2. Baseline Vital Signs</span>
              </h4>
              <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Heart Rate</span>
                  <span className="text-sm font-bold text-slate-100">{session.patient.currentVitals.hr} bpm</span>
                </div>
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Blood Pressure</span>
                  <span className="text-sm font-bold text-slate-100">{session.patient.currentVitals.bp} mmHg</span>
                </div>
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Respiratory Rate</span>
                  <span className="text-sm font-bold text-slate-100">{session.patient.currentVitals.rr} /min</span>
                </div>
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">SpO2</span>
                  <span className="text-sm font-bold text-slate-100">{session.patient.currentVitals.spo2}%</span>
                </div>
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Temperature</span>
                  <span className="text-sm font-bold text-slate-100">{session.patient.currentVitals.temp}</span>
                </div>
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">GRBS</span>
                  <span className="text-sm font-bold text-slate-100">{session.patient.currentVitals.grbs}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Physical Examination Sections */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-4">
            <h4 className="text-xs font-bold font-mono text-cyan-400 uppercase tracking-wider">
              3. Physical Examination Findings
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
              <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-1">
                <span className="font-bold text-amber-300 font-mono block">General Examination</span>
                <p className="text-slate-300 font-sans leading-relaxed">{session.patient.physicalExam?.general || 'Alert, oriented, stable.'}</p>
              </div>
              <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-1">
                <span className="font-bold text-amber-300 font-mono block">Cardiovascular System (CVS)</span>
                <p className="text-slate-300 font-sans leading-relaxed">{session.patient.physicalExam?.cvs || 'S1 S2 heard, normal.'}</p>
              </div>
              <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-1">
                <span className="font-bold text-amber-300 font-mono block">Respiratory System</span>
                <p className="text-slate-300 font-sans leading-relaxed">{session.patient.physicalExam?.resp || 'Clear breath sounds bilaterally.'}</p>
              </div>
              <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-1">
                <span className="font-bold text-amber-300 font-mono block">Abdominal Examination</span>
                <p className="text-slate-300 font-sans leading-relaxed">{session.patient.physicalExam?.abdomen || 'Soft, non-tender.'}</p>
              </div>
              <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-1">
                <span className="font-bold text-amber-300 font-mono block">Central Nervous System (CNS)</span>
                <p className="text-slate-300 font-sans leading-relaxed">{session.patient.physicalExam?.cns || 'Alert and oriented.'}</p>
              </div>
              <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-1">
                <span className="font-bold text-amber-300 font-mono block">Relevant Medical History</span>
                <p className="text-slate-300 font-sans leading-relaxed">{session.patient.history || 'No significant past medical history.'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. RESULTS & ORDERS TAB */}
      {(activeSubTab === 'orders' || activeSubTab === 'all') && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Completed Investigations */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold font-mono text-emerald-400 uppercase tracking-wider flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Completed Investigation Results ({session.completedOrders.length})</span>
              </h3>
            </div>

            {session.completedOrders.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 font-mono bg-slate-950 rounded-xl border border-slate-800">
                No investigation results released yet. Place diagnostic orders in the timeline.
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {session.completedOrders.map((ord, idx) => (
                  <div key={idx} className="bg-slate-950 border border-slate-800/90 p-3.5 rounded-xl text-xs space-y-2">
                    <div className="flex justify-between items-center font-mono border-b border-slate-900 pb-1">
                      <span className="font-bold text-emerald-300 text-sm">{ord.orderName}</span>
                      <span className="text-slate-400 text-[11px] bg-slate-900 px-2 py-0.5 rounded">
                        Released @ {ord.readySimTime}
                      </span>
                    </div>
                    <div className="text-slate-200 font-sans text-xs leading-relaxed whitespace-pre-line bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/40">
                      {ord.resultText}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending Orders Queue */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold font-mono text-cyan-400 uppercase tracking-wider flex items-center space-x-2">
                <Clock className="w-4 h-4 text-cyan-400" />
                <span>Pending Orders Queue ({session.pendingOrders.length})</span>
              </h3>
            </div>

            {session.pendingOrders.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 font-mono bg-slate-950 rounded-xl border border-slate-800">
                No orders currently in the laboratory / imaging processing pipeline.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                {session.pendingOrders.map((ord, idx) => (
                  <div key={idx} className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl text-xs flex justify-between items-center font-mono">
                    <div>
                      <span className="text-slate-200 font-bold block">{ord.orderName}</span>
                      <span className="text-slate-500 text-[10px]">
                        {ord.orderedTurnIndex !== undefined ? `Ordered turn ${ord.orderedTurnIndex + 1}` : `Placed @ ${ord.placedSimTime}`}
                      </span>
                    </div>
                    <span className="text-cyan-300 text-xs font-bold bg-cyan-950 border border-cyan-500/30 px-2.5 py-1 rounded-lg">
                      Ready @ {ord.readySimTime}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. PYQ MILESTONES TAB */}
      {(activeSubTab === 'gates' || activeSubTab === 'all') && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold font-mono text-amber-400 uppercase tracking-wider flex items-center space-x-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>PYQ Clinical Decision Milestones ({session.decisionGates.length})</span>
            </h3>
            <span className="text-xs font-mono text-slate-400">
              Graded: <strong className="text-emerald-400">{correctGates} Correct</strong> / {answeredGates} Answered
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {session.decisionGates.map((gate, gIdx) => {
              const isActive = session.currentGateIndex === gIdx;
              const isAnswered = !!gate.userAnswer;
              return (
                <div
                  key={gIdx}
                  className={`p-4 rounded-xl border flex flex-col justify-between space-y-3 font-mono transition ${
                    isAnswered
                      ? gate.isCorrect
                        ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                        : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
                      : isActive
                      ? 'bg-amber-500/10 border-amber-500/80 text-amber-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-200 text-sm">Gate {gIdx + 1}: QID {gate.pyq.qid}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold uppercase">
                          {gate.pyq.roleTag}
                        </span>
                      </div>
                      <span className="text-xs font-bold">
                        {isAnswered
                          ? gate.isCorrect
                            ? '✅ Correct'
                            : '❌ Wrong'
                          : isActive
                          ? '⚡ Active Milestone'
                          : '🔒 Pending'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 font-sans leading-relaxed">
                      {isAnswered ? gate.pyq.conceptTested : gate.patientContext}
                    </p>
                  </div>

                  <button
                    onClick={() => (isAnswered || isActive) && setActiveModalGateIndex(gIdx)}
                    disabled={!isAnswered && !isActive}
                    className={`w-full py-2 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
                      isAnswered
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer'
                        : isActive
                        ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow cursor-pointer'
                        : 'bg-slate-800/40 text-slate-600 border border-slate-800/60 cursor-not-allowed'
                    }`}
                  >
                    <span>
                      {isAnswered ? 'Review PYQ Explanation' : isActive ? 'Respond to Milestone' : 'Locked Milestone'}
                    </span>
                    {isActive && <ChevronRight className="w-4 h-4" />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
};


