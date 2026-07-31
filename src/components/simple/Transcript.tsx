import React from 'react';
import { CaseSession, SimTurn, Vitals } from '../../types';
import {
  hrSeverity,
  spo2Severity,
  rrSeverity,
  bpSeverity,
  tempSeverity,
  grbsSeverity,
  VitalSeverity,
} from '../../utils/gamification';

const toneFor = (s: VitalSeverity) =>
  s === 'critical' ? 'var(--danger)' : s === 'warning' ? 'var(--warn)' : 'var(--text-muted)';

/** Vitals as one quiet line. Only the deranged values take colour. */
export const VitalsLine: React.FC<{ vitals: Vitals }> = ({ vitals }) => {
  const items: { label: string; value: string; sev: VitalSeverity }[] = [
    { label: 'HR', value: `${vitals.hr}`, sev: hrSeverity(vitals.hr) },
    { label: 'BP', value: `${vitals.bp}`, sev: bpSeverity(vitals.bp) },
    { label: 'RR', value: `${vitals.rr}`, sev: rrSeverity(vitals.rr) },
    { label: 'SpO₂', value: `${vitals.spo2}%`, sev: spo2Severity(vitals.spo2) },
    { label: 'Temp', value: `${vitals.temp}`, sev: tempSeverity(vitals.temp) },
    { label: 'Glucose', value: `${vitals.grbs}`, sev: grbsSeverity(vitals.grbs) },
  ];

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] tnum">
      {items.map((it) => (
        <span key={it.label}>
          <span style={{ color: 'var(--text-faint)' }}>{it.label} </span>
          <span style={{ color: toneFor(it.sev), fontWeight: it.sev === 'normal' ? 400 : 600 }}>
            {it.value}
          </span>
        </span>
      ))}
    </div>
  );
};

const timeLabel = (t: SimTurn) =>
  `Day ${t.simTime.day}, ${String(t.simTime.hour).padStart(2, '0')}:${String(t.simTime.minute).padStart(2, '0')}`;

/**
 * One turn. The user's command reads like something they said; the simulation's
 * reply reads like prose. No cards inside cards.
 */
const Turn: React.FC<{ turn: SimTurn; showVitals: boolean }> = ({ turn, showVitals }) => (
  <div className="fade-rise">
    {turn.userCommand && (
      <div className="flex justify-end mb-5">
        <div
          className="max-w-[85%] px-3.5 py-2 rounded-2xl text-[15px]"
          style={{ background: 'var(--surface-sunken)', color: 'var(--text)' }}
        >
          {turn.userCommand}
        </div>
      </div>
    )}

    <div className="mb-1.5 text-[12px] tnum" style={{ color: 'var(--text-faint)' }}>
      {timeLabel(turn)} · {turn.location}
    </div>

    <div className="prose-body text-[15px] whitespace-pre-line" style={{ color: 'var(--text)' }}>
      {turn.whatHappened}
    </div>

    {showVitals && (
      <div className="mt-3">
        <VitalsLine vitals={turn.vitals} />
      </div>
    )}

    {turn.newResults && turn.newResults.length > 0 && (
      <div className="mt-4 space-y-3">
        {turn.newResults.map((res, i) => (
          <div
            key={i}
            className="rounded-xl px-4 py-3"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-baseline justify-between gap-3 mb-1">
              <span className="text-[13px] font-semibold">{res.orderName}</span>
              <span className="text-[12px] tnum shrink-0" style={{ color: 'var(--text-faint)' }}>
                {res.readySimTime}
              </span>
            </div>
            <div className="mono whitespace-pre-line" style={{ color: 'var(--text-muted)' }}>
              {res.resultText}
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

interface TranscriptProps {
  session: CaseSession;
  /** Rendered inline after the last turn — the active decision gate. */
  children?: React.ReactNode;
}

export const Transcript: React.FC<TranscriptProps> = ({ session, children }) => {
  const bottomRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [session.turns.length, session.currentGateIndex]);

  return (
    <div className="space-y-8">
      {/* Patient header — plain text, not a card */}
      <div className="pb-6" style={{ borderBottom: '1px solid var(--border)' }}>
        <h1 className="text-[19px] font-semibold tracking-tight">
          {session.isQuestionLed ? (
            session.title
          ) : (
            <>
              {session.patient.name}
              <span className="font-normal" style={{ color: 'var(--text-muted)' }}>
                {' '}· {session.patient.age} · {session.patient.gender}
              </span>
            </>
          )}
        </h1>
        {!session.isQuestionLed && (
          <p className="mt-1 text-[14px]" style={{ color: 'var(--text-muted)' }}>
            {session.patient.chiefComplaint}
          </p>
        )}
      </div>

      {session.turns.map((turn, i) => (
        <Turn
          key={i}
          turn={turn}
          showVitals={!session.isQuestionLed && i === session.turns.length - 1}
        />
      ))}

      {children}

      <div ref={bottomRef} />
    </div>
  );
};
