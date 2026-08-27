/**
 * Post-submit analysis.
 *
 * The point of a mock test is what you learn afterwards, so this is the screen the feature exists for:
 * score, where the marks went by subject, where the time went, and every question reviewable with its
 * full explanation.
 */

import * as GT from '../gt.js';
import * as store from '../store.js';
import * as ui from '../ui.js';
import { el, html, clear, optionKey, pct, duration } from '../dom.js';

const FILTERS = [
  { key: 'wrong', label: 'Wrong' },
  { key: 'skipped', label: 'Skipped' },
  { key: 'marked', label: 'Marked' },
  { key: 'correct', label: 'Correct' },
  { key: 'all', label: 'All' },
];

let current = { result: null, filter: 'wrong', root: null };

export async function show(root, { sessionId }) {
  const result = await store.get('results', sessionId);
  if (!result) {
    clear(root).appendChild(
      el('div', { class: 'empty' }, [
        el('span', { class: 'empty__icon', text: '🔍' }),
        el('p', { text: 'That result is no longer saved on this device.' }),
      ])
    );
    return;
  }
  current = { result, filter: result.wrong > 0 ? 'wrong' : 'all', root };
  render();
}

export function showResult(root, result) {
  current = { result, filter: result.wrong > 0 ? 'wrong' : 'all', root };
  render();
}

function render() {
  const { result, root } = current;
  const subjects = GT.bySubject(result);
  const time = GT.timeAnalysis(result);

  clear(root);
  root.appendChild(
    el('div', { class: 'screen' }, [
      header(result),
      scoreStrip(result),
      subjectSection(subjects),
      timeSection(time, result),
      reviewSection(result),
    ])
  );

  const title = document.getElementById('appbar-title');
  if (title) title.textContent = 'Analysis';
}

function header(result) {
  const verdict =
    result.accuracy >= 0.7 ? 'Strong paper' : result.accuracy >= 0.5 ? 'Solid, with gaps' : 'Worth a rebuild';

  return el('div', { class: 'hero', style: { marginBottom: '18px' } }, [
    el('div', {}, [
      el('div', { class: 'hero__title', text: `${result.score} / ${result.maxScore}` }),
      el('div', { class: 'hero__sub', text: `${verdict} · ${result.paperName}` }),
      el('div', {
        class: 'hero__sub',
        style: { marginTop: '4px', fontSize: '0.82rem' },
        text: `${pct(result.accuracy)} accuracy on ${result.attempted} attempted · ${duration(result.totalTimeMs)} taken`,
      }),
    ]),
    el('div', { class: 'hero__icon', text: result.accuracy >= 0.7 ? '🎯' : '📈' }),
  ]);
}

function scoreStrip(result) {
  return el('div', { class: 'stats' }, [
    stat(result.correct, 'Correct', 'good'),
    stat(result.wrong, 'Wrong', 'bad'),
    stat(result.skipped, 'Skipped', 'warn'),
    stat(pct(result.accuracy), 'Accuracy'),
    stat(duration(result.totalTimeMs), 'Time'),
  ]);
}

function stat(value, label, tone) {
  return el('div', { class: `stat${tone ? ` stat--${tone}` : ''}` }, [
    el('div', { class: 'stat__value', text: String(value) }),
    el('div', { class: 'stat__label', text: label }),
  ]);
}

function subjectSection(breakdown) {
  const nodes = [el('div', { class: 'section-title', text: 'Where the marks went' })];

  if (breakdown.subjects.length === 0) {
    nodes.push(
      el('div', { class: 'empty' }, [
        el('p', { text: 'None of the questions in this paper could be matched to a subject.' }),
      ])
    );
    return el('section', {}, nodes);
  }

  if (breakdown.weakest.length > 0) {
    nodes.push(
      el('p', {
        style: { fontSize: '0.88rem', color: 'var(--subtext)', marginBottom: '12px' },
        text: `Weakest: ${breakdown.weakest.map((s) => `${s.subject} (${pct(s.accuracy)})`).join(', ')}`,
      })
    );
  }

  nodes.push(
    el(
      'div',
      { class: 'bars' },
      breakdown.subjects.map((s) => {
        const tone = s.accuracy >= 0.7 ? 'var(--green)' : s.accuracy >= 0.45 ? 'var(--amber)' : 'var(--red)';
        return el('div', {}, [
          el('div', { class: 'bar__head' }, [
            el('span', { class: 'bar__name', text: s.subject }),
            el('span', {
              class: 'bar__val',
              text: `${s.correct}/${s.attempted || 0} · ${pct(s.accuracy)} · ${duration(s.avgTimeMs)} avg`,
            }),
          ]),
          el('div', { class: 'bar__track' }, [
            el('div', { class: 'bar__fill', style: { width: pct(s.accuracy), background: tone } }),
          ]),
        ]);
      })
    )
  );

  // An invented breakdown would be worse than an incomplete one, so say what could not be placed.
  if (breakdown.unclassified > 0) {
    nodes.push(
      el('p', {
        style: { fontSize: '0.8rem', color: 'var(--faint)', marginTop: '12px' },
        text: `${breakdown.unclassified} of ${breakdown.unclassified + breakdown.classified} questions in this paper carry no subject label and are left out of the figures above.`,
      })
    );
  }

  return el('section', {}, nodes);
}

function timeSection(time, result) {
  const nodes = [
    el('div', { class: 'section-title', text: 'Where the time went' }),
    el('div', { class: 'stats' }, [
      stat(duration(time.avgMs), 'Per question'),
      stat(time.slow.length, 'Over 2 min'),
      stat(time.slowPaidOff, 'Slow & right', 'good'),
      stat(time.slowWasted, 'Slow & wrong', 'bad'),
    ]),
  ];

  if (time.slowWasted > 0) {
    nodes.push(
      el('p', {
        style: { fontSize: '0.88rem', color: 'var(--subtext)' },
        text: `${time.slowWasted} of your longest questions still came out wrong. In a timed paper those are the ones to abandon earlier.`,
      })
    );
  } else if (time.slow.length === 0 && result.attempted > 0) {
    nodes.push(
      el('p', {
        style: { fontSize: '0.88rem', color: 'var(--subtext)' },
        text: 'No question took more than two minutes — pacing was not the constraint here.',
      })
    );
  }

  return el('section', {}, nodes);
}

function reviewSection(result) {
  const listHost = el('div', { class: 'review', id: 'review-list' });

  const filterBar = el(
    'div',
    { class: 'filters' },
    FILTERS.map((f) =>
      el('button', {
        class: 'filter',
        type: 'button',
        text: `${f.label} (${countFor(result, f.key)})`,
        'aria-pressed': String(current.filter === f.key),
        onclick: () => {
          current.filter = f.key;
          for (const btn of filterBar.children) btn.setAttribute('aria-pressed', 'false');
          const idx = FILTERS.findIndex((x) => x.key === f.key);
          filterBar.children[idx].setAttribute('aria-pressed', 'true');
          paintReview(listHost, result);
        },
      })
    )
  );

  paintReview(listHost, result);

  return el('section', {}, [
    el('div', { class: 'section-title', text: 'Question review' }),
    filterBar,
    listHost,
  ]);
}

function countFor(result, key) {
  if (key === 'all') return result.count;
  return result.questions.filter((r) => matches(r, key)).length;
}

function matches(row, filter) {
  switch (filter) {
    case 'wrong':
      return row.chosen !== null && !row.isCorrect;
    case 'skipped':
      return row.chosen === null;
    case 'marked':
      return row.marked;
    case 'correct':
      return row.isCorrect;
    default:
      return true;
  }
}

function paintReview(host, result) {
  clear(host);
  const rows = result.questions.filter((r) => matches(r, current.filter));

  if (rows.length === 0) {
    host.appendChild(
      el('div', { class: 'empty' }, [
        el('span', { class: 'empty__icon', text: '✓' }),
        el('p', { text: 'Nothing in this category.' }),
      ])
    );
    return;
  }

  // A 200-question "All" list is heavy; render the first slice and extend on demand.
  const PAGE = 25;
  let shown = 0;

  const renderMore = () => {
    const slice = rows.slice(shown, shown + PAGE);
    for (const row of slice) host.appendChild(reviewItem(row));
    shown += slice.length;

    const oldBtn = host.querySelector('.review-more');
    if (oldBtn) oldBtn.remove();
    if (shown < rows.length) {
      host.appendChild(
        el('button', {
          class: 'btn btn--ghost review-more',
          type: 'button',
          text: `Show ${Math.min(PAGE, rows.length - shown)} more of ${rows.length - shown}`,
          onclick: renderMore,
        })
      );
    }
  };

  renderMore();
}

function reviewItem(row) {
  const verdict = row.chosen === null ? 'skipped' : row.isCorrect ? 'correct' : 'wrong';

  const stem = el('div', { class: 'qtext', style: { fontSize: '0.96rem', marginBottom: '14px' } });
  html(stem, row.question);

  const options = el(
    'div',
    { class: 'options' },
    row.options.map((text, i) => {
      let stateName = '';
      if (i === row.correctIndex) stateName = 'correct';
      else if (i === row.chosen) stateName = 'wrong';

      return el('div', { class: 'option', dataset: { state: stateName } }, [
        el('span', { class: 'option__key', text: optionKey(i) }),
        el('span', {}, [
          el('span', { text }),
          i === row.chosen ? el('strong', { text: '  ← your answer' }) : null,
        ]),
      ]);
    })
  );

  const nodes = [
    el('div', { class: 'review__head' }, [
      el('span', { text: `Q${row.n + 1}${row.subject ? ` · ${row.subject}` : ''}` }),
      el('span', {
        text: `${verdict === 'skipped' ? 'Skipped' : verdict === 'correct' ? 'Correct' : 'Wrong'}${
          row.timeMs ? ` · ${duration(row.timeMs)}` : ''
        }${row.marked ? ' · marked' : ''}`,
      }),
    ]),
    stem,
    options,
  ];

  if (row.hasExplanation) {
    const body = el('div', { class: 'explain__body' });
    html(body, row.detail);
    nodes.push(
      el('div', { class: 'explain' }, [el('div', { class: 'explain__head', text: 'Explanation' }), body])
    );
  } else {
    // 27% of the corpus has no real explanation. Say so rather than showing an empty panel.
    nodes.push(
      el('div', { class: 'explain explain--stub' }, [
        el('div', { class: 'explain__head', text: 'No explanation in the source' }),
        el('div', { text: row.short || `The answer is ${optionKey(row.correctIndex)}.` }),
      ])
    );
  }

  return el('div', { class: 'review__item', dataset: { verdict } }, nodes);
}
