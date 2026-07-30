import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { VitalsBar } from './components/VitalsBar';
import { LiveSimulation } from './components/LiveSimulation';
import { QBankIndexBuilder } from './components/QBankIndexBuilder';
import { ScorecardView } from './components/ScorecardView';
import { PromptReferenceModal } from './components/PromptReferenceModal';
import { CaseSession, CaseMode, PYQItem } from './types';
import { DEFAULT_PYQ_INDEX } from './data/defaultQBank';
import { processTurnOffline, generateScorecard } from './utils/ccsEngine';
import { buildCaseSessionFromScaffold } from './utils/caseBinder';
import { parseRawQBankTextOffline } from './utils/qbankParser';
import { saveActiveSession, loadActiveSession, saveQBankIndex, loadQBankIndex, saveCompletedCase, getMissedQIDsFromHistory } from './utils/storage';
import { Sparkles, Activity, Layers, Award, BookOpen, AlertCircle, Play, ShieldAlert, WifiOff } from 'lucide-react';

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

        // Try loading pre-built offline bundle from public/pyq-index/
        const manifestRes = await fetch('/pyq-index/manifest.json');
        if (manifestRes.ok) {
          const manifest = await manifestRes.json();
          let allItems: PYQItem[] = [];
          for (const sub of manifest.subjects || []) {
            const safeName = sub.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const subRes = await fetch(`/pyq-index/subject_${safeName}.json`);
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white antialiased">
      {/* App Header */}
      <Header
        session={session}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onStartNewCase={(mode, subject) => handleStartNewCase(mode, subject)}
        onPauseResume={handlePauseResume}
        onEndCase={() => handleEndCase()}
        isStarting={isStarting}
      />

      {/* Offline Mode Indicator Badge */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-1.5 flex items-center justify-between text-xs font-mono text-emerald-400">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>100% Offline Mode Active — Zero Backend/API Dependency</span>
        </div>
        <div className="text-slate-400 text-[11px] hidden sm:block">
          Indexed Questions Ready: <strong className="text-slate-200">{pyqList.length}</strong>
        </div>
      </div>

      {/* Patient Vitals Ticker Bar */}
      {session && session.patient && (
        <VitalsBar vitals={session.patient.currentVitals} />
      )}

      {/* Error Alert Message */}
      {errorMessage && (
        <div className="bg-rose-950/80 border-b border-rose-500/50 p-3 text-center text-xs text-rose-200 font-mono flex items-center justify-center space-x-2">
          <AlertCircle className="w-4 h-4 text-rose-400" />
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="underline ml-2 text-rose-300">Dismiss</button>
        </div>
      )}

      {/* Main View Area */}
      <main className="flex-1 pb-12">
        {/* Welcome Splash if no session active */}
        {!session && activeTab === 'sim' ? (
          <div className="max-w-4xl mx-auto px-4 py-12 text-center space-y-8">
            <div className="inline-flex items-center space-x-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-3.5 py-1.5 rounded-full text-xs font-mono">
              <WifiOff className="w-3.5 h-3.5" />
              <span>100% Offline Standalone App • No Internet Needed</span>
            </div>

            <div className="space-y-3">
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white font-sans tracking-tight">
                Offline PYQ-Driven CCS Case Simulator
              </h2>
              <p className="text-sm text-slate-400 max-w-2xl mx-auto leading-relaxed">
                Turn NEET-PG & INI-CET Previous Year Questions into interactive USMLE Step 3 style clinical case simulations right in your browser. Complete offline execution with local storage!
              </p>
            </div>

            {/* Launch Mode Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left max-w-3xl mx-auto">
              <div
                onClick={() => handleStartNewCase('standard', 'Medicine')}
                className="bg-slate-900 border border-slate-800 hover:border-indigo-500/60 p-5 rounded-2xl cursor-pointer transition group shadow-lg"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center mb-3 group-hover:scale-110 transition">
                  <Activity className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-white font-sans">Standard CCS Case</h3>
                <p className="text-xs text-slate-400 mt-1">
                  5-7 PYQ Decision Gates. Full patient simulation with real-time clock & turnaround times.
                </p>
              </div>

              <div
                onClick={() => handleStartNewCase('rapid', 'Medicine')}
                className="bg-slate-900 border border-slate-800 hover:border-cyan-500/60 p-5 rounded-2xl cursor-pointer transition group shadow-lg"
              >
                <div className="w-10 h-10 rounded-xl bg-cyan-600/20 text-cyan-400 flex items-center justify-center mb-3 group-hover:scale-110 transition">
                  <Play className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-white font-sans">Rapid 8-Min Mode</h3>
                <p className="text-xs text-slate-400 mt-1">
                  3 decision gates. High-yield quick clinical case revision for daily practice.
                </p>
              </div>

              <div
                onClick={() => handleStartNewCase('standard', 'Mixed', true)}
                className="bg-slate-900 border border-slate-800 hover:border-amber-500/60 p-5 rounded-2xl cursor-pointer transition group shadow-lg"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-600/20 text-amber-400 flex items-center justify-center mb-3 group-hover:scale-110 transition">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-white font-sans">Blind / Free-Text Mode</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Commit free-text clinical management before options are revealed. INI-CET challenge.
                </p>
              </div>
            </div>

            <div className="pt-4">
              <button
                onClick={() => handleStartNewCase('standard', 'Medicine')}
                disabled={isStarting}
                className="bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold px-8 py-3.5 rounded-xl shadow-xl transition inline-flex items-center space-x-2 text-sm disabled:opacity-50 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isStarting ? 'Building Clinical Case...' : 'Start Random Case Now'}</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            {activeTab === 'sim' && session && (
              <LiveSimulation
                session={session}
                onSendCommand={handleSendCommand}
                onCommitGateAnswer={handleCommitGateAnswer}
                isProcessing={isProcessing}
              />
            )}

            {activeTab === 'qbank' && (
              <QBankIndexBuilder
                pyqList={pyqList}
                onUpdatePyqList={setPyqList}
                onParseRawText={handleParseRawText}
                isParsing={isParsingIndex}
                isCaseActive={session?.status === 'active'}
              />
            )}

            {activeTab === 'scorecard' && session && (
              <ScorecardView
                session={session}
                onRestartCase={() => handleStartNewCase('standard', 'Medicine')}
              />
            )}

            {activeTab === 'instructions' && <PromptReferenceModal />}
          </>
        )}
      </main>
    </div>
  );
}

