import React from 'react';
import { CaseSession } from '../../types';
import { Transcript } from './Transcript';
import { Composer } from './Composer';
import { GateCard } from './GateCard';
import { computeGameStats, xpAwardedForGate } from '../../utils/gamification';

interface CaseViewProps {
  session: CaseSession;
  onSendCommand: (command: string) => void;
  onCommitGateAnswer: (answer: string, gateIndex?: number) => void;
  isProcessing: boolean;
  onEndCase: () => void;
}

export const CaseView: React.FC<CaseViewProps> = ({
  session,
  onSendCommand,
  onCommitGateAnswer,
  isProcessing,
  onEndCase,
}) => {
  const stats = computeGameStats(session);
  const gateIdx = session.currentGateIndex;
  const activeGate =
    gateIdx >= 0 && gateIdx < session.decisionGates.length ? session.decisionGates[gateIdx] : null;

  // Keep a just-answered gate on screen so the explanation can be read, then
  // let it fall away once the case moves on.
  const [lingering, setLingering] = React.useState<number | null>(null);
  React.useEffect(() => {
    if (activeGate && activeGate.userAnswer !== undefined) setLingering(gateIdx);
  }, [activeGate?.userAnswer, gateIdx]);

  const shownIdx = activeGate ? gateIdx : lingering;
  const shownGate =
    shownIdx !== null && shownIdx >= 0 && shownIdx < session.decisionGates.length
      ? session.decisionGates[shownIdx]
      : null;

  const done = session.status === 'completed';

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* Thin bar: progress and one action. Nothing else. */}
      <header
        className="sticky top-0 z-10 px-4"
        style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}
      >
        <div className="max-w-[46rem] mx-auto h-13 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-[13px] tnum shrink-0" style={{ color: 'var(--text-muted)' }}>
              {stats.gatesAnswered}/{stats.gatesTotal} decisions
            </span>
            <div
              className="h-1 rounded-full flex-1 max-w-[7rem] overflow-hidden"
              style={{ background: 'var(--surface-sunken)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${stats.gatesTotal ? (stats.gatesAnswered / stats.gatesTotal) * 100 : 0}%`,
                  background: 'var(--accent)',
                }}
              />
            </div>
            {stats.streak >= 2 && (
              <span className="text-[13px] tnum shrink-0" style={{ color: 'var(--accent)' }}>
                {stats.streak} in a row
              </span>
            )}
          </div>

          <button
            onClick={onEndCase}
            className="text-[13px] shrink-0 ring-focus rounded px-1"
            style={{ color: 'var(--text-muted)' }}
          >
            {done ? 'View scorecard' : 'End case'}
          </button>
        </div>
      </header>

      <main className="flex-1 px-4">
        <div className="max-w-[46rem] mx-auto pt-8">
          <Transcript session={session}>
            {shownGate && (
              <GateCard
                gate={shownGate}
                index={shownIdx!}
                total={session.decisionGates.length}
                blindMode={session.blindMode}
                xpAwarded={shownIdx !== null ? xpAwardedForGate(session, shownIdx) : 0}
                onCommit={(answer) => onCommitGateAnswer(answer, shownIdx!)}
              />
            )}

            {isProcessing && (
              <div className="text-[14px]" style={{ color: 'var(--text-faint)' }}>
                …
              </div>
            )}
          </Transcript>

          {/* Composer is hidden while a gate is awaiting an answer: the case is
              frozen at that decision, so an order box would be a dead end. */}
          {!activeGate || activeGate.userAnswer !== undefined ? (
            <Composer onSend={onSendCommand} disabled={done} busy={isProcessing} />
          ) : (
            <div className="h-8" />
          )}
        </div>
      </main>
    </div>
  );
};
