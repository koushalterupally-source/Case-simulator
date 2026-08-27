import React, { useEffect, useState } from 'react';
import { CaseMode } from '../../types';

interface StartScreenProps {
  onStart: (mode: CaseMode, subject: string, blind?: boolean) => void;
  onStartQuestionLed: () => void;
  onOpenQBank: () => void;
  questionCount: number;
  loading?: boolean;
  starting?: boolean;
}

// Same localStorage key the sibling PYQ app writes, so a theme choice made in
// either app carries over to the other. Every access is wrapped in try/catch
// — private browsing throws just touching localStorage.
const THEME_KEY = 'pyq-theme';

function readExplicitTheme(): 'light' | 'dark' | null {
  const attr = document.documentElement.getAttribute('data-theme');
  return attr === 'light' || attr === 'dark' ? attr : null;
}

function prefersDark(): boolean {
  try {
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  } catch {
    return false;
  }
}

/** Small light/dark toggle, shared visual language with the sibling app's theme switch. */
const ThemeToggle: React.FC = () => {
  const [isDark, setIsDark] = useState<boolean>(() => readExplicitTheme() === 'dark' || (!readExplicitTheme() && prefersDark()));

  useEffect(() => {
    setIsDark(readExplicitTheme() === 'dark' || (!readExplicitTheme() && prefersDark()));
  }, []);

  const toggle = () => {
    const current = readExplicitTheme();
    const next: 'light' | 'dark' = current ? (current === 'dark' ? 'light' : 'dark') : prefersDark() ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // private browsing — theme still applies for this session, just isn't persisted
    }
    setIsDark(next === 'dark');
  };

  return (
    <button
      onClick={toggle}
      className="ring-focus rounded-full px-2.5 py-1 text-[13px]"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {isDark ? '☀ Light' : '☾ Dark'}
    </button>
  );
};

export const StartScreen: React.FC<StartScreenProps> = ({
  onStart,
  onStartQuestionLed,
  onOpenQBank,
  questionCount,
  loading,
  starting,
}) => (
  <div className="min-h-screen flex flex-col px-6" style={{ background: 'var(--bg)' }}>
    <div className="flex-1 flex items-center justify-center">
      <div className="w-full max-w-[26rem] py-16">
        <div className="flex items-center justify-between mb-6 text-[13px]">
          <a href="../" className="ring-focus rounded px-1" style={{ color: 'var(--text-muted)' }}>
            ← Back to PYQ
          </a>
          <ThemeToggle />
        </div>

        <h1 className="font-display text-[26px] font-semibold tracking-tight leading-snug">
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

          <button
            onClick={onStartQuestionLed}
            disabled={starting || loading}
            className="w-full rounded-xl py-2.5 text-[14px] ring-focus disabled:opacity-50"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
          >
            Practise from your whole bank
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
