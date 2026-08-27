import { CaseSession, PYQItem } from '../types';
import { DEFAULT_PYQ_INDEX } from '../data/defaultQBank';

const DB_NAME = 'PYQ_CCS_Simulator_DB';
const DB_VERSION = 1;

/**
 * IndexedDB Connection helper
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains('active_session')) {
        db.createObjectStore('active_session', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('qbank_index')) {
        db.createObjectStore('qbank_index', { keyPath: 'qid' });
      }
      if (!db.objectStoreNames.contains('case_history')) {
        db.createObjectStore('case_history', { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save active case session to storage
 */
export async function saveActiveSession(session: CaseSession): Promise<void> {
  try {
    const db = await openDatabase();
    const tx = db.transaction('active_session', 'readwrite');
    const store = tx.objectStore('active_session');
    store.put({ id: 'CURRENT_ACTIVE', session });
  } catch (err) {
    // Fallback to localStorage
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('medtrix_active_session', JSON.stringify(session));
      } catch (e) {
        console.warn('LocalStorage quota exceeded', e);
      }
    }
  }
}

/**
 * Load active case session
 */
export async function loadActiveSession(): Promise<CaseSession | null> {
  try {
    const db = await openDatabase();
    const tx = db.transaction('active_session', 'readonly');
    const store = tx.objectStore('active_session');
    const req = store.get('CURRENT_ACTIVE');

    return new Promise((resolve) => {
      req.onsuccess = () => {
        if (req.result && req.result.session) {
          resolve(req.result.session as CaseSession);
        } else {
          resolve(loadActiveSessionFromLocalStorage());
        }
      };
      req.onerror = () => resolve(loadActiveSessionFromLocalStorage());
    });
  } catch (err) {
    return loadActiveSessionFromLocalStorage();
  }
}

function loadActiveSessionFromLocalStorage(): CaseSession | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem('medtrix_active_session');
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (session && session.id && session.turns) return session;
  } catch (e) {
    console.warn('Failed to parse active session from localStorage');
  }
  return null;
}

/**
 * Save QBank index
 */
export async function saveQBankIndex(index: PYQItem[]): Promise<void> {
  try {
    const db = await openDatabase();
    const tx = db.transaction('qbank_index', 'readwrite');
    const store = tx.objectStore('qbank_index');
    store.clear();
    index.forEach((item) => store.put(item));
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Failed to save QBank index to IndexedDB, attempting fallback:', err);
    if (typeof localStorage !== 'undefined') {
      try {
        // Save only a sample/slice to localStorage to prevent QuotaExceededError
        localStorage.setItem('medtrix_pyq_index_sample', JSON.stringify(index.slice(0, 50)));
      } catch (e) {
        console.warn('LocalStorage quota exceeded saving sample qbank');
      }
    }
  }
}

/**
 * Load QBank index
 */
export async function loadQBankIndex(): Promise<PYQItem[]> {
  try {
    const db = await openDatabase();
    const tx = db.transaction('qbank_index', 'readonly');
    const store = tx.objectStore('qbank_index');
    const req = store.getAll();

    return new Promise((resolve) => {
      req.onsuccess = () => {
        if (req.result && req.result.length > 0) {
          resolve(req.result as PYQItem[]);
        } else {
          resolve(loadQBankFromLocalStorage());
        }
      };
      req.onerror = () => resolve(loadQBankFromLocalStorage());
    });
  } catch (err) {
    return loadQBankFromLocalStorage();
  }
}

function loadQBankFromLocalStorage(): PYQItem[] {
  if (typeof localStorage === 'undefined') return DEFAULT_PYQ_INDEX;
  try {
    const raw = localStorage.getItem('medtrix_pyq_index');
    if (!raw) return DEFAULT_PYQ_INDEX;
    const items = JSON.parse(raw);
    if (Array.isArray(items) && items.length > 0) return items;
  } catch (e) {
    console.warn('Failed to parse QBank from localStorage');
  }
  return DEFAULT_PYQ_INDEX;
}

/**
 * Save completed case to history
 */
export async function saveCompletedCase(session: CaseSession): Promise<void> {
  try {
    const db = await openDatabase();
    const tx = db.transaction('case_history', 'readwrite');
    const store = tx.objectStore('case_history');
    store.put(session);
  } catch (err) {
    if (typeof localStorage !== 'undefined') {
      try {
        const historyRaw = localStorage.getItem('medtrix_case_history') || '[]';
        const history: CaseSession[] = JSON.parse(historyRaw);
        history.push(session);
        localStorage.setItem('medtrix_case_history', JSON.stringify(history.slice(-20))); // Keep last 20
      } catch (e) {
        console.warn('Failed to save completed case to localStorage', e);
      }
    }
  }
}

/**
 * Load case history
 */
export async function loadCaseHistory(): Promise<CaseSession[]> {
  try {
    const db = await openDatabase();
    const tx = db.transaction('case_history', 'readonly');
    const store = tx.objectStore('case_history');
    const req = store.getAll();

    return new Promise((resolve) => {
      req.onsuccess = () => {
        resolve((req.result || []) as CaseSession[]);
      };
      req.onerror = () => resolve(loadHistoryFromLocalStorage());
    });
  } catch (err) {
    return loadHistoryFromLocalStorage();
  }
}

function loadHistoryFromLocalStorage(): CaseSession[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem('medtrix_case_history');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  return [];
}

/**
 * Returns QIDs of questions missed in previous completed cases
 */
export async function getMissedQIDsFromHistory(): Promise<string[]> {
  const history = await loadCaseHistory();
  const missedQIDs = new Set<string>();

  history.forEach((session) => {
    if (session.decisionGates) {
      session.decisionGates.forEach((gate) => {
        if (gate.isCorrect === false && gate.pyq && gate.pyq.qid) {
          missedQIDs.add(gate.pyq.qid);
        }
      });
    }
  });

  return Array.from(missedQIDs);
}

/**
 * Export full user profile data (QBank index + Case History) as JSON
 */
export async function exportProfileJSON(): Promise<string> {
  const index = await loadQBankIndex();
  const history = await loadCaseHistory();

  const exportData = {
    version: '1.0',
    app: 'PYQ CCS Simulator',
    exportDate: new Date().toISOString(),
    qbankIndex: index,
    caseHistory: history,
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Import full user profile data from JSON
 */
export async function importProfileJSON(
  jsonStr: string
): Promise<{ indexCount: number; historyCount: number }> {
  const parsed = JSON.parse(jsonStr);

  let qbankItems: PYQItem[] = [];
  let historyItems: CaseSession[] = [];

  if (parsed.qbankIndex && Array.isArray(parsed.qbankIndex)) {
    qbankItems = parsed.qbankIndex;
  } else if (Array.isArray(parsed)) {
    qbankItems = parsed;
  }

  if (parsed.caseHistory && Array.isArray(parsed.caseHistory)) {
    historyItems = parsed.caseHistory;
  }

  if (qbankItems.length > 0) {
    await saveQBankIndex(qbankItems);
  }

  if (historyItems.length > 0) {
    for (const item of historyItems) {
      await saveCompletedCase(item);
    }
  }

  return {
    indexCount: qbankItems.length,
    historyCount: historyItems.length,
  };
}
