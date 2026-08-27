import React from 'react';
import { CaseSession } from '../../types';
import { computeGameStats } from '../../utils/gamification';

interface ScorecardProps {
  session: CaseSession;
  onNewCase: () => void;
  onBack: () => void;
}

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="py-4" style={{ borderTop: '1px solid var(--border)' }}>
    <div className="text-[13px] mb-1.5" style={{ color: 'var(--text-faint)' }}>
      {label}
    </div>
    <div className="text-[15px] leading-relaxed">{children}</div>
  </div>
);

export const Scorecard: React.FC<ScorecardProps> = ({ session, onNewCase, onBack }) => {
  const card = session.scorecard;
  const stats = computeGameStats(session);
  if (!card) return null;

  const earned = stats.badges.filter((b) => b.earned);

  return (
    <div className="min-h-screen px-4" style={{ background: 'var(--bg)' }}>
      <div className="max-w-[46rem] mx-auto py-10">
        <button
          onClick={onBack}
          className="text-[13px] mb-8 ring-focus rounded px-1"
          style={{ color: 'var(--text-muted)' }}
        >
          ← Back to case
        </button>

        <h1 className="font-display text-[22px] font-semibold tracking-tight">Case complete</h1>
        <p className="mt-1.5 text-[15px]" style={{ color: 'var(--text-muted)' }}>
          {session.patient.name} · {card.finalDiagnosis}
        </p>

        {/* Headline numbers */}
        <div className="mt-7 flex flex-wrap gap-x-10 gap-y-4">
          {[
            { v: `${session.completedOrders?.length || 0}`, l: 'orders completed' },
            { v: `${stats.incidentalsCaught}/${stats.incidentalsTotal}`, l: 'incidentals managed' },
            { v: `${card.overallScore}%`, l: 'clinical score' },
            { v: `Grade ${card.overallGrade}`, l: 'competency' },
          ].map((s) => (
            <div key={s.l}>
              <div className="font-display text-[26px] font-semibold tnum leading-none">{s.v}</div>
              <div className="text-[13px] mt-1" style={{ color: 'var(--text-faint)' }}>
                {s.l}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8">
          <Row label="Final Diagnosis & Clinching Clue">
            <div className="font-medium text-[16px] mb-1" style={{ color: 'var(--text)' }}>
              {card.finalDiagnosis}
            </div>
            <div>
              {card.clinchingClue}
              {card.clinchingTime && (
                <span style={{ color: 'var(--text-faint)' }}> — available from {card.clinchingTime}</span>
              )}
            </div>
          </Row>

          {card.criticalDelays.length > 0 && (
            <Row label="Critical Delays / Misses">
              <div className="space-y-2">
                {card.criticalDelays.map((del, i) => (
                  <div key={i} className="flex gap-2.5 text-[14px]" style={{ color: 'var(--danger)' }}>
                    <span>⚠️</span>
                    <span>{del}</span>
                  </div>
                ))}
              </div>
            </Row>
          )}

          {card.overOrderingList.length > 0 && (
            <Row label="Unindicated Investigations">
              <div className="space-y-1.5 text-[14px]" style={{ color: 'var(--text-muted)' }}>
                {card.overOrderingList.map((ord, i) => (
                  <div key={i}>• {ord}</div>
                ))}
              </div>
            </Row>
          )}

          {card.gateResults.length > 0 && (
            <Row label="Decisions">
              <div className="space-y-2.5">
                {card.gateResults.map((g) => (
                  <div key={g.qid} className="flex gap-3">
                    <span
                      className="shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full"
                      style={{ background: g.isCorrect ? 'var(--ok)' : 'var(--danger)' }}
                    />
                    <div>
                      <div>{g.concept}</div>
                      <div className="text-[13px] tnum" style={{ color: 'var(--text-faint)' }}>
                        {g.qid} · {g.examYear} · you chose {g.userChoice || 'none'}, answer {g.correctChoice}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Row>
          )}

          {card.incidentalFindingsReport.length > 0 && (
            <Row label="Incidental findings">
              <div className="space-y-2.5">
                {card.incidentalFindingsReport.map((inc, i) => (
                  <div key={i} className="flex gap-3">
                    <span
                      className="shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full"
                      style={{
                        background:
                          inc.status === 'noticed_addressed' ? 'var(--ok)' : 'var(--text-faint)',
                      }}
                    />
                    <div>
                      <div>{inc.title}</div>
                      <div className="text-[13px]" style={{ color: 'var(--text-faint)' }}>
                        {inc.outcome}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Row>
          )}

          {card.topConceptsToRevise && card.topConceptsToRevise.length > 0 && (
            <Row label="Revise these">
              <ul className="space-y-1.5">
                {card.topConceptsToRevise.map((c, i) => (
                  <li key={i}>
                    {c.concept}
                    <span className="text-[13px] tnum" style={{ color: 'var(--text-faint)' }}>
                      {' '}
                      · {(c.sourceQIDs || []).join(', ')}
                    </span>
                  </li>
                ))}
              </ul>
            </Row>
          )}

          {earned.length > 0 && (
            <Row label="Earned">
              <div className="flex flex-wrap gap-2">
                {earned.map((b) => (
                  <span
                    key={b.id}
                    title={b.description}
                    className="rounded-full px-3 py-1 text-[13px]"
                    style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                  >
                    {b.label}
                  </span>
                ))}
              </div>
            </Row>
          )}
        </div>

        <button
          onClick={onNewCase}
          className="mt-8 w-full rounded-xl py-3 text-[15px] font-medium ring-focus"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          Start another case
        </button>
      </div>
    </div>
  );
};
