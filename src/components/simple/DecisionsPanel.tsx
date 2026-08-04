import React from 'react';
import { CaseSession, DecisionGate } from '../../types';
import { xpAwardedForGate } from '../../utils/gamification';

interface DecisionsPanelProps {
  open: boolean;
  onClose: () => void;
  session: CaseSession;
  onCommit: (answer: string, gateIndex: number) => void;
  busy?: boolean;
}

type Status = 'pending' | 'correct' | 'incorrect' | 'review';

export function gateStatus(gate: DecisionGate): Status {
  if (gate.userAnswer === undefined) return 'pending';
  if (gate.isCorrect) return 'correct';
  if (gate.isSelfReview) return 'review';
  return 'incorrect';
}

const STATUS_STYLE: Record<Status, { label: string; fg: string; bg: string }> = {
  pending: { label: 'Open', fg: 'var(--text-muted)', bg: 'var(--surface-sunken)' },
  correct: { label: 'Correct', fg: 'var(--ok)', bg: 'var(--ok-soft)' },
  incorrect: { label: 'Incorrect', fg: 'var(--danger)', bg: 'var(--danger-soft)' },
  review: { label: 'Self-review', fg: 'var(--warn)', bg: 'var(--warn-soft)' },
};

/**
 * The decisions sidebar.
 *
 * Questions used to interrupt: the moment a case reached a milestone the
 * question took over the screen and the order box was removed, so the case
 * stopped dead until you answered. This puts every question the case has behind
 * one control instead. You open it when you want it, answer in any order, and
 * the case carries on around you — each answer still plays back into the
 * patient's course through the engine, so what you choose changes what happens.
 */
export const DecisionsPanel: React.FC<DecisionsPanelProps> = ({
  open,
  onClose,
  session,
  onCommit,
  busy = false,
}) => {
  const [openIdx, setOpenIdx] = React.useState<number | null>(null);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [freeText, setFreeText] = React.useState('');

  // Opening a different question must not carry the previous one's draft answer.
  React.useEffect(() => {
    setSelected(null);
    setFreeText('');
  }, [openIdx]);

  React.useEffect(() => {
    if (!open) setOpenIdx(null);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Escape backs out of a question first, and only then out of the panel.
      if (openIdx !== null) setOpenIdx(null);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, openIdx, onClose]);

  if (!open) return null;

  const gates = session.decisionGates;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.35)' }} onClick={onClose} />

      <aside
        role="dialog"
        aria-label="Decisions"
        className="relative w-full sm:w-[30rem] max-w-full h-full flex flex-col overflow-hidden slide-in-right"
        style={{ background: 'var(--surface)', borderLeft: '1px solid var(--border-strong)' }}
      >
        <header
          className="flex items-center gap-3 px-4 py-3 shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <h2 className="text-[15px] font-semibold">Decisions</h2>
          <span className="text-[13px] tnum" style={{ color: 'var(--text-muted)' }}>
            {gates.filter((g) => g.userAnswer !== undefined).length}/{gates.length} answered
          </span>
          <button
            onClick={onClose}
            aria-label="Close decisions"
            className="ml-auto w-8 h-8 rounded-full ring-focus"
            style={{ color: 'var(--text-faint)' }}
          >
            ×
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5">
          {gates.length === 0 && (
            <p className="text-[14px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Your question bank has nothing matching this presentation, so this case has no
              decisions. It plays as a simulation only.
            </p>
          )}

          {gates.map((gate, i) => {
            const status = gateStatus(gate);
            const tone = STATUS_STYLE[status];
            const isOpen = openIdx === i;
            const answered = gate.userAnswer !== undefined;
            const pyq = gate.pyq;

            return (
              <div
                key={gate.id}
                className="rounded-2xl overflow-hidden"
                style={{ background: 'var(--bg)', border: `1px solid ${isOpen ? 'var(--border-strong)' : 'var(--border)'}` }}
              >
                <button
                  onClick={() => setOpenIdx(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="w-full text-left px-4 py-3 ring-focus"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] tnum" style={{ color: 'var(--text-faint)' }}>
                      {i + 1}
                    </span>
                    <span
                      className="text-[11px] px-2 py-0.5 rounded-full"
                      style={{ background: tone.bg, color: tone.fg }}
                    >
                      {tone.label}
                    </span>
                    {pyq.roleTag && pyq.roleTag !== 'UNTAGGED' && (
                      <span className="text-[11px]" style={{ color: 'var(--text-faint)' }}>
                        {pyq.roleTag.toLowerCase()}
                      </span>
                    )}
                  </div>
                  {/* Before it is answered this shows the clinical moment, never
                      the question's own subject — naming the topic here would
                      hand over the answer. */}
                  <p className="mt-1.5 text-[14px] leading-snug" style={{ color: 'var(--text)' }}>
                    {answered ? pyq.stem : gate.patientContext || 'A decision is required.'}
                  </p>
                </button>

                {isOpen && (
                  <div className="px-4 pb-4">
                    {!answered ? (
                      <>
                        <p className="text-[15px] leading-relaxed mb-3">{pyq.stem}</p>

                        {session.blindMode ? (
                          <div className="space-y-3">
                            <label className="block text-[13px]" style={{ color: 'var(--text-muted)' }}>
                              Write your management before the options are shown.
                            </label>
                            <textarea
                              value={freeText}
                              onChange={(e) => setFreeText(e.target.value)}
                              rows={3}
                              placeholder="e.g. immediate needle decompression"
                              className="w-full rounded-xl px-3.5 py-2.5 text-[15px] resize-none ring-focus"
                              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
                            />
                            <button
                              disabled={!freeText.trim() || busy}
                              onClick={() => onCommit(freeText.trim(), i)}
                              className="w-full rounded-xl py-2.5 text-[15px] font-medium ring-focus disabled:opacity-50"
                              style={{ background: 'var(--accent)', color: '#fff' }}
                            >
                              Commit
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {(['A', 'B', 'C', 'D'] as const).map((key) => (
                              <button
                                key={key}
                                onClick={() => setSelected(key)}
                                className="w-full text-left rounded-xl px-3.5 py-2.5 text-[14px] flex gap-2.5 ring-focus"
                                style={{
                                  background: selected === key ? 'var(--accent-soft)' : 'var(--surface)',
                                  border: `1px solid ${selected === key ? 'var(--accent)' : 'var(--border)'}`,
                                }}
                              >
                                <span className="font-semibold shrink-0" style={{ color: 'var(--text-muted)' }}>
                                  {key}
                                </span>
                                <span>{pyq.options[key]}</span>
                              </button>
                            ))}
                            <button
                              disabled={!selected || busy}
                              onClick={() => selected && onCommit(selected, i)}
                              className="w-full rounded-xl py-2.5 text-[15px] font-medium ring-focus disabled:opacity-50"
                              style={{ background: 'var(--accent)', color: '#fff' }}
                            >
                              Commit
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="space-y-3">
                        <div
                          className="rounded-xl px-3.5 py-2.5 text-[14px]"
                          style={{ background: tone.bg, color: tone.fg }}
                        >
                          <div className="font-semibold">
                            {tone.label}
                            {status === 'incorrect' && ` — the answer was ${pyq.correctAnswer}`}
                            {status === 'correct' && !!xpAwardedForGate(session, i) &&
                              ` · +${xpAwardedForGate(session, i)} XP`}
                          </div>
                          {gate.consequenceMessage && (
                            <p className="mt-1.5 leading-relaxed" style={{ color: 'var(--text)' }}>
                              {gate.consequenceMessage}
                            </p>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          {(['A', 'B', 'C', 'D'] as const).map((key) => {
                            const isKey = key === pyq.correctAnswer;
                            const isYours = key === gate.userAnswer;
                            return (
                              <div
                                key={key}
                                className="rounded-xl px-3.5 py-2 text-[14px] flex gap-2.5"
                                style={{
                                  background: isKey ? 'var(--ok-soft)' : 'var(--surface)',
                                  border: `1px solid ${isKey ? 'var(--ok)' : 'var(--border)'}`,
                                }}
                              >
                                <span className="font-semibold shrink-0" style={{ color: 'var(--text-muted)' }}>
                                  {key}
                                </span>
                                <span className="flex-1">{pyq.options[key]}</span>
                                {isYours && (
                                  <span className="text-[11px] shrink-0" style={{ color: 'var(--text-faint)' }}>
                                    your answer
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {(pyq.explanation || pyq.conceptTested) && (
                          <p className="text-[14px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                            {pyq.explanation || pyq.conceptTested}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </aside>
    </div>
  );
};
