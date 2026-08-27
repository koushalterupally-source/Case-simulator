# PYQ App Build Workflow — Agent Handoff Brief

**Purpose:** hand this file to a coding agent (Mimo, Opus, Claude Code, Cursor, whatever) so it can build a
question-bank app on top of the question data that already exists in this GitHub account, with a clean UI
modelled on the MEDTRIX dashboard.

**Status of the facts below:** every path, count, and schema in this document was verified by reading the
actual repositories on 2026-08-27. Do not re-derive them; do not assume they changed. If a number here
disagrees with what you find, trust what you find and say so.

---

## 0. How to use this document

Paste this into the agent as the opening instruction, with this file attached or its raw URL supplied:

> Build the app described in `docs/PYQ_APP_BUILD_WORKFLOW.md`. Read the whole document before writing any
> code. Work phase by phase; do not start a phase until the previous phase's acceptance gate passes. The
> data already exists — you are not authoring questions, you are building an interface over
> `koushalterupally-source/Medqbank`. Report at the end of each phase with the gate results.

Raw URL for the agent to fetch:
`https://raw.githubusercontent.com/koushalterupally-source/Case-simulator/main/docs/PYQ_APP_BUILD_WORKFLOW.md`

---

## 1. What you are building

A **single-page, offline-first PYQ (previous-year-question) app** for Indian PG medical entrance prep
(NEET-PG, INI-CET, AIIMS), shipped two ways from one codebase:

- a **PWA** deployed to GitHub Pages, and
- an **Android APK** that wraps the same assets in a WebView.

There are two modes, and they are deliberately different products sharing one data layer:

**Practice mode** — pick a question source → pick a subject → pick a session/topic → answer MCQs one at a
time → see the explanation immediately → progress and mistakes saved locally → resume later.

**Grand Test mode** — sit a full ~200-question mock paper under exam conditions: a countdown timer, a
question palette, mark-for-review, no feedback until you submit. Then a real analysis screen: score,
subject-wise accuracy, time per question, and every question reviewable with its full explanation. 229 such
papers already exist in the data. This is specified in full at §7 Phase 5.

**It must work with the plane on airplane mode.** No server, no login, no API key required for either mode.

---

## 2. Where the data lives

All question data is in **`koushalterupally-source/Medqbank`**, under:

```
android/app/src/main/assets/
├── index.html                 # the current single-file app (133 KB) — reference, not a constraint
├── manifest.webmanifest       # PWA manifest, already correct
├── sw.js                      # service worker
├── icons/                     # 72 → 512 px PWA icons, already generated
├── pyq/                       # 18 subject files + manifest.json     →  4,692 questions
└── cereb/                     # 18 bank files + manifest.json        → 44,601 questions
```

**Total: 49,293 questions, 97.6 MB of raw JSON.**

Related repos, for context only:

| Repo | What it is | Use it for |
|---|---|---|
| `koushalterupally-source/Medqbank` | The live app + all question data + APK/Pages workflows | **This is the source of truth.** |
| `koushalterupally-source/medquiz-app` | Older iteration, cereb only, build artifacts committed | Ignore unless archaeology is needed |
| `koushalterupally-source/Case-simulator` | React/Vite clinical-case simulator | Different product; do not merge into it |
| `thesauceypotato/Medtrix-Android-Final` | The UI you are imitating | Design reference only — do not copy its data or its multi-page structure |

### The two banks are not interchangeable

`pyq/` is **real previous-year exam papers**, sliced by subject. Its `subtopic` field holds the **exam
session** — `"AIIMS 2017"`, `"NEET 2021"`, `"INI-CET 2024"` — and it carries an extra `year` field.

`cereb/` is **coaching-material question banks**. Its `subtopic` field holds an actual **topic** —
`"Head, Neck and Face"`, `"Cardiopulmonary Resuscitation"`. Three of its files are not subjects at all but
containers of whole mock papers: `grand_tests.json` (9,412), `grand_tests_2.json` (9,605),
`previous_year_tests.json` (8,290), `best_of_the_rest.json` (6,446). In those, `subtopic` is a test name
plus a date: `"ALL INDIA MEDICOS TEST - 2024 BATCH - 2024-12-22"`.

The UI must reflect this. PYQ browses **by exam session**; CEREB browses **by topic**; the mock-paper files
browse **by test**. One flat "subject → subtopic" grid for all three is wrong and will feel wrong.

### The mock papers are real full-length tests

This matters because it makes a Grand Test mode possible without authoring anything. The five container
files hold **229 discrete papers**, each one a complete sitting:

| File | Questions | Papers | Paper size (min / median / max) | Date range |
|---|---:|---:|---|---|
| `grand_tests_2.json` | 9,605 | 65 | 28 / 196 / 200 | 2023-04-16 → 2025-07-15 |
| `grand_tests.json` | 9,412 | 64 | 28 / 196 / 200 | *subset of the above — drop it* |
| `previous_year_tests.json` | 8,290 | 37 | 120 / 199 / 397 | 2017-05-07 → 2025-01-12 |
| `best_of_the_rest.json` | 6,446 | 57 | 39 / 99 / 200 | 2023-08-22 → 2025-06-07 |
| `best_of_the_rest_subject_wise.json` | 1,039 | 6 | 50 / 198 / 200 | 2025-03-11 → 2025-07-15 |

Every paper's `subtopic` ends in a parseable `YYYY-MM-DD` — all 229 of them, no exceptions — so papers sort
chronologically for free. Strip the trailing date for the display name.

Median paper length is a genuine ~200 questions, which is a real NEET-PG/INI-CET-length sitting. Anything
under about 50 is a topic quiz, not a grand test, and should be labelled as such rather than launched with a
three-hour timer.

---

## 3. Data contract

Every one of the 49,293 records has exactly this shape. Verified: no missing keys, no exceptions.

```json
{
  "id": "pyq_psychiatry_0_0",
  "subject": "Psychiatry",
  "subtopic": "AIIMS 2017",
  "exam": "PYQ",
  "year": "AIIMS 2017",
  "question": "A 42-year-old man had a fall followed by one episode of vomiting...",
  "options": ["Drunkenness", "Diffuse axonal injury", "Concussion", "Cerebral venous thrombosis"],
  "correct": 2,
  "explanation": {
    "short": "Ans: C",
    "detail": "The given history of fall and anterograde amnesia points towards concussion.<br>..."
  }
}
```

- `correct` is a **0-based index into `options`**. Verified: 0 invalid indices across all 49,293 records.
- `options` has 4 entries in 49,291 records and 3 in exactly 2 records. Render from `options.length`; never
  hardcode four.
- `year` exists only on PYQ records (4,692 of them). Absent on CEREB.
- `explanation.detail` is **HTML**, not plain text.

Each bank has a `manifest.json` of this shape, already generated and correct:

```json
{ "subjects": [ { "name": "Anatomy", "file": "cereb/anatomy.json", "total": 768,
                  "subtopics": [ { "name": "Embryology", "count": 72 }, ... ] } ] }
```

Use the manifests to render every browse screen. **Never load a question file just to count it.**

---

## 4. Known data hazards — read this before designing anything

These are measured, not hypothetical. Handling them is Phase 1 work.

| Hazard | Measurement | What it breaks |
|---|---|---|
| **Duplicate questions** | 15,363 extra copies of already-present question text (31% of the corpus) | The same question resurfaces three times in one session; "questions answered" stats inflate |
| **Remote images** | 24,650 `<img>` tags pointing at `cerebellum-web-static.s3.amazonaws.com` | Every one is a broken image offline — and offline is the whole point |
| **Inline base64 images** | 1,688 images, 0.6 MB, embedded in explanation HTML | Bloats the JSON parse; fine to keep, but don't add more |
| **Stub explanations** | 13,353 records (27.1%) whose explanation is under 60 characters of real text — often just `<p><strong>Ans. D) Ligaments</strong></p>` | A "show explanation" screen that's empty 27% of the time reads as broken |
| **Subject-name collisions** | `Anaesthesia` vs `Anesthesia`, `Orthopaedics` vs `Orthopedics` | Two tiles for one subject in any merged view |
| **Pseudo-subjects** | `Grand Tests`, `Grand Tests 2`, `Best of the Rest`, `Previous Year Tests` are containers, not subjects | They dominate a subject grid by size and mean nothing to a student browsing by subject |
| **Cross-bank overlap** | 181 questions appear in both `pyq/` and `cereb/previous_year_tests.json` | Minor, but breaks "unseen questions only" modes |
| **Arbitrary HTML in explanations** | 48,457 records contain tags — `br`, `p`, `strong`, `li`, `ul`, `img`, `div` | Must be rendered as HTML, and must be sanitized before it goes in the DOM |
| **`grand_tests.json` is redundant** | 100% of its 9,081 unique questions also appear in `grand_tests_2.json`; 64 of its 65 papers are shared | 9,412 duplicate questions and 10.6 MB of payload for one extra paper |
| **Mock-test questions carry no subject** | All 34,792 container-file questions have `subject: "Grand Tests"` etc. Only 1,846 (5.3%) can be resolved to a real subject by exact text match | Subject-wise analysis of a mock test is **impossible from the data as shipped** — see §7 Phase 5 |

### Required handling

1. **Deduplicate** on a normalized key (lowercase, strip non-word characters, first 200 chars of question
   text). Keep the copy with the longest explanation. Emit a report of what was dropped.
2. **Render explanation HTML through an allowlist sanitizer** — permit `p br strong em b i ul ol li img div
   span table tr td th sub sup`, strip everything else, strip all `on*` attributes and any non-`https:`/
   non-`data:` `src`. Do not use `innerHTML` on raw data.
3. **Images: pick one and say which.** Either (a) mirror the S3 images into the repo at build time and
   rewrite the `src` (adds ~hundreds of MB — probably not viable), or (b) render remote images lazily with a
   graceful "image unavailable offline" placeholder and a tap-to-load when online. **Default to (b)** unless
   told otherwise. Never leave a bare broken-image icon.
4. **Flag, don't hide, stub explanations.** Mark them in the index with `hasExplanation: false` and let the
   user filter to "questions with full explanations". Showing "Ans: C" alone with no elaboration is honest;
   showing an empty panel is not.
5. **Canonicalize subject names** through an explicit map. Route the container files to a separate
   "Mock Tests" section rather than into the subject grid.
6. **Drop `grand_tests.json` entirely** and read grand tests from `grand_tests_2.json`. Verify the 100%
   containment yourself before deleting anything from the index, and report the result.
7. **Classify container questions by subject at build time** — never at runtime. See Phase 5.

---

## 5. Design system

Modelled on `thesauceypotato/Medtrix-Android-Final/index.html`, adapted for a single-page app.

### Tokens

```css
:root {
  --bg: #f3f4f6;
  --bg-gradient: radial-gradient(circle at 0% 0%, #e0f2fe, #f3f4f6);
  --glass: rgba(255,255,255,0.85);
  --border: 1px solid rgba(255,255,255,0.9);
  --shadow: 0 10px 30px rgba(31,38,135,0.08);
  --text: #1f2937;
  --subtext: #6b7280;
  --accent: #2563eb;
  --green: #16a34a;
  --red: #dc2626;
  --radius: 24px;
}
[data-theme="dark"] {
  --bg: #0f172a;
  --bg-gradient: radial-gradient(circle at 50% 0%, #1e293b, #0f172a);
  --glass: rgba(30,41,59,0.75);
  --border: 1px solid rgba(255,255,255,0.08);
  --shadow: 0 10px 40px rgba(0,0,0,0.4);
  --text: #f1f5f9;
  --subtext: #94a3b8;
  --accent: #38bdf8;
}
```

Theme is set by `data-theme` on `<html>`, persisted in `localStorage` under a single key, and applied
**before first paint** — a synchronous inline script in `<head>`, not on `DOMContentLoaded`, or the app
flashes white on every launch.

### Type and shape

- Body text: `Poppins`, 300/400/600/700. Display/numerals: `Orbitron`, 700/900. Both from Google Fonts,
  with a real fallback stack (`'Poppins', system-ui, -apple-system, sans-serif`) — the app must be legible
  offline, when the font never loads.
- Cards: `--glass` background, `backdrop-filter: blur(16px)`, `--radius` corners, `--shadow`.
- Grid: `repeat(auto-fit, minmax(300px, 1fr))`, 25px gap, collapsing to a single column under 768px.
- One **hero tile** per screen spanning the full grid width, on a `linear-gradient(135deg, #2563eb, #7c3aed)`,
  for the primary action.
- Transitions: `0.4s cubic-bezier(0.2, 0.8, 0.2, 1)`. Hover lift `translateY(-8px)` on pointer devices only
  — wrap it in `@media (hover: hover)` or it fires as a stuck state on touch.
- `-webkit-tap-highlight-color: transparent` globally; every tappable target at least 44×44 px.
- Honour `prefers-reduced-motion: reduce` by disabling the float and pulse animations.

### What to take from MEDTRIX and what to leave

**Take:** the glass-card grid, the gradient hero tile, the two-token theme system, the floating circular
control buttons, the toast pattern, the emoji-as-icon approach (no icon-font dependency — Font Awesome from
a CDN is a hard dependency that fails offline; use emoji or inline SVG).

**Leave:** the multi-page `.html`-per-screen architecture (each page reloads the whole app and loses state),
the CDN `<link>` tags, and the `Orbitron` 2.8rem heading on mobile — it wraps badly.

---

## 6. Architecture

**Ship a single `index.html` with inline CSS and JS, plus JSON data files beside it.** This is what the
existing app does and it is the right call here: no build step, no bundler, no framework, deploys to Pages
by copying a directory, and drops into the Android `assets/` folder unchanged.

Do not introduce React, Vue, a bundler, or a package manager for this app. If the file exceeds roughly
4,000 lines, split into `app.js` + `app.css` next to `index.html` — still no build step.

### The Android WebView constraint that will bite you

`fetch()` **does not work against the `file://` scheme** in Android WebView (Chromium restriction). The
existing app handles this with an XHR helper and a `file:///android_asset/...` fallback — see
`Medqbank/android/app/src/main/assets/index.html` around lines 1208 and 1389. **Reuse that helper
verbatim.** Every data load goes through it. Using bare `fetch()` will work perfectly in the browser and
fail silently in the APK, which is the worst possible failure mode.

The `MainActivity.java` in `Medqbank` already serves assets over a virtual `https` origin via
`WebViewAssetLoader` for this reason. Read it before changing anything in `android/`.

### Payload budget

97.6 MB raw, roughly 25 MB gzipped (measured: `grand_tests.json` is 10.6 MB raw, 2.4 MB gzipped). Dropping
the redundant `grand_tests.json` takes 10.6 MB off that before any other work. GitHub Pages gzips
automatically; the Android build compresses assets in the APK. Both are acceptable.

What is **not** acceptable is `JSON.parse` on a 10.6 MB file on a mid-range phone during a tap handler.
Phase 1 must shard the container files: one file per test session, not one file per bank. Target **no single
data file above 1 MB**.

### Storage

The existing app uses IndexedDB (`MedQuizDB`, version 4). Keep IndexedDB for anything per-question —
attempt history, bookmarks, spaced-repetition state — and `localStorage` only for small scalars (theme,
last-opened screen, aggregate counters). Wrap every storage access in `try/catch`: private-mode browsers
throw on access, and the app must still render.

---

## 7. The workflow

Each phase has a gate. **Do not start the next phase until the gate passes.** Report gate results.

### Phase 0 — Recon (no code)

Clone `Medqbank`. Open `android/app/src/main/assets/index.html` and read it. Open two data files, one from
each bank. Read `MainActivity.java` and both workflow files in `.github/workflows/`.

**Gate:** write a one-page note answering — what does the existing app already do well, what is the concrete
reason to rebuild rather than extend, and which of the eight hazards in §4 does the existing app already
handle? If the honest answer is "extend it", say so and stop for a decision.

### Phase 1 — Data layer

Write a build script (`scripts/build_index.py`, Python 3, stdlib only) that reads `pyq/` and `cereb/` and
emits a normalized dataset:

- `data/index.json` — every question's `id`, `subject`, `subtopic`, `exam`, `hasExplanation`, `hasImages`,
  and the file it lives in. No question text. This is the file the browse UI reads.
- `data/q/<shard>.json` — the questions themselves, sharded so no file exceeds 1 MB.
- `data/report.json` — what was dropped and why: duplicate count, canonicalization map applied, stub count.

The script is **idempotent and re-runnable**, and never mutates the source files under `assets/pyq/` or
`assets/cereb/`.

**Gate:** `report.json` shows ~15,363 duplicates removed; no output file over 1 MB; total question count
after dedup is reported and reconciles against 49,293; the four container banks are routed to a separate
`mockTests` section in `index.json`; `Anaesthesia`/`Anesthesia` and `Orthopaedics`/`Orthopedics` each appear
once.

### Phase 2 — Shell and design system

`index.html` with the tokens from §5, the theme toggle applied before first paint, the app shell (header,
screen container, bottom nav), the toast helper, and the XHR data helper from §6. No question logic yet.

**Gate:** loads in under 1s on a cold cache; theme survives reload with no white flash; renders correctly at
360 px, 768 px, and 1280 px; passes a Lighthouse PWA audit for installability; no network request to any
third-party host except Google Fonts.

### Phase 3 — Browse

Home screen with hero tile and mode cards → source screen (PYQ / CEREB / Mock Tests) → subject grid →
session-or-topic list with per-item counts. All driven by `data/index.json`. Back navigation must work,
including the Android hardware back button.

**Gate:** every one of the 18 PYQ subjects and 18 CEREB banks is reachable in at most four taps; every count
shown matches the manifest; no question file has been fetched yet at this point (check the network panel).

### Phase 4 — Quiz runner

One question per screen. Options as large tap targets. On selection: lock the answer, colour correct green
and chosen-wrong red, reveal the sanitized explanation HTML, enable Next. Progress bar. Question counter.
Bookmark toggle. Pause/exit that offers to save progress.

**Gate:** run a full 50-question session on a phone-sized viewport without a layout shift or a scroll trap;
explanation HTML renders with lists and line breaks intact; a stub explanation shows the flagged-state UI,
not an empty box; a remote image shows the offline placeholder with airplane mode on; no XSS from a crafted
`detail` string (test one).

### Phase 5 — Grand Test session and analysis

This is the headline feature and the largest single phase. Budget for it accordingly; do not fold it into
Phase 4.

**The test itself.** A GT session is a full paper from §2's table, run under exam conditions:

- **Paper picker** — the 229 papers, grouped by source, sorted newest first (dates are already parseable),
  showing question count, duration and whether the user has attempted it before. Papers under ~50 questions
  are labelled "quiz", not "grand test".
- **Marking scheme is a setting, not an assumption.** Default `+1 / 0 / 0` (correct / wrong / skipped) with
  a negative-marking option (`+4 / −1` is the common coaching mock scheme). Never hardcode one — different
  exams differ and the data does not record which applies.
- **Timer** — default 1 minute per question, rounded to the nearest 5 minutes, user-overridable. Counts
  down, warns at 10 minutes and 1 minute, **auto-submits at zero**. Elapsed time is persisted continuously,
  so a crash or a phone call does not lose the sitting.
- **Question palette** — the grid every Indian test-taker expects: numbered cells colour-coded answered /
  unanswered / marked-for-review / answered-and-marked, tappable to jump. It is the primary navigation
  during a GT; a plain Next button is not enough for a 200-question paper.
- **Per-question controls** — Save & Next, Clear Response, Mark for Review & Next.
- **No feedback during the test.** Correct answers and explanations stay hidden until submit. Enforce this
  in the data layer — do not ship the answer key to the DOM and rely on CSS to hide it.
- **Submit** — confirmation dialog showing the counts of answered, unanswered and marked.
- **Record per-question time** as the session runs. The analysis screen is far more useful with it and it
  cannot be reconstructed afterwards.

**The analysis.** This is what makes the mode worth building, so give it a real screen, not a modal:

1. **Result header** — score against the chosen scheme, accuracy, attempted / correct / wrong / skipped,
   total time, and comparison against the user's previous attempts of the same paper.
2. **Subject-wise breakdown** — accuracy and average time per subject, weakest three called out. This
   depends on the classification described below.
3. **Time analysis** — time per question, with the questions where the user spent over ~2 minutes flagged,
   split by whether that time bought a correct answer or not.
4. **Question review** — the full list, filterable by *wrong / skipped / marked / correct / all*. Each entry
   shows the question, every option with the user's choice and the correct one both marked, the time spent,
   and the **full sanitized explanation HTML**. This is the "analyse it, explanation and all" the app exists
   for; it should be the most polished screen in the build.
5. **Mistake bank** — every wrong and skipped question flows into a persistent bank that the review and
   bookmark screens read, so a GT feeds later study instead of ending at a score.
6. **Export** the whole analysis as JSON.

**The subject-classification problem.** Container-file questions all carry
`subject: "Grand Tests"`. Only 5.3% (1,846 of 34,792) can be resolved to a real subject by exact text
match against the subject-tagged banks, so a subject-wise breakdown cannot be built from the data as it
ships. Resolve it **at build time, in Phase 1's script, baked into `index.json`** — never at runtime:

- First pass: exact and near-exact text match against the 12,426 subject-tagged questions (recovers ~5%).
- Second pass: a keyword lexicon per subject, built from the subject-tagged corpus. Store a
  `subjectConfidence` alongside the guess.
- Anything still unresolved is labelled **"Unclassified"** in the UI and excluded from the subject
  breakdown's denominators. Show the unclassified count honestly rather than silently distributing it.
- If an LLM pass is used to classify, it runs **once, offline, at build time**, and its output is committed
  as data. The app itself never calls a model.

**Gate:** a full 200-question paper runs start to finish on a phone with the timer accurate to within 2
seconds over the sitting; the palette reflects state correctly for all four states; force-killing the app
mid-paper and relaunching restores the exact question, every saved answer, every review mark, and the
correct remaining time; the answer key is provably absent from the DOM before submit (check in devtools);
the analysis screen renders every section with real numbers; subject breakdown reports its unclassified
count; a wrong answer appears in the mistake bank afterwards.

### Phase 6 — Persistence

IndexedDB attempt history, resume-in-progress sessions, bookmarks screen, and a stats screen (attempted,
accuracy, per-subject breakdown) spanning both practice and GT sessions. Export/import of all user data as a
single JSON file.

**Gate:** kill the app mid-session and relaunch — the session resumes at the right question with prior
answers intact; export then import into a cleared profile reproduces identical stats, GT history included;
private-browsing mode still renders the app (degraded, not broken).

### Phase 7 — Offline and packaging

Service worker precaching the shell and `index.json`, with a runtime cache for question shards. Copy the
`deploy-pages.yml` and `build-apk.yml` workflows from `Medqbank`. Point the Pages workflow at the assets
directory.

**Gate:** load once online, switch to airplane mode, force-reload — the app boots, browsing works, and any
already-visited shard is answerable. The APK builds green in Actions and the artifact installs and runs on
a real device.

**Service-worker warning:** the git history of `Case-simulator` records a bug where a stale service worker
answered JS requests with HTML and white-screened the app (commit `5d55930`). Version your cache name, call
`skipWaiting()` + `clients.claim()`, never serve `index.html` as a fallback for a `.js` or `.json` request,
and ship a `?reset` query parameter that unregisters the worker and clears caches.

### Phase 8 — QA gate

Full pass on a real Android device and a desktop browser. Verify every gate above still holds. Produce a
short release note listing what shipped, what did not, and every known limitation.

**"No bugs" is a process, not a wish.** The gates above catch feature bugs; this phase catches the ones that
only appear in combination. Run each of these deliberately and record the result:

| Class | The specific test |
|---|---|
| **Timer drift** | Compare a GT timer against a wall clock over a full 200-question sitting. Drift comes from `setInterval` accumulating error — derive remaining time from a stored end timestamp, never by decrementing a counter. |
| **Backgrounding** | Background the app mid-GT for 5 minutes and return. Time must have advanced correctly, not frozen. |
| **Interruption** | Force-kill mid-GT, mid-practice, and mid-explanation. Relaunch each time. |
| **Rotation** | Rotate the device on every screen. Nothing may lose state or clip. |
| **Rapid input** | Double-tap Submit, Next, and an option. No double-advance, no double-scored answer. |
| **Back button** | Hardware back on every screen, including mid-GT. It must never silently discard a sitting. |
| **Empty and edge states** | A 28-question paper, a paper with a 3-option question, a subject with zero bookmarks, a fresh install with no history, an all-skipped GT (0 attempted — check for a divide-by-zero in accuracy). |
| **Storage failure** | Private-browsing mode, and a full quota. The app degrades; it does not white-screen. |
| **Offline** | Airplane mode from cold boot, and airplane mode toggled on mid-GT. |
| **Stale worker** | Deploy an update over an installed copy and confirm the new version loads. This is the exact failure that white-screened a sibling repo. |
| **Injection** | A question whose `explanation.detail` contains `<img src=x onerror=alert(1)>`. Nothing executes. |

Write these up as a checklist in the repo and re-run it before every release, not just this one.

---

## 8. Non-negotiables

These are the rules that come from things that have already gone wrong in these repos.

1. **Never `fetch()` a local file.** Use the XHR helper with the `file:///android_asset/` fallback. (§6)
2. **Never render `explanation.detail` with raw `innerHTML`.** Sanitize through an allowlist. (§4)
3. **Never depend on a CDN at runtime.** No Font Awesome, no CDN jQuery, no remote CSS. Google Fonts is the
   single permitted exception, and the app must be fully usable when it fails to load.
4. **Never white-screen.** Wrap boot in `try/catch`, render a visible error with a reset link on failure.
   (`Case-simulator` commits `5d9bc51`, `5d55930`.)
5. **Never load a multi-megabyte JSON file inside a tap handler.** Shard in Phase 1; load lazily with a
   spinner.
6. **Never mutate the source data files.** `assets/pyq/` and `assets/cereb/` are read-only inputs. All
   derived data goes to a new directory.
7. **Never commit build artifacts.** `medquiz-app` has `android/app/build/` checked in; do not repeat it.
   Add a `.gitignore` first.
8. **Never claim a phase gate passed without running it.** Paste the actual output.
9. **Never derive a countdown by decrementing a counter on an interval.** Store the end timestamp and
   compute remaining time from `Date.now()`, or the timer drifts and stops entirely when the app is
   backgrounded.
10. **Never send the answer key to the client during a GT.** Hiding it with CSS or a JS flag is not hiding
    it. Withhold it in the data layer until submit.
11. **Never classify, score, or dedupe at runtime what can be done at build time.** The phone does lookups;
    the build script does the thinking.

---

## 9. Verification checklist

Run this before declaring the app done.

- [ ] Every subject and bank reachable; counts match the manifests
- [ ] Dedup report reconciles to the 49,293 total
- [ ] `grand_tests.json` containment verified before it was dropped
- [ ] All 229 GT papers launchable; timer accurate over a full sitting; palette states correct
- [ ] GT survives a force-kill with answers, marks and remaining time intact
- [ ] Answer key absent from the DOM before GT submit
- [ ] Analysis screen renders every section; unclassified count reported honestly
- [ ] Wrong answers land in the mistake bank
- [ ] Phase 8 bug-class table run in full, results recorded
- [ ] Explanations render with formatting; stubs are flagged, not blank
- [ ] Remote images degrade gracefully offline; no broken-image icons
- [ ] Airplane-mode cold boot works
- [ ] Session resumes after a force-kill
- [ ] Export → wipe → import round-trips
- [ ] Theme persists with no flash-of-wrong-theme
- [ ] Hardware back button navigates, never exits mid-question without a prompt
- [ ] No third-party network requests beyond Google Fonts
- [ ] APK builds in CI and installs on a device
- [ ] No file in `data/` over 1 MB
- [ ] No `innerHTML` on unsanitized data anywhere in the source

---

## 10. Prompt template

For handing a single phase to an agent:

```
You are building the PYQ app specified in docs/PYQ_APP_BUILD_WORKFLOW.md.

Repo:   koushalterupally-source/Medqbank
Branch: <branch>
Phase:  <N> — <name>

Read §1–§6 of the brief for context, then §7 Phase <N> for your scope.
Do only that phase. Respect every rule in §8.

When done, run the Phase <N> gate and paste the real output — not a description
of it. If a gate fails, fix it before reporting. If a gate cannot pass for a
reason outside this phase's scope, stop and say exactly what is blocking.

Do not add a framework, a bundler, or a package manager.
Do not modify anything under assets/pyq/ or assets/cereb/.
```

---

## Appendix — measured corpus figures

| | PYQ | CEREB | Total |
|---|---|---|---|
| Files (excl. manifest) | 18 | 18 | 36 |
| Questions | 4,692 | 44,601 | 49,293 |
| Unique question texts | 2,877 | — | 33,930 |
| Raw JSON | ~42 MB | ~52 MB | 97.6 MB |

Largest files: `cereb/grand_tests_2.json` (9,605 q, 10.9 MB), `cereb/grand_tests.json` (9,412 q, 10.6 MB —
a strict subset of the former), `cereb/previous_year_tests.json` (8,290 q, 10.2 MB),
`cereb/best_of_the_rest.json` (6,446 q, 5.2 MB).

Mock papers available to Grand Test mode: **229 total**, or **165 after dropping the redundant
`grand_tests.json`**. Every paper's name ends in a parseable `YYYY-MM-DD`, spanning 2017-05-07 to
2025-07-15. Median paper length is 196–199 questions.

Subjects present across both banks, after canonicalization: Anatomy, Anaesthesia, Biochemistry, Dermatology,
ENT, Forensic Medicine, Medicine, Microbiology, Obstetrics & Gynaecology, Ophthalmology, Orthopaedics,
Pathology, Pharmacology, Physiology, Preventive & Social Medicine, Psychiatry, Radiology, Surgery.

PYQ exam sessions available as filters: AIIMS 2017–2020, NEET 2018–2021, NEET 2023–2024, INI-CET 2021–2024.
