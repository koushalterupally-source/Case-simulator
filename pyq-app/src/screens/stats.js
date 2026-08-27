/**
 * Stats screen — aggregate progress across both modes, per-subject accuracy, test history, and
 * a JSON export/import of everything this device has saved.
 *
 * "Total answered" and "overall accuracy" combine Grand Test results (`results` store, which
 * already carries attempted/correct per sitting) with practice attempts (the `attempts` store,
 * written per-question by practice-screen.js) — divide-by-zero guarded throughout, since a fresh
 * install or an all-skipped history must read 0%, never NaN%.
 */

import * as store from '../store.js';
import * as ui from '../ui.js';
import { el, clear, pct } from '../dom.js';

const KNOWN_STORES = {
  sessions: 'id',
  results: 'sessionId',
  attempts: 'id',
  bookmarks: 'questionId',
  mistakes: 'questionId',
  meta: 'key',
};

let root = null;

export async function show(rootEl) {
  root = rootEl;
  clear(root);
  setTitle('Stats');
  root.appendChild(el('div', { class: 'spinner' }));
  await render();
}

function setTitle(text) {
  const t = document.getElementById('appbar-title');
  if (t) t.textContent = text;
}

async function safeGetAll(name) {
  try {
    return await store.getAll(name);
  } catch (err) {
    console.warn(`stats: could not read store "${name}"`, err);
    return [];
  }
}

async function render() {
  clear(root);
  const [results, attempts, mistakes] = await Promise.all([
    safeGetAll('results'),
    safeGetAll('attempts'),
    safeGetAll('mistakes'),
  ]);

  const gtAttempted = results.reduce((sum, r) => sum + (r.attempted || 0), 0);
  const gtCorrect = results.reduce((sum, r) => sum + (r.correct || 0), 0);
  const prAttempted = attempts.length;
  const prCorrect = attempts.filter((a) => a && a.isCorrect).length;

  const totalAttempted = gtAttempted + prAttempted;
  const totalCorrect = gtCorrect + prCorrect;
  const accuracy = totalAttempted > 0 ? totalCorrect / totalAttempted : 0;

  root.appendChild(
    el('div', { class: 'screen' }, [
      el('div', { class: 'stats' }, [
        stat(totalAttempted, 'Answered'),
        stat(pct(accuracy), 'Accuracy'),
        stat(results.length, 'Tests taken'),
        stat(mistakes.length, 'Mistakes'),
      ]),
      subjectSection(attempts, results),
      resultsSection(results),
      exportImportSection(),
    ])
  );
}

function stat(value, label) {
  return el('div', { class: 'stat' }, [
    el('div', { class: 'stat__value', text: String(value) }),
    el('div', { class: 'stat__label', text: label }),
  ]);
}

/* -------------------------------------------------------------------- subject accuracy bars */

function subjectSection(attempts, results) {
  const map = new Map();
  const bump = (subject, isCorrect) => {
    if (!subject) return; // unclassified is excluded from the breakdown, not guessed at
    if (!map.has(subject)) map.set(subject, { subject, correct: 0, attempted: 0 });
    const b = map.get(subject);
    b.attempted++;
    if (isCorrect) b.correct++;
  };

  for (const a of attempts) bump(a.subject, a.isCorrect);
  for (const r of results) {
    for (const row of r.questions || []) {
      if (row.chosen === null || row.chosen === undefined) continue; // skipped, not attempted
      bump(row.subject, row.isCorrect);
    }
  }

  const nodes = [el('div', { class: 'section-title', text: 'Accuracy by subject' })];

  if (map.size === 0) {
    nodes.push(el('div', { class: 'empty' }, [
      el('span', { class: 'empty__icon', text: '📊' }),
      el('p', { text: 'Answer some questions to see a subject breakdown here.' }),
    ]));
    return el('section', {}, nodes);
  }

  const subjects = [...map.values()]
    .map((b) => ({ ...b, accuracy: b.attempted > 0 ? b.correct / b.attempted : 0 }))
    .sort((a, b) => b.attempted - a.attempted);

  nodes.push(
    el(
      'div',
      { class: 'bars' },
      subjects.map((s) => {
        const tone = s.accuracy >= 0.7 ? 'var(--green)' : s.accuracy >= 0.45 ? 'var(--amber)' : 'var(--red)';
        return el('div', {}, [
          el('div', { class: 'bar__head' }, [
            el('span', { class: 'bar__name', text: s.subject }),
            el('span', { class: 'bar__val', text: `${s.correct}/${s.attempted} · ${pct(s.accuracy)}` }),
          ]),
          el('div', { class: 'bar__track' }, [
            el('div', { class: 'bar__fill', style: { width: pct(s.accuracy), background: tone } }),
          ]),
        ]);
      })
    )
  );

  return el('section', {}, nodes);
}

/* ------------------------------------------------------------------------------ test history */

function resultsSection(results) {
  const nodes = [el('div', { class: 'section-title', text: 'Test history' })];

  if (results.length === 0) {
    nodes.push(el('div', { class: 'empty' }, [
      el('span', { class: 'empty__icon', text: '📝' }),
      el('p', { text: 'No Grand Tests submitted yet.' }),
    ]));
    return el('section', {}, nodes);
  }

  const sorted = results.slice().sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0));
  nodes.push(el('div', { class: 'list' }, sorted.map(resultRow)));
  return el('section', {}, nodes);
}

function resultRow(r) {
  const when = r.submittedAt ? new Date(r.submittedAt).toLocaleDateString() : 'undated';
  return el(
    'button',
    { class: 'row', type: 'button', onclick: () => ui.navigate('analysis', { sessionId: r.sessionId }) },
    [
      el('div', { class: 'row__main' }, [
        el('div', { class: 'row__title', text: r.paperName || 'Untitled paper' }),
        el('div', { class: 'row__meta', text: `${when} · ${pct(r.accuracy || 0)} accuracy` }),
      ]),
      el('span', { class: 'row__count', text: `${r.score ?? 0}/${r.maxScore ?? 0}` }),
    ]
  );
}

/* ------------------------------------------------------------------------- export / import */

function exportImportSection() {
  const fileInput = el('input', {
    type: 'file',
    accept: 'application/json,.json',
    style: { display: 'none' },
    onchange: (e) => {
      const file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (file) importData(file);
    },
  });

  return el('section', {}, [
    el('div', { class: 'section-title', text: 'Backup' }),
    el('p', {
      style: { fontSize: '0.85rem', color: 'var(--subtext)', marginBottom: '14px' },
      text: 'Export everything saved on this device, or replace it from a previous backup.',
    }),
    el('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap' } }, [
      el('button', { class: 'btn btn--primary', type: 'button', text: 'Export backup', onclick: exportData }),
      el('button', { class: 'btn btn--ghost', type: 'button', text: 'Import backup', onclick: () => fileInput.click() }),
      fileInput,
    ]),
  ]);
}

async function exportData() {
  ui.setBusy(true);
  try {
    const payload = { version: 1, exportedAt: new Date().toISOString(), stores: {} };
    for (const name of Object.keys(KNOWN_STORES)) {
      payload.stores[name] = await store.getAll(name);
    }
    const json = JSON.stringify(payload, null, 2);
    const filename = `pyq-backup-${new Date().toISOString().slice(0, 10)}.json`;

    // Best-effort file download. An <a download> can be inert in some Android WebViews with no
    // way to detect that from script — click() never throws even when nothing happens — so this
    // is attempted but never trusted as the confirmed outcome.
    try {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (err) {
      console.warn('stats: download attempt failed', err);
    }

    let copied = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(json);
        copied = true;
      }
    } catch (err) {
      copied = false;
    }

    if (copied) {
      ui.toast('Backup copied to clipboard. A file download was also attempted — check your Downloads if your browser supports it.');
    } else {
      ui.toast('A download was attempted, but the clipboard is unavailable here — check your Downloads, or try a different browser.');
    }
  } catch (err) {
    console.error('stats: export failed', err);
    ui.toast('Export failed — your data on this device is unaffected.');
  } finally {
    ui.setBusy(false);
  }
}

function validatePayload(payload) {
  if (!payload || typeof payload !== 'object') return 'Not a valid backup file (expected a JSON object).';
  if (!payload.stores || typeof payload.stores !== 'object') return 'Missing a "stores" section.';
  for (const [name, records] of Object.entries(payload.stores)) {
    if (!(name in KNOWN_STORES)) return `Unknown store "${name}" in backup file.`;
    if (!Array.isArray(records)) return `Store "${name}" is not a list of records.`;
    const keyPath = KNOWN_STORES[name];
    for (const rec of records) {
      if (!rec || typeof rec !== 'object' || !(keyPath in rec)) {
        return `A record in "${name}" is missing its "${keyPath}" field.`;
      }
    }
  }
  return null;
}

async function importData(file) {
  let text;
  try {
    text = await file.text();
  } catch (err) {
    ui.toast('Could not read that file.');
    return;
  }

  let payload;
  try {
    payload = JSON.parse(text);
  } catch (err) {
    ui.toast('That file is not valid JSON.');
    return;
  }

  const problem = validatePayload(payload);
  if (problem) {
    ui.toast(`Import refused: ${problem}`);
    return;
  }

  const storeNames = Object.keys(payload.stores);
  const ok = await ui.confirmDialog({
    title: 'Replace all local data?',
    body: `This replaces everything currently saved on this device (${storeNames.join(', ')}) with the contents of this backup. This cannot be undone.`,
    confirmLabel: 'Replace',
    cancelLabel: 'Cancel',
  });
  if (!ok) return;

  ui.setBusy(true);
  try {
    for (const name of storeNames) {
      await store.clear(name);
      const records = payload.stores[name];
      if (records.length > 0) await store.bulkPut(name, records);
    }
    ui.toast('Import complete.');
    await render();
  } catch (err) {
    console.error('stats: import failed partway', err);
    ui.toast('Import failed partway through — your data may be inconsistent. Consider re-importing.');
  } finally {
    ui.setBusy(false);
  }
}
