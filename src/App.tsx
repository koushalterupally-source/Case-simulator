import React, { useState, useEffect } from 'react';
import { QBankIndexBuilder } from './components/QBankIndexBuilder';
import { CaseView } from './components/simple/CaseView';
import { StartScreen } from './components/simple/StartScreen';
import { Scorecard } from './components/simple/Scorecard';
import { CaseSession, CaseMode, PYQItem } from './types';
import { DEFAULT_PYQ_INDEX } from './data/defaultQBank';
import { processTurnOffline, generateScorecard } from './utils/ccsEngine';
import { buildCaseSessionFromScaffold } from './utils/caseBinder';
import { parseRawQBankTextOffline } from './utils/qbankParser';
import { saveActiveSession, loadActiveSession, saveQBankIndex, loadQBankIndex, saveCompletedCase, getMissedQIDsFromHistory } from './utils/storage';

export default function App() {
  const [session, setSession] = useState<CaseSession | null>(() => {
    try {
      const saved = localStorage.getItem('medtrix_active_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [pyqList, setPyqList] = useState<PYQItem[]>(DEFAULT_PYQ_INDEX);
  const [isLoadingQBank, setIsLoadingQBank] = useState(true);

  const [activeTab, setActiveTab] = useState<'sim' | 'qbank' | 'scorecard' | 'instructions'>('sim');
  const [isStarting, setIsStarting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isParsingIndex, setIsParsingIndex] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load active session on mount
  useEffect(() => {
    async function initSession() {
      const active = await loadActiveSession();
      if (active) setSession(active);
    }
    initSession();
  }, []);

  // Initialize QBank from IndexedDB or static offline index bundle
  useEffect(() => {
    async function initQBank() {
      setIsLoadingQBank(true);
      try {
        const storedIndex = await loadQBankIndex();
        if (storedIndex && storedIndex.length > 50) {
          setPyqList(storedIndex);
          setIsLoadingQBank(false);
          return;
        }

        // Try loading pre-built offline bundle from public/pyq-index/.
        // Must go through BASE_URL: on GitHub Pages the app is served from
        // /<repo>/, so a root-absolute path 404s.
        const base = import.meta.env.BASE_URL;
        const manifestRes = await fetch(`${base}pyq-index/manifest.json`);
        if (manifestRes.ok) {
          const manifest = await manifestRes.json();
          let allItems: PYQItem[] = [];
          for (const sub of manifest.subjects || []) {
            const safeName = sub.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const subRes = await fetch(`${base}pyq-index/subject_${safeName}.json`);
            if (subRes.ok) {
              const subItems: PYQItem[] = await subRes.json();
              allItems = allItems.concat(subItems);
            }
          }
          if (allItems.length > 0) {
            setPyqList(allItems);
            await saveQBankIndex(allItems);
          }
        }
      } catch (err) {
        console.warn('Failed to load pre-built offline QBank bundle:', err);
      } finally {
        setIsLoadingQBank(false);
      }
    }
    initQBank();
  }, []);

  // Save active session to localStorage when updated
  useEffect(() => {
    try {
      if (session) {
        localStorage.setItem('medtrix_active_session', JSON.stringify(session));
      } else {
        localStorage.removeItem('medtrix_active_session');
      }
    } catch (e) {
      console.warn('Could not save session to localStorage:', e);
    }
  }, [session]);

  // Handler to start a new offline case
  const handleStartNewCase = async (mode: CaseMode = 'standard', subject: string = 'Medicine', blindMode: boolean = false) => {
    setIsStarting(true);
    setErrorMessage(null);
    try {
      const missedQIDs = await getMissedQIDsFromHistory();
      const newSession = buildCaseSessionFromScaffold(pyqList, {
        mode: blindMode ? 'blind' : mode,
        subject,
        missedQIDs,
      });
      setSession(newSession);
      await saveActiveSession(newSession);
      setActiveTab('sim');
    } catch (err: any) {
      console.error('Failed to start case offline:', err);
      setErrorMessage('Failed to generate offline case simulation.');
    } finally {
      setIsStarting(false);
    }
  };

  // Handler to process command turn offline
  const handleSendCommand = async (command: string) => {
    if (!session || isProcessing) return;
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const updated = processTurnOffline(session, command);
      setSession(updated);
      await saveActiveSession(updated);
    } catch (err: any) {
      console.error('Failed to process turn offline:', err);
      setErrorMessage('Failed to process command in offline engine.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handler to submit Decision Gate Answer offline
  const handleCommitGateAnswer = async (answer: string, gateIndex?: number) => {
    if (!session || isProcessing) return;
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const updated = processTurnOffline(session, undefined, answer, gateIndex);
      setSession(updated);
      await saveActiveSession(updated);
    } catch (err: any) {
      console.error('Failed to commit gate answer offline:', err);
      setErrorMessage('Failed to process gate answer in offline engine.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handler to End and Score Case offline
  const handleEndCase = async (currentSess?: CaseSession) => {
    const targetSession = currentSess || session;
    if (!targetSession) return;
    setIsProcessing(true);

    try {
      const scorecard = generateScorecard(targetSession);
      const scoredSession: CaseSession = {
        ...targetSession,
        status: 'completed',
        scorecard,
      };
      setSession(scoredSession);
      await saveCompletedCase(scoredSession);
      setActiveTab('scorecard');
    } catch (err: any) {
      console.error('Failed to generate scorecard offline:', err);
      setErrorMessage('Failed to generate end-of-case scorecard.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handler for Client-Side Offline Index Parsing
  const handleParseRawText = async (rawText: string) => {
    setIsParsingIndex(true);
    setErrorMessage(null);
    try {
      const result = parseRawQBankTextOffline(rawText, pyqList);
      if (result && result.parsedItems.length > 0) {
        setPyqList((prev) => [...result.parsedItems, ...prev]);
        await saveQBankIndex([...result.parsedItems, ...pyqList]);
      } else {
        setErrorMessage('No valid question patterns found in raw text snippet.');
      }
    } catch (err: any) {
      console.error('Failed to parse index offline:', err);
      setErrorMessage('Failed to parse raw text into question index.');
    } finally {
      setIsParsingIndex(false);
    }
  };

  const handlePauseResume = () => {
    if (!session) return;
    setSession({
      ...session,
      status: session.status === 'paused' ? 'active' : 'paused',
    });
  };

  const showScorecard = activeTab === 'scorecard' && session?.scorecard;

  if (activeTab === 'qbank') {
    return (
      <div className="min-h-screen px-4" style={{ background: 'var(--bg)' }}>
        <div className="max-w-[46rem] mx-auto py-8">
          <button
            onClick={() => setActiveTab('sim')}
            className="text-[13px] mb-6 ring-focus rounded px-1"
            style={{ color: 'var(--text-muted)' }}
          >
            ← Back
          </button>
          <QBankIndexBuilder
            pyqList={pyqList}
            onUpdatePyqList={setPyqList}
            onParseRawText={handleParseRawText}
            isParsing={isParsingIndex}
            isCaseActive={!!session && session.status === 'active'}
          />
        </div>
      </div>
    );
  }

  if (showScorecard && session) {
    return (
      <Scorecard
        session={session}
        onBack={() => setActiveTab('sim')}
        onNewCase={() => {
          setSession(null);
          setActiveTab('sim');
        }}
      />
    );
  }

  if (!session) {
    return (
      <>
        {errorMessage && <ErrorBanner message={errorMessage} onDismiss={() => setErrorMessage(null)} />}
        <StartScreen
          onStart={(mode, subject, blind) => handleStartNewCase(mode, subject, !!blind)}
          onOpenQBank={() => setActiveTab('qbank')}
          questionCount={pyqList.length}
          loading={isLoadingQBank}
          starting={isStarting}
        />
      </>
    );
  }

  return (
    <>
      {errorMessage && <ErrorBanner message={errorMessage} onDismiss={() => setErrorMessage(null)} />}
      <CaseView
        session={session}
        onSendCommand={handleSendCommand}
        onCommitGateAnswer={handleCommitGateAnswer}
        isProcessing={isProcessing}
        onEndCase={() => (session.scorecard ? setActiveTab('scorecard') : handleEndCase())}
      />
    </>
  );
}

const ErrorBanner: React.FC<{ message: string; onDismiss: () => void }> = ({ message, onDismiss }) => (
  <div
    className="fixed top-3 left-1/2 -translate-x-1/2 z-50 rounded-xl px-4 py-2.5 text-[14px] flex items-center gap-3 shadow-sm"
    style={{ background: 'var(--danger-soft)', color: 'var(--danger)', border: '1px solid var(--danger)' }}
  >
    <span>{message}</span>
    <button onClick={onDismiss} className="ring-focus rounded" aria-label="Dismiss">
      ×
    </button>
  </div>
);
