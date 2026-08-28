/**
 * Review screen — the mistake bank and the bookmark shelf.
 *
 * Both stores only carry `questionId`, `subject`, `source`, `title`, plus the mistake's
 * chosen/correct indices — never the question text (see ARCHITECTURE.md). To show anything, each
 * record is resolved back to its shard by matching (source, title) against the catalog: either a
 * paper by name, or a practice group by name, since that's the only link the stored records
 * carry. A record that cannot be resolved (its paper or group no longer exists, or a shard fails
 * to load) is skipped silently rather than erroring the whole screen.
 */

import * as data from '../data.js';
import * as store from '../store.js';
import { el, html, clear, optionKey } from '../dom.js';

const TABS = [
  { key: 'mistakes', label: 'Mistakes' },
  { key: 'bookmarks', label: 'Bookmarks' },
];

let currentTab = 'mistakes';

export async function show(root) {
  clear(root);
  setTitle('Review');

  const host = el('div', { class: 'review', id: 'review-host' });
  const tabs = el('div', { class: 'filters' });
  const buttons = TABS.map((def) =>
    el('button', {
      class: 'filter',
      type: 'button',
      text: def.label,
      'aria-pressed': String(currentTab === def.key),
      onclick: () => {
        currentTab = def.key;
        for (const b of buttons) b.setAttribute('aria-pressed', 'false');
        buttons[TABS.findIndex((d) => d.key === def.key)].setAttribute('aria-pressed', 'true');
        paintTab(host);
      },
    })
  );
  for (const b of buttons) tabs.appendChild(b);

  root.appendChild(el('div', { class: 'screen' }, [tabs, host]));
  await paintTab(host);
}

function setTitle(text) {
  const t = document.getElementById('appbar-title');
  if (t) t.textContent = text;
}

function emptyState(icon, text) {
  return el('div', { class: 'empty' }, [el('span', { class: 'empty__icon', text: icon }), el('p', { text })]);
}

async function paintTab(host) {
  clear(host);
  host.appendChild(el('div', { class: 'spinner' }));

  let records;
  try {
    records = currentTab === 'mistakes' ? await store.getAll('mistakes') : await store.getAll('bookmarks');
  } catch (err) {
    console.warn('review: could not read store', err);
    clear(host).appendChild(emptyState('⚠️', 'Could not load this list right now.'));
    return;
  }

  await renderRecords(host, records, currentTab);
}

async function renderRecords(host, records, kind) {
  clear(host);

  if (records.length === 0) {
    host.appendChild(
      kind === 'mistakes'
        ? emptyState('🎉', 'No mistakes banked yet — wrong answers from practice and tests land here.')
        : emptyState('🔖', 'No bookmarks yet — tap the star on any practice question to save it here.')
    );
    return;
  }

  let catalog;
  try {
    catalog = await data.loadCatalog();
  } catch (err) {
    console.warn('review: could not load catalog to resolve questions', err);
    host.appendChild(emptyState('⚠️', 'Could not load the question bank to show these.'));
    return;
  }

  const resolved = await resolveQuestions(catalog, records);

  const bySubject = new Map();
  for (const r of records) {
    const q = resolved.get(r.questionId);
    if (!q) continue; // unresolved — skip silently, per spec
    const subject = r.subject || 'Unclassified';
    if (!bySubject.has(subject)) bySubject.set(subject, []);
    bySubject.get(subject).push({ record: r, question: q });
  }

  if (bySubject.size === 0) {
    host.appendChild(emptyState('🔍', 'None of these questions could be found in the current question bank.'));
    return;
  }

  const sections = [...bySubject.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  for (const [subject, items] of sections) {
    host.appendChild(el('div', { class: 'section-title', text: `${subject} (${items.length})` }));
    for (const item of items) host.appendChild(reviewItem(item.record, item.question, kind));
  }
}

/* ------------------------------------------------------------------------- resolution */

function groupShards(group) {
  if (Array.isArray(group.shards)) return group.shards.slice();
  if (group.shard) return [group.shard];
  return [];
}

function candidateShardSets(catalog, source, title) {
  const out = [];
  for (const p of catalog.papers || []) {
    if (p.source === source && p.name === title && Array.isArray(p.shards)) out.push(p.shards);
  }
  for (const s of catalog.practice || []) {
    if (s.source !== source) continue;
    for (const g of s.groups || []) {
      if (g.name === title) {
        const shards = groupShards(g);
        if (shards.length) out.push(shards);
      }
    }
  }
  return out;
}

/** Resolve every record's `questionId` to its full question+answer object. Records sharing the
 * same (source, title) are resolved together so a shard is only ever fetched once.
 *
 * Exported so other screens (see anki.js's "from your mistakes" deck) resolve mistake/bookmark
 * records back to full questions the exact same way, rather than re-inventing the lookup. */
export async function resolveQuestions(catalog, records) {
  const groups = new Map();
  for (const r of records) {
    const key = `${r.source || ''}||${r.title || ''}`;
    if (!groups.has(key)) groups.set(key, { source: r.source, title: r.title, ids: new Set() });
    groups.get(key).ids.add(r.questionId);
  }

  const resolved = new Map();
  for (const { source, title, ids } of groups.values()) {
    const candidates = candidateShardSets(catalog, source, title);
    for (const shards of candidates) {
      if (ids.size === 0) break;
      let qs;
      try {
        qs = await data.loadPracticeSet(shards);
      } catch (err) {
        continue; // a missing/broken shard set is skipped, not fatal to the rest
      }
      for (const q of qs) {
        if (ids.has(q.id)) {
          resolved.set(q.id, q);
          ids.delete(q.id);
        }
      }
    }
  }
  return resolved;
}

/* --------------------------------------------------------------------------- rendering */

function reviewItem(record, question, kind) {
  const yourAnswer = kind === 'mistakes' ? record.chosen : null;
  const correctIndex = kind === 'mistakes' && typeof record.correct === 'number' ? record.correct : question.correct;

  const stem = el('div', { class: 'qtext', style: { fontSize: '0.96rem', marginBottom: '14px' } });
  html(stem, question.question);

  const options = el(
    'div',
    { class: 'options' },
    question.options.map((text, i) => {
      let stateName = '';
      if (i === correctIndex) stateName = 'correct';
      else if (kind === 'mistakes' && i === yourAnswer) stateName = 'wrong';
      return el('div', { class: 'option', dataset: { state: stateName } }, [
        el('span', { class: 'option__key', text: optionKey(i) }),
        el('span', {}, [
          el('span', { text }),
          kind === 'mistakes' && i === yourAnswer ? el('strong', { text: '  ← your answer' }) : null,
        ]),
      ]);
    })
  );

  const nodes = [
    el('div', { class: 'review__head' }, [
      el('span', { text: record.title || record.source || 'Question' }),
      el('span', { text: record.at ? new Date(record.at).toLocaleDateString() : '' }),
    ]),
    stem,
    options,
  ];

  if (question.hasExplanation) {
    const body = el('div', { class: 'explain__body' });
    html(body, question.detail);
    nodes.push(el('div', { class: 'explain' }, [el('div', { class: 'explain__head', text: 'Explanation' }), body]));
  } else {
    // 27% of the corpus has no real explanation. Say so rather than showing an empty panel.
    nodes.push(
      el('div', { class: 'explain explain--stub' }, [
        el('div', { class: 'explain__head', text: 'No explanation in the source' }),
        el('div', { text: question.short || `The answer is ${optionKey(correctIndex)}.` }),
      ])
    );
  }

  return el('div', { class: 'review__item', dataset: { verdict: kind === 'mistakes' ? 'wrong' : 'correct' } }, nodes);
}
