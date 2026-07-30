import React from 'react';
import { Flame, Trophy, Check, X, Lock, Zap, Eye, HeartPulse } from 'lucide-react';
import { CaseSession } from '../types';
import { computeGameStats, instabilityScore, stabilityLabel } from '../utils/gamification';

interface CaseProgressBarProps {
  session: CaseSession;
  onOpenGate: (index: number) => void;
}

/**
 * The case HUD: rank + XP, streak, patient stability, and a clickable stepper
 * across the decision gates.
 *
 * Deliberately shows only the gate's role tag and status — never its concept,
 * explanation or answer — so nothing here can give away an uncommitted gate.
 */
export const CaseProgressBar: React.FC<CaseProgressBarProps> = ({ session, onOpenGate }) => {
  const stats = computeGameStats(session);
  const instability = instabilityScore(session);
  const stability = stabilityLabel(instability);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-4">
      {/* Top row: rank / xp / streak / stability */}
      <div className="flex flex-wrap items-center gap-3 sm:gap-4">
        {/* Rank + XP */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="bg-gradient-to-tr from-amber-500/25 to-indigo-500/25 border border-amber-500/40 rounded-xl p-2 shrink-0">
            <Trophy className="w-4 h-4 text-amber-300" />
          </div>
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className={`text-sm font-bold font-mono ${stats.rank.tone}`}>
                {stats.rank.label}
              </span>
              <span className="text-[11px] font-mono text-slate-400">{stats.xp} XP</span>
            </div>
            {/* Progress to next rank */}
            <div className="w-32 sm:w-44 h-1.5 bg-slate-800 rounded-full mt-1 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-amber-400 rounded-full transition-all duration-700 ease-out"
                style={{ width: `${stats.progressToNext}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-500 font-mono">
              {stats.nextRank ? `${stats.nextRank.minXp - stats.xp} XP to ${stats.nextRank.label}` : 'Top rank reached'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 ml-auto flex-wrap">
          {/* Streak */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border font-mono text-xs ${
              stats.streak >= 2
                ? 'bg-orange-500/15 border-orange-500/50 text-orange-300'
                : 'bg-slate-950 border-slate-800 text-slate-400'
            }`}
            title="Consecutive correct decisions"
          >
            <Flame className={`w-3.5 h-3.5 ${stats.streak >= 2 ? 'text-orange-400 animate-pulse' : 'text-slate-600'}`} />
            <span className="font-bold">{stats.streak}</span>
            <span className="hidden sm:inline text-[10px] uppercase tracking-wider opacity-80">streak</span>
          </div>

          {/* Accuracy */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-800 bg-slate-950 font-mono text-xs text-slate-300">
            <Zap className="w-3.5 h-3.5 text-indigo-400" />
            <span className="font-bold">{stats.accuracy}%</span>
            <span className="hidden sm:inline text-[10px] uppercase tracking-wider text-slate-500">acc</span>
          </div>

          {/* Incidentals caught */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-800 bg-slate-950 font-mono text-xs text-slate-300">
            <Eye className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-bold">
              {stats.incidentalsCaught}/{stats.incidentalsTotal}
            </span>
          </div>

          {/* Patient stability meter */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border font-mono text-xs ${
              instability >= 6
                ? 'bg-rose-500/15 border-rose-500/50'
                : instability >= 3
                ? 'bg-amber-500/15 border-amber-500/50'
                : 'bg-emerald-500/10 border-emerald-500/40'
            }`}
            title="Derived from how many vital signs are currently deranged"
          >
            <HeartPulse className={`w-3.5 h-3.5 ${stability.tone} ${instability >= 3 ? 'animate-pulse' : ''}`} />
            <span className={`font-bold ${stability.tone}`}>{stability.label}</span>
          </div>
        </div>
      </div>

      {/* Gate stepper */}
      {stats.gatesTotal > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
              Case Progress
            </span>
            <span className="text-[10px] font-mono text-slate-500">
              {stats.gatesAnswered} / {stats.gatesTotal} gates
            </span>
          </div>

          <div className="flex items-stretch gap-1.5 overflow-x-auto pb-1">
            {session.decisionGates.map((gate, idx) => {
              const answered = gate.userAnswer !== undefined;
              const isActive = session.currentGateIndex === idx;
              const openable = answered || isActive;

              const tone = answered
                ? gate.isCorrect
                  ? 'bg-emerald-500/15 border-emerald-500/60 text-emerald-300 hover:bg-emerald-500/25'
                  : 'bg-rose-500/15 border-rose-500/60 text-rose-300 hover:bg-rose-500/25'
                : isActive
                ? 'bg-amber-500/20 border-amber-500 text-amber-200 hover:bg-amber-500/30 animate-pulse'
                : 'bg-slate-950 border-slate-800 text-slate-600';

              return (
                <button
                  key={gate.id || idx}
                  onClick={() => openable && onOpenGate(idx)}
                  disabled={!openable}
                  title={openable ? `Gate ${idx + 1} — ${gate.pyq.roleTag}` : 'Locked until you reach this point'}
                  className={`flex-1 min-w-[84px] border rounded-xl px-2 py-2 flex flex-col items-center gap-1 transition-all duration-200 font-mono ${tone} ${
                    openable ? 'cursor-pointer hover:scale-[1.03] active:scale-[0.98]' : 'cursor-not-allowed opacity-70'
                  }`}
                >
                  <span className="flex items-center gap-1 text-[11px] font-bold">
                    {answered ? (
                      gate.isCorrect ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />
                    ) : isActive ? (
                      <Zap className="w-3.5 h-3.5" />
                    ) : (
                      <Lock className="w-3 h-3" />
                    )}
                    <span>{idx + 1}</span>
                  </span>
                  <span className="text-[9px] uppercase tracking-wide leading-none truncate w-full text-center">
                    {gate.pyq.roleTag}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Earned badges */}
      {stats.badges.some((b) => b.earned) && (
        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-800/70">
          {stats.badges
            .filter((b) => b.earned)
            .map((b) => (
              <span
                key={b.id}
                title={b.description}
                className="inline-flex items-center gap-1 bg-indigo-500/15 border border-indigo-500/40 text-indigo-200 text-[10px] font-mono font-bold px-2 py-1 rounded-lg mt-2 cursor-help"
              >
                <Trophy className="w-3 h-3 text-amber-300" />
                {b.label}
              </span>
            ))}
        </div>
      )}
    </div>
  );
};
