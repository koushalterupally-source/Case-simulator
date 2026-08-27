# PYQ App — data and module architecture

Binding spec. Everything in `pyq-app/` implements this. Where this disagrees with
`docs/PYQ_APP_BUILD_WORKFLOW.md`, this file wins — it carries three corrections made after thinking the
data model through properly.

## Corrections to the workflow document

**1. There is no global `index.json`.** The original plan called for a per-question metadata index. At
33,930 questions that file is multiple megabytes and is parsed at boot to render a screen that only needs
counts. Replaced by a small **catalog** plus **self-describing shards**: the catalog answers every browse
screen, and per-question metadata rides along inside the shard that carries the question.

**2. Shards split into questions and answers.** Each group emits two files:

- `<shard>.q.json` — id, question text, options, subject
- `<shard>.a.json` — id, correct index, explanation short + detail, hasExplanation

Practice mode fetches both together. **Grand Test mode fetches only `.q.json` at start, and `.a.json` at
submit.** This is what makes "never send the answer key to the client during a GT" true rather than
cosmetic — hiding a key that is already in memory with a CSS class or a JS flag is not hiding it. It also
roughly halves the GT start payload, since explanations are the bulk of the bytes.

**3. Deduplication must never touch a mock paper.** The workflow said to dedupe globally. That is wrong: a
mock paper is a historical artifact, and dropping its question 47 because the same question also sits in
`pathology.json` corrupts the paper, breaks its question numbering, and makes the score meaningless.

Dedup policy is therefore split:

- **Practice banks** (the subject-sliced files): deduplicate, keeping the copy with the longest
  explanation.
- **Mock papers** (the container files): keep every question. Flag duplicates with `dupOf` so
  cross-paper statistics can avoid double-counting, but never remove one from a paper.
- `grand_tests.json` is dropped whole, being a strict subset of `grand_tests_2.json` — that is a redundant
  *file*, not redundant *questions within a paper*.

**4. Question text is HTML too, and sometimes the image *is* the question.** The workflow document treated
`explanation.detail` as the only HTML field. Measured: **11,089 question texts (22.5%) contain markup** —
11,005 of them an `<img>`, plus `<div>` wrappers and a little `<em>`. For a radiology or pathology stem the
image carries the entire question; rendering that field as plain text makes 11,005 questions unanswerable.

So `question` is sanitized and rendered as HTML on exactly the same path as `explanation.detail`. Option
text, by contrast, is clean across all 49,293 records — zero tags — and is rendered with `textContent`.

This raises the stakes on the offline-image problem. A missing picture in an explanation is a degraded
explanation; a missing picture in a stem is an unanswerable question. Any question whose stem needs a
remote image is flagged `needsImage` at build time so the UI can warn before a Grand Test starts offline,
rather than stranding the candidate at question 84 of 200.

## Source data

Read-only inputs, never modified:

```
$MEDQBANK/android/app/src/main/assets/
  pyq/    18 subject files   + manifest.json    4,692 questions
  cereb/  18 bank files      + manifest.json   44,601 questions
```

Schema of every record, uniform across all 49,293:

```json
{ "id": "...", "subject": "...", "subtopic": "...", "exam": "PYQ|CEREB",
  "year": "...",                                    // PYQ only
  "question": "...", "options": ["...", ...], "correct": 0,
  "explanation": { "short": "...", "detail": "<html>" } }
```

`correct` is a 0-based index into `options`. `options` has 4 entries except in exactly 2 records with 3.

## Output layout

```
data/
  catalog.json              # everything every browse screen needs
  report.json               # what the build did: counts, drops, classification stats
  lexicon.json              # subject keyword lexicon (build artifact, kept for audit)
  shards/<shardId>.q.json
  shards/<shardId>.a.json
```

### catalog.json

```json
{
  "builtAt": "2026-08-27T00:00:00Z",
  "totals": { "source": 49293, "practice": 0, "papers": 0, "dropped": 0 },
  "practice": [
    { "source": "PYQ", "subject": "Anatomy", "slug": "pyq-anatomy", "total": 258,
      "groups": [ { "name": "AIIMS 2017", "count": 23, "shard": "pyq-anatomy-0" } ] }
  ],
  "papers": [
    { "id": "gt2-014", "name": "NEETPG Mock-5 (Standard Difficulty)", "date": "2025-07-15",
      "source": "Grand Tests", "count": 200, "shards": ["gt2-014-0"],
      "kind": "grand-test" }
  ]
}
```

- `kind` is `"grand-test"` when count >= 50, otherwise `"quiz"`. A 28-question paper must not be launched
  with a three-hour timer.
- `date` is the `YYYY-MM-DD` parsed off the end of `subtopic`; all 229 papers have one. The display `name`
  is `subtopic` with that date (and any duplicate `DD-MM-YYYY` fragment) stripped.
- `groups`/`shards` are ordered; a group spanning more than one shard lists them in question order.

### Shard files

`<shard>.q.json`:
```json
[ { "id": "cereb_grand_tests_2_41", "n": 0, "question": "...", "options": ["...","...","...","..."],
    "subject": "Pathology", "subjectFrom": "exact|lexicon|null" } ]
```

`<shard>.a.json`:
```json
[ { "id": "cereb_grand_tests_2_41", "correct": 2, "short": "Ans: C",
    "detail": "<p>...</p>", "hasExplanation": true } ]
```

Both arrays are the same length and in the same order; `n` is the question's position within its group,
which is what a paper's question palette numbers from.

Hard limits:
- No emitted file exceeds **1 MB**. Groups larger than that split across sequential shards.
- `hasExplanation` is false when `detail` stripped of tags has under 60 characters of text.
- `subject` is `null` and `subjectFrom` is `null` when classification found nothing — rendered as
  "Unclassified", never guessed.

## Subject classification

Container-file questions all carry `subject: "Grand Tests"` and similar, so a mock paper cannot produce a
subject-wise analysis without inferring one. Two passes, both at build time, never at runtime:

1. **Exact match.** Normalize (lowercase, strip non-word characters, first 200 chars) and look up against
   the subject-tagged corpus of 12,426 unique questions. Recovers roughly 5%. `subjectFrom: "exact"`.
2. **Lexicon.** Build a per-subject keyword lexicon from the subject-tagged corpus by log-odds: a term
   scores for a subject when it is markedly more frequent there than in the corpus at large. Score each
   unclassified question by summing its terms' weights; accept the top subject only if it clears an
   absolute floor and beats the runner-up by a clear margin. `subjectFrom: "lexicon"`.

Anything unresolved stays `null`. The analysis screen reports the unclassified count rather than
distributing it silently across subjects — an invented breakdown is worse than an incomplete one.

`report.json` records the split so the classifier's reach is auditable.

## Runtime modules

Plain ES modules, no bundler, no framework, no package manager. `index.html` loads them with
`<script type="module">`.

| Module | Owns | Must not |
|---|---|---|
| `net.js` | The XHR loader and the `file:///android_asset/` fallback | — |
| `store.js` | IndexedDB: attempts, sessions, bookmarks, mistake bank | Touch the DOM |
| `data.js` | Catalog and shard loading, in-memory cache | Fetch an `.a.json` for a running GT |
| `sanitize.js` | Explanation HTML allowlist | Ever return a string unsanitized |
| `ui.js` | Shell, router, theme, toast, focus management | Know anything about questions |
| `practice.js` | Practice mode screens | Own timing logic |
| `gt.js` | GT session state machine, timer, palette | Read `.a.json` before submit |
| `analysis.js` | Post-submit analysis screens | Mutate session state |
| `app.js` | Wiring, boot, error shield | Contain business logic |

### The two rules the modules exist to enforce

**Never `fetch()` a local file.** `fetch()` fails against `file://` in Android WebView — it works perfectly
in a browser and dies silently in the APK. Everything goes through `net.js`.

**Never derive a countdown by decrementing a counter.** `gt.js` stores an absolute `endsAt` timestamp and
computes remaining time from `Date.now()` on each tick. An interval-decremented counter drifts, and stops
entirely when the app is backgrounded — the user returns to a paused exam that should have been running.

## Session persistence

A GT session is written to IndexedDB on every answer, mark, and navigation, and carries `endsAt` as an
absolute timestamp. Resuming after a force-kill restores the exact question, every answer, every review
mark, and the correct remaining time — computed from `endsAt`, not from a stored "seconds left".

Every storage access is wrapped: private-browsing and quota-exceeded both throw, and the app must render
anyway, degraded rather than broken.
