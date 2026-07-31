import React from 'react';
import { CaseMode } from '../../types';

interface StartScreenProps {
  onStart: (mode: CaseMode, subject: string, blind?: boolean) => void;
  onOpenQBank: () => void;
  questionCount: number;
  loading?: boolean;
  starting?: boolean;
}

export const StartScreen: React.FC<StartScreenProps> = ({
  onStart,
  onOpenQBank,
  questionCount,
  loading,
  starting,
}) => (
  <div className="min-h-screen flex flex-col px-6" style={{ background: 'var(--bg)' }}>
    <div className="flex-1 flex items-center justify-center">
      <div className="w-full max-w-[26rem] py-16">
        <h1 className="text-[26px] font-semibold tracking-tight leading-snug">
          Clinical case simulator
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          You are the treating doctor. Take a history, order what you need, and commit to the
          decisions as they come. Every decision is a real NEET-PG or INI-CET question.
        </p>

        <div className="mt-8 space-y-2.5">
          <button
            onClick={() => onStart('standard', 'All')}
            disabled={starting || loading}
            className="w-full rounded-xl py-3 text-[15px] font-medium ring-focus disabled:opacity-50"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {starting ? 'Preparing…' : 'Start a case'}
          </button>

          <div className="flex gap-2.5">
            <button
              onClick={() => onStart('rapid', 'All')}
              disabled={starting || loading}
              className="flex-1 rounded-xl py-2.5 text-[14px] ring-focus disabled:opacity-50"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
              }}
            >
              Quick case
            </button>
            <button
              onClick={() => onStart('blind', 'All', true)}
              disabled={starting || loading}
              className="flex-1 rounded-xl py-2.5 text-[14px] ring-focus disabled:opacity-50"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
              }}
            >
              Blind mode
            </button>
          </div>
        </div>

        <div
          className="mt-8 pt-5 flex items-center justify-between text-[13px]"
          style={{ borderTop: '1px solid var(--border)', color: 'var(--text-faint)' }}
        >
          <span className="tnum">
            {loading ? 'Loading questions…' : `${questionCount.toLocaleString()} questions`}
          </span>
          <button onClick={onOpenQBank} className="ring-focus rounded px-1" style={{ color: 'var(--text-muted)' }}>
            Question bank
          </button>
        </div>
      </div>
    </div>
  </div>
);
