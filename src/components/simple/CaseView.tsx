import React from 'react';
import { CaseSession } from '../../types';
import { Transcript } from './Transcript';
import { Composer } from './Composer';
import { OrderSheet } from './OrderSheet';
import { GateCard } from './GateCard';
import { DecisionsPanel } from './DecisionsPanel';
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
  const done = session.status === 'completed';
  const [ordersOpen, setOrdersOpen] = React.useState(false);
  const [decisionsOpen, setDecisionsOpen] = React.useState(false);

  // A question-led set is nothing but its questions, so those stay in the page.
  // A patient case keeps them in the sidebar, where they wait to be opened
  // instead of taking the screen the moment a milestone is reached.
  const inlineQuestions = !!session.isQuestionLed;

  const gateIdx = session.currentGateIndex;
  const activeGate =
    gateIdx >= 0 && gateIdx < session.decisionGates.length ? session.decisionGates[gateIdx] : null;

  // Keep a just-answered gate on screen so the explanation can be read, then
  // let it fall away once the case moves on. Question-led sets only.
  const [lingering, setLingering] = React.useState<number | null>(null);
  React.useEffect(() => {
    if (activeGate && activeGate.userAnswer !== undefined) setLingering(gateIdx);
  }, [activeGate?.userAnswer, gateIdx]);

  const shownIdx = activeGate ? gateIdx : lingering;
  const shownGate =
    shownIdx !== null && shownIdx >= 0 && shownIdx < session.decisionGates.length
      ? session.decisionGates[shownIdx]
      : null;

  const unanswered = session.decisionGates.filter((g) => g.userAnswer === undefined).length;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      <OrderSheet
        open={ordersOpen}
        onClose={() => setOrdersOpen(false)}
        onSubmit={onSendCommand}
      />
      {!inlineQuestions && (
        <DecisionsPanel
          open={decisionsOpen}
          onClose={() => setDecisionsOpen(false)}
          session={session}
          onCommit={onCommitGateAnswer}
          busy={isProcessing}
        />
      )}
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

          <div className="flex items-center gap-3 shrink-0">
            {!inlineQuestions && session.decisionGates.length > 0 && (
              <button
                onClick={() => setDecisionsOpen(true)}
                className="text-[13px] rounded-full px-3 py-1 flex items-center gap-1.5 ring-focus"
                style={{
                  background: unanswered > 0 ? 'var(--accent-soft)' : 'var(--surface-sunken)',
                  color: unanswered > 0 ? 'var(--accent)' : 'var(--text-muted)',
                  border: `1px solid ${unanswered > 0 ? 'var(--accent)' : 'var(--border)'}`,
                }}
              >
                Decisions
                <span className="tnum">
                  {unanswered > 0 ? unanswered : `${stats.gatesAnswered}/${stats.gatesTotal}`}
                </span>
              </button>
            )}

            <button
              onClick={onEndCase}
              className="text-[13px] ring-focus rounded px-1"
              style={{ color: 'var(--text-muted)' }}
            >
              {done ? 'View scorecard' : 'End case'}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4">
        <div className="max-w-[46rem] mx-auto pt-8">
          {/* Be honest when the loaded bank cannot supply questions for this
              patient. Silently running a "PYQ-driven" case with no PYQs, or
              with one, is the kind of thing that makes the app feel broken. */}
          {!session.isQuestionLed && stats.gatesTotal < (session.mode === 'rapid' ? 3 : 5) && (
            <div
              className="mb-7 rounded-xl px-4 py-3 text-[13px] leading-relaxed"
              style={{ background: 'var(--warn-soft)', color: 'var(--text)', border: '1px solid var(--border)' }}
            >
              {stats.gatesTotal === 0 ? (
                <>
                  Your question bank has nothing on this presentation, so this case has{' '}
                  <strong>no decision gates</strong> — it will play as a simulation only. Load the
                  full question index to get real questions here.
                </>
              ) : (
                <>
                  Only {stats.gatesTotal} question{stats.gatesTotal === 1 ? '' : 's'} in your bank
                  matched this presentation, so this case has {stats.gatesTotal} decision
                  {stats.gatesTotal === 1 ? '' : 's'} instead of {session.mode === 'rapid' ? 3 : 5}.
                  Load the full index for more.
                </>
              )}
            </div>
          )}

          <Transcript session={session}>
            {inlineQuestions && shownGate && (
              <GateCard
                gate={shownGate}
                index={shownIdx!}
                total={session.decisionGates.length}
                blindMode={session.blindMode}
                xpAwarded={shownIdx !== null ? xpAwardedForGate(session, shownIdx) : 0}
                onCommit={(answer) => onCommitGateAnswer(answer, shownIdx!)}
              />
            )}

            {/* A decision becoming relevant is a note in the case, not an
                interruption: it says one is waiting and where to find it, and
                the case carries on either way. */}
            {!inlineQuestions && unanswered > 0 && !done && (
              <button
                onClick={() => setDecisionsOpen(true)}
                className="w-full text-left rounded-2xl px-4 py-3 text-[14px] ring-focus fade-rise"
                style={{
                  background: 'var(--accent-soft)',
                  border: '1px solid var(--accent)',
                  color: 'var(--accent)',
                }}
              >
                {unanswered} decision{unanswered === 1 ? '' : 's'} waiting on you — open the
                decisions panel to answer{unanswered === 1 ? ' it' : ' them'}.
              </button>
            )}

            {isProcessing && (
              <div className="text-[14px]" style={{ color: 'var(--text-faint)' }}>
                …
              </div>
            )}
          </Transcript>

          {/* Every decision answered — close the case properly instead of
              leaving the player at a composer with nothing left to decide. */}
          {!done && stats.gatesTotal > 0 && stats.gatesAnswered === stats.gatesTotal && (
            <div
              className="mt-8 rounded-2xl px-5 py-5 fade-rise"
              style={{ background: 'var(--surface)', border: '1px solid var(--border-strong)' }}
            >
              <h2 className="text-[16px] font-semibold">
                {session.isQuestionLed ? 'Set complete' : 'Case complete'}
              </h2>
              <p className="mt-1.5 text-[14px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                You answered all {stats.gatesTotal} decision{stats.gatesTotal === 1 ? '' : 's'} —{' '}
                {stats.gatesCorrect} correct.
                {!session.isQuestionLed &&
                  ' You can keep managing the patient, or close the case and see how you did.'}
              </p>
              <button
                onClick={onEndCase}
                className="mt-4 w-full rounded-xl py-2.5 text-[15px] font-medium ring-focus"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                Finish and see the scorecard
              </button>
            </div>
          )}

          {/* The composer used to disappear whenever a question was waiting,
              which froze the case at that decision. Questions live in the
              sidebar now, so the patient can always be managed. */}
          {inlineQuestions ? null : (
            <Composer
              onSend={onSendCommand}
              onOpenOrders={() => setOrdersOpen(true)}
              disabled={done}
              busy={isProcessing}
            />
          )}
        </div>
      </main>
    </div>
  );
};
