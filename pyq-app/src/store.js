// store.js — the ONLY module allowed to talk to IndexedDB.
//
// Every exported operation is promise-based and NEVER throws synchronously: any failure
// (private browsing throwing on `indexedDB.open`, quota exceeded, a corrupted database, the API
// being entirely absent) surfaces as a rejected promise carrying a `StoreError`, so a caller can
// `.catch()` and degrade instead of the app white-screening on an uncaught exception.
//
// `isAvailable()` is a cheap synchronous probe the app can check before relying on persistence
// at all. `createMemoryStore()` returns an object with the exact same method names/signatures,
// backed by plain in-memory Maps, for use when IndexedDB is unavailable or has failed — e.g.:
//
//   const db = isAvailable() ? { open, put, get, getAll, getAllByIndex, del, clear, bulkPut }
//                             : createMemoryStore();
//
// This module owns persistence only. It must never touch the DOM.

const DB_NAME = 'PyqAppDB';
// v2 adds `srs` (spaced-repetition card state, see srs.js) and `ankiProgress`. The upgrade loop
// below creates whatever is missing without touching existing stores, so the bump is additive.
const DB_VERSION = 2;

const STORE_SCHEMA = {
  sessions: { keyPath: 'id', indexes: [] },
  // Scored Grand Test papers. Keyed by the session that produced them, and indexed by paper so the
  // analysis screen can compare a sitting against earlier attempts at the same paper.
  results: { keyPath: 'sessionId', indexes: [{ name: 'paperId', keyPath: 'paperId' }] },
  attempts: {
    keyPath: 'id',
    indexes: [
      { name: 'paperId', keyPath: 'paperId' },
      { name: 'questionId', keyPath: 'questionId' },
    ],
  },
  bookmarks: { keyPath: 'questionId', indexes: [] },
  mistakes: { keyPath: 'questionId', indexes: [{ name: 'subject', keyPath: 'subject' }] },
  // Spaced-repetition card state. Indexed on `due` so a due count can be read without pulling
  // every card into memory.
  srs: { keyPath: 'questionId', indexes: [{ name: 'due', keyPath: 'due' }] },
  // The Anki screen's review counter. It was already being read and written before this store
  // existed, which meant every access rejected with "unknown object store" straight into a
  // swallowing catch — the count looked like it saved and never did.
  ankiProgress: { keyPath: 'id', indexes: [] },
  meta: { keyPath: 'key', indexes: [] },
};

/** Typed error for every store failure — always carries the failing `op` and, where known, `cause`. */
export class StoreError extends Error {
  constructor(message, op, cause) {
    super(op ? `${message} (op: ${op})` : message);
    this.name = 'StoreError';
    this.op = op;
    if (cause !== undefined) this.cause = cause;
  }
}

/** Synchronous probe: is IndexedDB usable in this environment at all? Never throws. */
export function isAvailable() {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    // Some browsers throw merely accessing `indexedDB` in certain private-browsing modes.
    return false;
  }
}

let dbPromise = null;

function openInternal() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (!isAvailable()) {
      dbPromise = null;
      reject(new StoreError('IndexedDB is not available in this environment', 'open'));
      return;
    }

    let req;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (err) {
      dbPromise = null;
      reject(new StoreError('indexedDB.open threw synchronously', 'open', err));
      return;
    }

    req.onupgradeneeded = (event) => {
      const db = req.result;
      const tx = event.target.transaction;
      for (const [storeName, schema] of Object.entries(STORE_SCHEMA)) {
        const os = db.objectStoreNames.contains(storeName)
          ? tx.objectStore(storeName)
          : db.createObjectStore(storeName, { keyPath: schema.keyPath });
        for (const idx of schema.indexes) {
          if (!os.indexNames.contains(idx.name)) {
            os.createIndex(idx.name, idx.keyPath, { unique: false });
          }
        }
      }
    };

    req.onsuccess = () => {
      const db = req.result;
      // If another tab/version bumps the schema, drop our handle rather than hold a stale one
      // open forever; the next call to open() will re-establish a fresh connection.
      db.onversionchange = () => {
        try {
          db.close();
        } catch {
          /* already closed */
        }
        dbPromise = null;
      };
      resolve(db);
    };

    req.onerror = () => {
      dbPromise = null;
      reject(new StoreError('indexedDB.open failed', 'open', req.error));
    };
  });

  return dbPromise;
}

/** Open (or reuse) the shared database connection. Rejects with `StoreError`, never throws. */
export function open() {
  return openInternal();
}

function withStore(storeName, mode, fn) {
  if (!STORE_SCHEMA[storeName]) {
    return Promise.reject(new StoreError(`unknown object store "${storeName}"`, mode));
  }
  return openInternal()
    .then(
      (db) =>
        new Promise((resolve, reject) => {
          let tx;
          try {
            tx = db.transaction(storeName, mode);
          } catch (err) {
            reject(new StoreError('failed to open transaction', mode, err));
            return;
          }

          let settled = false;
          let result;
          const setResult = (value) => {
            result = value;
          };

          tx.oncomplete = () => {
            if (!settled) {
              settled = true;
              resolve(result);
            }
          };
          tx.onerror = () => {
            if (!settled) {
              settled = true;
              reject(new StoreError('transaction failed', mode, tx.error));
            }
          };
          tx.onabort = () => {
            if (!settled) {
              settled = true;
              reject(new StoreError('transaction aborted', mode, tx.error));
            }
          };

          try {
            const store = tx.objectStore(storeName);
            fn(store, setResult);
          } catch (err) {
            if (!settled) {
              settled = true;
              reject(new StoreError('operation threw synchronously', mode, err));
            }
            try {
              tx.abort();
            } catch {
              /* transaction may already be finishing */
            }
          }
        })
    )
    .catch((err) => {
      throw err instanceof StoreError ? err : new StoreError('store operation failed', mode, err);
    });
}

/** Insert or update `value` (keyed by the store's keyPath). Resolves with the key. */
export function put(storeName, value) {
  return withStore(storeName, 'readwrite', (store, setResult) => {
    const req = store.put(value);
    req.onsuccess = () => setResult(req.result);
  });
}

/** Fetch one record by key. Resolves with `undefined` if not found (not an error). */
export function get(storeName, key) {
  return withStore(storeName, 'readonly', (store, setResult) => {
    const req = store.get(key);
    req.onsuccess = () => setResult(req.result);
  });
}

/** Fetch every record in a store. Resolves with `[]` if empty. */
export function getAll(storeName) {
  return withStore(storeName, 'readonly', (store, setResult) => {
    const req = store.getAll();
    req.onsuccess = () => setResult(req.result || []);
  });
}

/** Fetch every record whose indexed field equals `value`. Resolves with `[]` if none match. */
export function getAllByIndex(storeName, indexName, value) {
  return withStore(storeName, 'readonly', (store, setResult) => {
    const idx = store.index(indexName); // throws synchronously if unknown; caught by withStore
    const req = idx.getAll(value);
    req.onsuccess = () => setResult(req.result || []);
  });
}

/** Delete one record by key. Resolves with `undefined` whether or not it existed. */
export function del(storeName, key) {
  return withStore(storeName, 'readwrite', (store, setResult) => {
    const req = store.delete(key);
    req.onsuccess = () => setResult(undefined);
  });
}

/** Remove every record from a store. */
export function clear(storeName) {
  return withStore(storeName, 'readwrite', (store, setResult) => {
    const req = store.clear();
    req.onsuccess = () => setResult(undefined);
  });
}

/** Insert/update many records in a single transaction. */
export function bulkPut(storeName, values) {
  return withStore(storeName, 'readwrite', (store, setResult) => {
    for (const value of values) store.put(value);
    setResult(undefined);
  });
}

function toStoreError(err, op) {
  return err instanceof StoreError ? err : new StoreError('memory store operation failed', op, err);
}

function cloneValue(value) {
  if (value === undefined) return undefined;
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value);
    } catch {
      /* fall through to JSON clone below (e.g. value isn't structured-clonable) */
    }
  }
  return JSON.parse(JSON.stringify(value));
}

/**
 * An in-memory store with the exact same method names/signatures as the module-level IndexedDB
 * API above (including `open`/`isAvailable`, both no-ops here), for use when IndexedDB is
 * unavailable or has failed to open. Data does not persist across a reload — it exists purely so
 * the app has somewhere to write during a session instead of failing every storage call.
 */
export function createMemoryStore() {
  const data = {};
  for (const name of Object.keys(STORE_SCHEMA)) data[name] = new Map();

  function storeMap(storeName, op) {
    const map = data[storeName];
    if (!map) throw new StoreError(`unknown object store "${storeName}"`, op);
    return map;
  }

  function keyOf(storeName, value) {
    return value ? value[STORE_SCHEMA[storeName].keyPath] : undefined;
  }

  return {
    open() {
      return Promise.resolve(null);
    },
    isAvailable() {
      return true;
    },
    put(storeName, value) {
      return new Promise((resolve, reject) => {
        try {
          const map = storeMap(storeName, 'put');
          const key = keyOf(storeName, value);
          if (key === undefined) {
            throw new StoreError(
              `value missing keyPath "${STORE_SCHEMA[storeName].keyPath}"`,
              'put'
            );
          }
          map.set(key, cloneValue(value));
          resolve(key);
        } catch (err) {
          reject(toStoreError(err, 'put'));
        }
      });
    },
    get(storeName, key) {
      return new Promise((resolve, reject) => {
        try {
          const map = storeMap(storeName, 'get');
          resolve(cloneValue(map.get(key)));
        } catch (err) {
          reject(toStoreError(err, 'get'));
        }
      });
    },
    getAll(storeName) {
      return new Promise((resolve, reject) => {
        try {
          const map = storeMap(storeName, 'getAll');
          resolve(Array.from(map.values()).map(cloneValue));
        } catch (err) {
          reject(toStoreError(err, 'getAll'));
        }
      });
    },
    getAllByIndex(storeName, indexName, value) {
      return new Promise((resolve, reject) => {
        try {
          const map = storeMap(storeName, 'getAllByIndex');
          const idx = STORE_SCHEMA[storeName].indexes.find((i) => i.name === indexName);
          if (!idx) {
            throw new StoreError(
              `unknown index "${indexName}" on store "${storeName}"`,
              'getAllByIndex'
            );
          }
          const out = [];
          for (const v of map.values()) {
            if (v && v[idx.keyPath] === value) out.push(cloneValue(v));
          }
          resolve(out);
        } catch (err) {
          reject(toStoreError(err, 'getAllByIndex'));
        }
      });
    },
    del(storeName, key) {
      return new Promise((resolve, reject) => {
        try {
          const map = storeMap(storeName, 'del');
          map.delete(key);
          resolve(undefined);
        } catch (err) {
          reject(toStoreError(err, 'del'));
        }
      });
    },
    clear(storeName) {
      return new Promise((resolve, reject) => {
        try {
          const map = storeMap(storeName, 'clear');
          map.clear();
          resolve(undefined);
        } catch (err) {
          reject(toStoreError(err, 'clear'));
        }
      });
    },
    bulkPut(storeName, values) {
      return new Promise((resolve, reject) => {
        try {
          const map = storeMap(storeName, 'bulkPut');
          for (const value of values) {
            const key = keyOf(storeName, value);
            if (key === undefined) {
              throw new StoreError(
                `value missing keyPath "${STORE_SCHEMA[storeName].keyPath}"`,
                'bulkPut'
              );
            }
            map.set(key, cloneValue(value));
          }
          resolve(undefined);
        } catch (err) {
          reject(toStoreError(err, 'bulkPut'));
        }
      });
    },
  };
}
