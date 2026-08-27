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

Core loop: pick a question source → pick a subject → pick a session/topic → answer MCQs one at a time →
see the explanation immediately → progress and mistakes are saved locally → resume later.

**It must work with the plane on airplane mode.** No server, no login, no API key required for the core loop.

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
5. **Canonicalize subject names** through an explicit map. Route the four container files to a separate
   "Mock Tests" section rather than into the subject grid.

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

97.6 MB raw, roughly 25 MB gzipped (measured: `grand_tests.json` is 10.6 MB raw, 2.4 MB gzipped). GitHub
Pages gzips automatically; the Android build compresses assets in the APK. Both are acceptable.

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

### Phase 5 — Persistence

IndexedDB attempt history, resume-in-progress sessions, bookmarks screen, and a stats screen (attempted,
accuracy, per-subject breakdown). Export/import of all user data as a single JSON file.

**Gate:** kill the app mid-session and relaunch — the session resumes at the right question with prior
answers intact; export then import into a cleared profile reproduces identical stats; private-browsing mode
still renders the app (degraded, not broken).

### Phase 6 — Offline and packaging

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

### Phase 7 — QA gate

Full pass on a real Android device and a desktop browser. Verify every gate above still holds. Produce a
short release note listing what shipped, what did not, and every known limitation.

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

---

## 9. Verification checklist

Run this before declaring the app done.

- [ ] Every subject and bank reachable; counts match the manifests
- [ ] Dedup report reconciles to the 49,293 total
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

Largest files: `cereb/grand_tests_2.json` (9,605 q, 10.9 MB), `cereb/grand_tests.json` (9,412 q, 10.6 MB),
`cereb/previous_year_tests.json` (8,290 q, 10.2 MB), `cereb/best_of_the_rest.json` (6,446 q, 5.2 MB).

Subjects present across both banks, after canonicalization: Anatomy, Anaesthesia, Biochemistry, Dermatology,
ENT, Forensic Medicine, Medicine, Microbiology, Obstetrics & Gynaecology, Ophthalmology, Orthopaedics,
Pathology, Pharmacology, Physiology, Preventive & Social Medicine, Psychiatry, Radiology, Surgery.

PYQ exam sessions available as filters: AIIMS 2017–2020, NEET 2018–2021, NEET 2023–2024, INI-CET 2021–2024.
