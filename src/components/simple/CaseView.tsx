import React from 'react';
import { CaseSession } from '../../types';
import { Transcript } from './Transcript';
import { Composer } from './Composer';
import { OrderSheet } from './OrderSheet';
import { formatSimTime } from '../../utils/ccsEngine';

interface CaseViewProps {
  session: CaseSession;
  onSendCommand: (command: string) => void;
  onCommitGateAnswer?: (answer: string, gateIndex?: number) => void;
  isProcessing: boolean;
  onEndCase: () => void;
}

export const CaseView: React.FC<CaseViewProps> = ({
  session,
  onSendCommand,
  isProcessing,
  onEndCase,
}) => {
  const done = session.status === 'completed';
  const [ordersOpen, setOrdersOpen] = React.useState(false);

  const pendingCount = session.pendingOrders?.length || 0;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      <OrderSheet
        open={ordersOpen}
        onClose={() => setOrdersOpen(false)}
        onSubmit={onSendCommand}
      />
      {/* Top Clinical Status Bar */}
      <header
        className="sticky top-0 z-10 px-4"
        style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}
      >
        <div className="max-w-[46rem] mx-auto h-14 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex flex-col">
              <span className="text-[14px] font-semibold truncate" style={{ color: 'var(--text)' }}>
                {session.patient.name} ({session.patient.age}{session.patient.gender === 'Male' ? 'M' : 'F'})
              </span>
              <span className="text-[12px] tnum flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                <span>🏥 {session.currentLocation}</span>
                <span>•</span>
                <span>⏱ {formatSimTime(session.simTime)}</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => setOrdersOpen(true)}
              className="text-[13px] font-medium rounded-lg px-3 py-1.5 ring-focus flex items-center gap-1.5 transition-colors"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
              }}
            >
              <span>📋 Orders</span>
              {pendingCount > 0 && (
                <span
                  className="px-1.5 py-0.2 rounded-full text-[11px] font-bold"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                >
                  {pendingCount}
                </span>
              )}
            </button>

            <button
              onClick={onEndCase}
              className="text-[13px] font-medium rounded-lg px-3 py-1.5 ring-focus transition-colors"
              style={{
                background: done ? 'var(--accent)' : 'transparent',
                color: done ? '#fff' : 'var(--text-muted)',
                border: done ? 'none' : '1px solid var(--border)',
              }}
            >
              {done ? 'View Scorecard' : 'End Case'}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 pb-12">
        <div className="max-w-[46rem] mx-auto pt-6">
          <Transcript session={session}>
            {isProcessing && (
              <div className="text-[14px] py-2 flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                <span className="animate-spin text-[16px]">⏳</span> Processing clinical turn…
              </div>
            )}
          </Transcript>

          {/* Case complete banner */}
          {done ? (
            <div
              className="mt-8 rounded-2xl p-6 text-center fade-rise"
              style={{ background: 'var(--surface)', border: '1px solid var(--border-strong)' }}
            >
              <h2 className="text-[17px] font-semibold" style={{ color: 'var(--text)' }}>
                Patient Management Concluded
              </h2>
              <p className="mt-2 text-[14px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                The simulation has ended. Review your clinical investigations, turnaround decisions, critical life-saving interventions, and diagnostic accuracy.
              </p>
              <button
                onClick={onEndCase}
                className="mt-5 px-6 py-2.5 rounded-xl text-[14px] font-semibold ring-focus"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                📊 View Comprehensive Clinical Scorecard
              </button>
            </div>
          ) : (
            <div className="mt-6">
              <Composer
                onSend={onSendCommand}
                onOpenOrders={() => setOrdersOpen(true)}
                disabled={done}
                busy={isProcessing}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
