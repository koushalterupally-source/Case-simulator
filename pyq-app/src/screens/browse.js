/**
 * Browse screens: practice source/subject picker, a subject's groups, and the test-paper picker.
 *
 * Three screens, one file, because they share the catalog and the same row/list vocabulary.
 *
 * Routing: `showSubject` row taps navigate to the router's 'group' screen (wired to
 * practice-screen.js's `start`), and the Grand Test sheet's Start button navigates to 'gt' — both
 * names and both params shapes match app.js's routeTo exactly (params.scheme must be a JSON
 * string, since the router does `JSON.parse(params.scheme)`).
 */

import * as data from '../data.js';
import * as store from '../store.js';
import * as ui from '../ui.js';
import * as GT from '../gt.js';
import { el, clear } from '../dom.js';

/* --------------------------------------------------------------------- shared small helpers */

function setTitle(text) {
  const t = document.getElementById('appbar-title');
  if (t) t.textContent = text;
}

function emptyState(icon, text) {
  return el('div', { class: 'empty' }, [el('span', { class: 'empty__icon', text: icon }), el('p', { text })]);
}

async function safeLoadCatalog(root, onFail) {
  try {
    return await data.loadCatalog();
  } catch (err) {
    console.warn('browse: could not load catalog', err);
    clear(root).appendChild(emptyState('⚠️', 'Could not load the question bank. Check storage and try again.'));
    if (onFail) onFail();
    return null;
  }
}

/* ------------------------------------------------------------------------- Practice: sources */

let selectedSourceFilter = 'ALL';
let selectedSubjectQuery = '';

export async function showPractice(root, params = {}) {
  clear(root);
  setTitle('Practice');

  if (params && params.source) {
    selectedSourceFilter = params.source.toUpperCase();
  }

  const catalog = await safeLoadCatalog(root);
  if (!catalog) return;

  const entries = catalog.practice || [];
  if (entries.length === 0) {
    root.appendChild(emptyState('📚', 'No practice banks are available yet.'));
    return;
  }

  function renderView() {
    clear(root);
    setTitle('Practice');

    const container = el('div', { class: 'screen' });

    // 1. Source Navigation Tabs (All / PYQ / CEREB / ARROW)
    const sourceTabs = el('div', { class: 'segmented-tabs' }, [
      sourceTabBtn('ALL', 'All QBank', selectedSourceFilter === 'ALL'),
      sourceTabBtn('PYQ', '🎯 PYQ Papers', selectedSourceFilter === 'PYQ'),
      sourceTabBtn('CEREB', '🧠 CEREB Topics', selectedSourceFilter === 'CEREB'),
      sourceTabBtn('ARROW', '🏹 ARROW High-Yield', selectedSourceFilter === 'ARROW'),
    ]);
    container.appendChild(sourceTabs);

    // 2. ARROW High-Yield Banner (if ARROW selected)
    if (selectedSourceFilter === 'ARROW') {
      container.appendChild(arrowBanner(entries));
    }

    // 3. Subject Filter Chips
    const uniqueSubjects = Array.from(new Set(entries.map((e) => e.subject).filter(Boolean))).sort();
    const filterPills = el('div', { class: 'filter-pills' }, [
      subjectChip('All Subjects', selectedSubjectQuery === '', () => {
        selectedSubjectQuery = '';
        renderView();
      }),
      ...uniqueSubjects.map((sub) =>
        subjectChip(sub, selectedSubjectQuery === sub, () => {
          selectedSubjectQuery = selectedSubjectQuery === sub ? '' : sub;
          renderView();
        })
      ),
    ]);
    container.appendChild(filterPills);

    // 4. Filter entries based on active filters
    let filtered = entries;
    if (selectedSourceFilter === 'PYQ') {
      filtered = filtered.filter((e) => e.source === 'PYQ');
    } else if (selectedSourceFilter === 'CEREB') {
      filtered = filtered.filter((e) => e.source === 'CEREB');
    } else if (selectedSourceFilter === 'ARROW') {
      // For ARROW high yield, present both PYQ & Cereb prioritized by question density
      filtered = [...filtered].sort((a, b) => (b.total || 0) - (a.total || 0));
    }

    if (selectedSubjectQuery) {
      filtered = filtered.filter((e) => e.subject === selectedSubjectQuery);
    }

    if (filtered.length === 0) {
      container.appendChild(emptyState('🔍', 'No question banks match the selected filters.'));
      root.appendChild(container);
      return;
    }

    const bySource = new Map();
    for (const entry of filtered) {
      const key = selectedSourceFilter === 'ARROW' ? 'ARROW' : (entry.source || 'Other');
      if (!bySource.has(key)) bySource.set(key, []);
      bySource.get(key).push(entry);
    }

    for (const [source, subjects] of bySource) {
      container.appendChild(el('div', { class: 'section-title', text: sourceLabel(source) }));
      container.appendChild(
        el(
          'div',
          { class: 'list' },
          subjects.map((s) => subjectRow(s))
        )
      );
    }

    root.appendChild(container);
  }

  function sourceTabBtn(key, label, isActive) {
    return el(
      'button',
      {
        class: `segmented-tab ${isActive ? 'segmented-tab--active' : ''}`,
        type: 'button',
        onclick: () => {
          selectedSourceFilter = key;
          renderView();
        },
      },
      [el('span', { text: label })]
    );
  }

  function subjectChip(label, isActive, onClick) {
    return el(
      'button',
      {
        class: `filter-pill ${isActive ? 'filter-pill--active' : ''}`,
        type: 'button',
        onclick: onClick,
      },
      [el('span', { text: label })]
    );
  }

  function arrowBanner(allEntries) {
    const totalQ = allEntries.reduce((sum, e) => sum + (e.total || 0), 0);
    return el('div', { class: 'arrow-banner' }, [
      el('div', { class: 'arrow-banner__badge', text: '⚡ RAPID REVISION MODE' }),
      el('div', { class: 'arrow-banner__title', text: 'ARROW High-Yield Question Sets' }),
      el('div', {
        class: 'arrow-banner__desc',
        text: `Targeted clinical recall across ${allEntries.length} subject modules (${totalQ.toLocaleString()} questions). Select a high-yield subject below to begin rapid practice.`,
      }),
    ]);
  }

  renderView();
}

function sourceLabel(source) {
  if (source === 'PYQ') return 'PYQ — Previous-Year Exam Papers';
  if (source === 'CEREB') return 'CEREB — Topic-Wise Question Banks';
  if (source === 'ARROW') return 'ARROW — Rapid High-Yield Practice Banks';
  return source;
}

function subjectRow(entry) {
  const { plural } = groupWords(entry.source);
  return el(
    'button',
    { class: 'row', type: 'button', onclick: () => ui.navigate('subject', { slug: entry.slug }) },
    [
      el('div', { class: 'row__main' }, [
        el('div', { class: 'row__title', text: entry.subject || 'Unclassified' }),
        el('div', { class: 'row__meta', text: `${(entry.groups || []).length} ${plural} · ${entry.source || 'QBank'}` }),
      ]),
      el('span', { class: 'row__count', text: String(entry.total) }),
    ]
  );
}

/** PYQ browses by exam session ("AIIMS 2017"); CEREB browses by topic ("Head, Neck and Face").
 * One flat "group" word for both would flatten a real distinction the workflow doc calls out. */
function groupWords(source) {
  return source === 'CEREB'
    ? { singular: 'Topic', plural: 'topics' }
    : { singular: 'Exam session', plural: 'exam sessions' };
}

/* -------------------------------------------------------------------- Practice: one subject */

export async function showSubject(root, { slug }) {
  clear(root);

  const catalog = await safeLoadCatalog(root);
  if (!catalog) return;

  const subject = (catalog.practice || []).find((s) => s.slug === slug);
  if (!subject) {
    root.appendChild(emptyState('🔍', 'That subject could not be found — it may have moved.'));
    return;
  }

  setTitle(subject.subject || 'Practice');
  const { singular } = groupWords(subject.source);
  const groups = subject.groups || [];

  if (groups.length === 0) {
    root.appendChild(emptyState('📭', 'No groups in this subject yet.'));
    return;
  }

  root.appendChild(
    el('div', { class: 'screen' }, [
      el('div', {
        class: 'section-title',
        text: `${sourceLabel(subject.source)} · ${subject.total} question${subject.total === 1 ? '' : 's'}`,
      }),
      el(
        'div',
        { class: 'list' },
        groups.map((g) => groupRow(g, singular, slug))
      ),
    ])
  );
}

function groupRow(group, label, slug) {
  return el(
    'button',
    {
      class: 'row',
      type: 'button',
      onclick: () => ui.navigate('group', { slug, groupName: group.name }),
    },
    [
      el('div', { class: 'row__main' }, [
        el('div', { class: 'row__title', text: group.name }),
        el('div', { class: 'row__meta', text: label }),
      ]),
      el('span', { class: 'row__count', text: String(group.count) }),
    ]
  );
}

/* ------------------------------------------------------------------------------------- Tests */

export async function showTests(root) {
  clear(root);
  setTitle('Grand Tests');

  const catalog = await safeLoadCatalog(root);
  if (!catalog) return;

  const papers = (catalog.papers || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  if (papers.length === 0) {
    root.appendChild(emptyState('🎯', 'No test papers are available yet.'));
    return;
  }

  let doneIds = new Set();
  try {
    const results = await store.getAll('results');
    doneIds = new Set(results.map((r) => r.paperId));
  } catch (err) {
    console.warn('browse: could not read results for done-chip', err);
  }

  root.appendChild(
    el('div', { class: 'screen' }, [
      el('div', { class: 'list' }, papers.map((p) => paperRow(p, doneIds.has(p.id)))),
    ])
  );
}

function paperRow(paper, done) {
  return el(
    'button',
    { class: 'row', type: 'button', onclick: () => openTestSheet(paper) },
    [
      el('div', { class: 'row__main' }, [
        el('div', { class: 'row__title', text: paper.name }),
        el('div', { class: 'row__meta', text: `${paper.date || 'undated'} · ${paper.count} questions` }),
      ]),
      el('div', { style: { display: 'flex', gap: '6px', alignItems: 'center', flexShrink: '0' } }, [
        el('span', {
          class: paper.kind === 'quiz' ? 'chip chip--quiz' : 'chip',
          text: paper.kind === 'quiz' ? 'Quiz' : 'Grand Test',
        }),
        done ? el('span', { class: 'chip chip--done', text: 'Done' }) : null,
      ]),
    ]
  );
}

async function openTestSheet(paper) {
  let needsImageCount = 0;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    ui.setBusy(true);
    try {
      const questions = await data.loadQuestions(paper.shards);
      needsImageCount = questions.filter((q) => q.needsImage === true).length;
    } catch (err) {
      // Can't verify offline-image risk right now — proceed without the warning rather than
      // blocking the sheet entirely.
      console.warn('browse: could not check needsImage for offline warning', err);
    } finally {
      ui.setBusy(false);
    }
  }
  showSheet(buildTestSheet(paper, needsImageCount));
}

function buildTestSheet(paper, needsImageCount) {
  let durationMin = Math.round(GT.defaultDurationMs(paper.count) / 60000);
  let schemeKey = 'default';

  const durationField = el('input', {
    type: 'number',
    min: '5',
    step: '5',
    inputmode: 'numeric',
    value: String(durationMin),
    'aria-label': 'Duration in minutes',
    style: {
      width: '96px',
      textAlign: 'center',
      padding: '10px',
      border: '1.5px solid var(--hairline)',
      borderRadius: 'var(--radius-sm)',
      background: 'var(--glass-solid)',
      color: 'var(--text)',
    },
    oninput: (e) => {
      const v = parseInt(e.target.value, 10);
      if (!Number.isNaN(v) && v > 0) durationMin = v;
    },
  });

  const optDefault = el('button', { class: 'filter', type: 'button', text: '+1 / 0', 'aria-pressed': 'true' });
  const optNeg = el('button', { class: 'filter', type: 'button', text: '+4 / −1', 'aria-pressed': 'false' });
  optDefault.addEventListener('click', () => {
    schemeKey = 'default';
    optDefault.setAttribute('aria-pressed', 'true');
    optNeg.setAttribute('aria-pressed', 'false');
  });
  optNeg.addEventListener('click', () => {
    schemeKey = 'negative';
    optNeg.setAttribute('aria-pressed', 'true');
    optDefault.setAttribute('aria-pressed', 'false');
  });

  const warn =
    needsImageCount > 0
      ? el('p', {
          style: {
            fontSize: '0.84rem',
            color: 'var(--amber)',
            background: 'var(--amber-wash)',
            padding: '10px 12px',
            borderRadius: 'var(--radius-sm)',
            marginBottom: '14px',
          },
          text: `${needsImageCount} of ${paper.count} questions need an image that will not load offline right now. Their stems may look incomplete until you are back online.`,
        })
      : null;

  return el('div', { class: 'sheet' }, [
    el('div', { class: 'sheet__title', text: paper.name }),
    el('div', {
      class: 'sheet__sub',
      text: `${paper.date || 'undated'} · ${paper.count} questions · ${paper.kind === 'quiz' ? 'Quiz' : 'Grand Test'}`,
    }),
    warn,
    el('div', { style: { marginBottom: '16px' } }, [
      el('div', { class: 'section-title', text: 'Duration (minutes)' }),
      durationField,
    ]),
    el('div', { style: { marginBottom: '4px' } }, [
      el('div', { class: 'section-title', text: 'Marking scheme' }),
      el('div', { class: 'filters' }, [optDefault, optNeg]),
    ]),
    el('div', { style: { marginTop: '18px', display: 'flex', gap: '10px' } }, [
      el('button', { class: 'btn btn--ghost', type: 'button', text: 'Cancel', onclick: closeSheet }),
      el('button', {
        class: 'btn btn--primary',
        type: 'button',
        text: 'Start',
        onclick: () => {
          closeSheet();
          const scheme = schemeKey === 'negative' ? GT.NEGATIVE_SCHEME : GT.DEFAULT_SCHEME;
          ui.navigate('gt', {
            paperId: paper.id,
            scheme: JSON.stringify(scheme),
            durationMs: durationMin * 60000,
          });
        },
      }),
    ]),
  ]);
}

/* ---------------------------------------------------------------------------------- sheet UI */

let sheetNode = null;

function showSheet(inner) {
  closeSheet();
  sheetNode = el(
    'div',
    {
      class: 'sheet-backdrop',
      onclick: (e) => {
        if (e.target === sheetNode) closeSheet();
      },
    },
    [inner]
  );
  document.body.appendChild(sheetNode);
  const first = inner.querySelector('button, input');
  if (first) first.focus();
  document.addEventListener('keydown', onSheetKey);
}

function onSheetKey(e) {
  if (e.key === 'Escape') closeSheet();
}

function closeSheet() {
  if (sheetNode) sheetNode.remove();
  sheetNode = null;
  document.removeEventListener('keydown', onSheetKey);
}
