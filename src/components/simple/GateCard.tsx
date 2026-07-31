import React from 'react';
import { DecisionGate } from '../../types';

interface GateCardProps {
  gate: DecisionGate;
  index: number;
  total: number;
  onCommit: (answer: string) => void;
  blindMode?: boolean;
  xpAwarded?: number;
}

/**
 * A decision gate, inline in the transcript.
 *
 * Before commit this shows the question and nothing else — no concept, no
 * explanation, no correct answer. Those only appear once an answer is in.
 */
export const GateCard: React.FC<GateCardProps> = ({
  gate,
  index,
  total,
  onCommit,
  blindMode = false,
  xpAwarded = 0,
}) => {
  const [selected, setSelected] = React.useState<string | null>(null);
  const [freeText, setFreeText] = React.useState('');
  const answered = gate.userAnswer !== undefined;
  const pyq = gate.pyq;

  React.useEffect(() => {
    setSelected(null);
    setFreeText('');
  }, [gate.id]);

  const verdictTone = gate.isCorrect
    ? { fg: 'var(--ok)', bg: 'var(--ok-soft)' }
    : gate.isSelfReview
    ? { fg: 'var(--warn)', bg: 'var(--warn-soft)' }
    : { fg: 'var(--danger)', bg: 'var(--danger-soft)' };

  return (
    <div
      className="rounded-2xl overflow-hidden fade-rise"
      style={{ background: 'var(--surface)', border: '1px solid var(--border-strong)' }}
    >
      <div
        className="px-5 py-2.5 flex items-center justify-between gap-3 text-[12px]"
        style={{ background: 'var(--surface-sunken)', color: 'var(--text-muted)' }}
      >
        <span>
          Decision {index + 1} of {total}
        </span>
        <span className="tnum">{pyq.qid}</span>
      </div>

      <div className="px-5 py-5">
        <p className="text-[15px] leading-relaxed">{pyq.stem}</p>

        {!answered ? (
          blindMode ? (
            <div className="mt-5 space-y-3">
              <label className="block text-[13px]" style={{ color: 'var(--text-muted)' }}>
                Write your management before the options are shown.
              </label>
              <textarea
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
                rows={3}
                placeholder="e.g. immediate needle decompression"
                className="w-full rounded-xl px-3.5 py-2.5 text-[15px] resize-none ring-focus"
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                }}
              />
              <button
                onClick={() => freeText.trim() && onCommit(freeText.trim())}
                disabled={!freeText.trim()}
                className="w-full rounded-xl py-2.5 text-[14px] font-medium ring-focus disabled:opacity-40"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                Commit
              </button>
            </div>
          ) : (
            <div className="mt-5 space-y-2">
              {(['A', 'B', 'C', 'D'] as const).map((key) => {
                const isSel = selected === key;
                return (
                  <button
                    key={key}
                    onClick={() => setSelected(key)}
                    className="w-full text-left rounded-xl px-4 py-3 text-[15px] flex gap-3 transition-colors ring-focus"
                    style={{
                      background: isSel ? 'var(--accent-soft)' : 'var(--bg)',
                      border: `1px solid ${isSel ? 'var(--accent)' : 'var(--border)'}`,
                    }}
                  >
                    <span
                      className="shrink-0 font-medium"
                      style={{ color: isSel ? 'var(--accent)' : 'var(--text-faint)' }}
                    >
                      {key}
                    </span>
                    <span>{pyq.options[key]}</span>
                  </button>
                );
              })}
              <button
                onClick={() => selected && onCommit(selected)}
                disabled={!selected}
                className="w-full rounded-xl py-2.5 mt-3 text-[14px] font-medium ring-focus disabled:opacity-40"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                Commit answer
              </button>
            </div>
          )
        ) : (
          <div className="mt-5 space-y-4">
            <div
              className="rounded-xl px-4 py-3 text-[14px]"
              style={{ background: verdictTone.bg, color: verdictTone.fg }}
            >
              <div className="font-semibold">
                {gate.isCorrect
                  ? 'Correct'
                  : gate.isSelfReview
                  ? 'Review this yourself'
                  : 'Incorrect'}
                {!gate.isCorrect && ` — the answer was ${pyq.correctAnswer}`}
                {gate.isCorrect && !!xpAwarded && ` · +${xpAwarded} XP`}
              </div>
              {gate.consequenceMessage && (
                <p className="mt-1.5 leading-relaxed" style={{ color: 'var(--text)' }}>
                  {gate.consequenceMessage}
                </p>
              )}
            </div>

            <div className="text-[14px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              {pyq.explanation || pyq.conceptTested}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
