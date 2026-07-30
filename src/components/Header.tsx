import React from 'react';
import { Activity, Clock, MapPin, Play, Pause, RefreshCw, FileText, Award, Layers, ShieldAlert, Sparkles, BookOpen } from 'lucide-react';
import { CaseSession, CaseMode } from '../types';

interface HeaderProps {
  session: CaseSession | null;
  activeTab: 'sim' | 'qbank' | 'scorecard' | 'instructions';
  setActiveTab: (tab: 'sim' | 'qbank' | 'scorecard' | 'instructions') => void;
  onStartNewCase: (mode: CaseMode, subject: string) => void;
  onPauseResume: () => void;
  onEndCase: () => void;
  isStarting: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  session,
  activeTab,
  setActiveTab,
  onStartNewCase,
  onPauseResume,
  onEndCase,
  isStarting,
}) => {
  const formatTime = (st?: { day: number; hour: number; minute: number }) => {
    if (!st) return 'Day 1, 09:15';
    const h = String(st.hour).padStart(2, '0');
    const m = String(st.minute).padStart(2, '0');
    return `Day ${st.day}, ${h}:${m}`;
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-slate-100 sticky top-0 z-30 shadow-md">
      {/* Top Brand Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="bg-gradient-to-tr from-cyan-600 to-indigo-600 p-2.5 rounded-xl shadow-lg shadow-indigo-500/20 text-white flex items-center justify-center">
            <Activity className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-bold tracking-tight text-white font-mono">Medtrix PYQ CCS Engine</h1>
              <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider">
                NEET-PG / INI-CET
              </span>
              <span className="bg-emerald-950 text-emerald-400 border border-emerald-500/30 text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider font-mono flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>OFFLINE PWA READY</span>
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Interactive USMLE-Step-3-Style Clinical Case Simulator Driven by Real PYQs
            </p>
          </div>
        </div>

        {/* Live Simulation Clock & Location Status */}
        {session && (
          <div className="flex items-center space-x-3 bg-slate-800/90 border border-slate-700/80 px-3.5 py-1.5 rounded-lg text-xs font-mono">
            <div className="flex items-center space-x-1.5 text-amber-400 font-medium">
              <Clock className="w-3.5 h-3.5" />
              <span>SIM TIME: {formatTime(session.simTime)}</span>
            </div>
            <span className="text-slate-600">|</span>
            <div className="flex items-center space-x-1.5 text-cyan-400 font-medium">
              <MapPin className="w-3.5 h-3.5" />
              <span>LOCATION: {session.currentLocation}</span>
            </div>
          </div>
        )}

        {/* Actions & New Case Selector */}
        <div className="flex items-center space-x-2">
          {session ? (
            <>
              <button
                onClick={onPauseResume}
                className="inline-flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-medium transition"
              >
                {session.status === 'paused' ? (
                  <>
                    <Play className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Resume</span>
                  </>
                ) : (
                  <>
                    <Pause className="w-3.5 h-3.5 text-amber-400" />
                    <span>Pause</span>
                  </>
                )}
              </button>

              <button
                onClick={onEndCase}
                disabled={session.status === 'completed'}
                className="inline-flex items-center space-x-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 px-3 py-1.5 rounded-lg text-xs font-medium transition disabled:opacity-50"
              >
                <Award className="w-3.5 h-3.5 text-rose-400" />
                <span>End & Score</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => onStartNewCase('standard', 'Medicine')}
              disabled={isStarting}
              className="inline-flex items-center space-x-2 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-medium px-4 py-1.5 rounded-lg text-xs shadow-md transition disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isStarting ? 'Building Case...' : 'Start Random Case'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-slate-800/80">
        <nav className="flex space-x-1 overflow-x-auto py-1 scrollbar-none">
          <button
            onClick={() => setActiveTab('sim')}
            className={`inline-flex items-center space-x-2 px-3 py-2 text-xs font-medium rounded-md transition whitespace-nowrap ${
              activeTab === 'sim'
                ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>🏥 Live Simulation</span>
            {session?.status === 'active' && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping ml-1" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('qbank')}
            className={`inline-flex items-center space-x-2 px-3 py-2 text-xs font-medium rounded-md transition whitespace-nowrap ${
              activeTab === 'qbank'
                ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>📚 PYQ Index & Builder</span>
            {session?.status === 'active' && (
              <span className="bg-slate-800 text-slate-400 text-[10px] px-1.5 py-0.2 rounded border border-slate-700">
                🔒 Keys Redacted
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('scorecard')}
            className={`inline-flex items-center space-x-2 px-3 py-2 text-xs font-medium rounded-md transition whitespace-nowrap ${
              activeTab === 'scorecard'
                ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>📊 End-of-Case Scorecard</span>
            {session?.scorecard && (
              <span className="bg-emerald-500/20 text-emerald-300 text-[10px] px-1.5 py-0.2 rounded font-mono">
                {session.scorecard.overallGrade} ({session.scorecard.overallScore}%)
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('instructions')}
            className={`inline-flex items-center space-x-2 px-3 py-2 text-xs font-medium rounded-md transition whitespace-nowrap ${
              activeTab === 'instructions'
                ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>📜 Master Prompt & Guide</span>
          </button>
        </nav>
      </div>
    </header>
  );
};
