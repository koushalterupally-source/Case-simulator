# Test coverage analysis

*Analyzed at commit `18434a2` (current `main`). The existing suite — `tests/simulator.test.ts`, run via `npm test` — passes with 53 assertions and runs in CI before every deploy.*

## First: the "dead on arrival" report, checked against reality

The bug report describing the live site as permanently stuck on "Still loading…" was verified claim by claim against the current build. Most of it does not hold at HEAD:

| Claim | Verdict |
|---|---|
| Base-path mismatch (assets 404 at domain root) | **Fixed.** `vite.config.ts` sets `base` from `VITE_BASE_PATH`; the deploy workflow passes `/Case-simulator/`. A local build with that flag produces `/Case-simulator/assets/…` paths in `index.html` *and* in the service-worker precache list. |
| No error boundary / silent crashes | **Fixed.** `src/main.tsx` wraps `<App/>` in `ErrorBoundary`, and `index.html` has a boot fallback with a capture-phase error listener, a 6-second self-heal (unregister SW + clear caches + reload once), and a `?reset=1` escape hatch. |
| Dead CDN dependencies | **Not applicable.** The production bundle contains zero external URLs; everything (React, Tailwind, icons) is bundled. The app is offline-first by design. |
| localStorage timebombs | **Fixed.** Every `localStorage`/`JSON.parse` call in `App.tsx` and `src/utils/storage.ts` is wrapped in try/catch with fallbacks (IndexedDB → localStorage → in-memory default). |
| Direct state mutation | **Not present.** `processTurnOffline` deep-clones the session (`ccsEngine.ts:181`) before mutating; React state is replaced, not mutated. |
| Rapid-click races | **Guarded** at the `App.tsx` level by the `isProcessing` flag — but untested (see below). |
| Floating-point money drift, drop-rate math, sell/inventory races, ticker animation | **Not applicable.** This is a clinical case simulator (NEET-PG/INI-CET questions), not a skin-economy game. There is no currency, no loot table, no ticker. |

**End-to-end verification:** the production build (built with `VITE_BASE_PATH=/Case-simulator/`) was served from a local `/Case-simulator/` subpath and loaded in headless Chromium. React mounted, the boot fallback was replaced, the start screen rendered, and "Start a case" launched a full case. The latest Pages deploy (Actions run #13) built exactly this commit and succeeded.

**Most likely explanation for a user still seeing "Still loading…":** a stale service worker/cached shell from one of the earlier genuinely-broken deploys (fixed in `5d9bc51` and `5d55930`). The current shell self-heals after 6 seconds, and `?reset=1` force-clears everything. If reports persist after a hard refresh, that is new information worth chasing — but nothing in the current build reproduces it.

The real lesson of that report stands, though: **nothing in CI ever boots the built app.** Unit tests passed on every one of the broken deploys too. That is the biggest hole in the safety net, and it is proposal #1 below.

## What is covered today

`tests/simulator.test.ts` is a hand-rolled assert runner (no framework) covering pure logic:

- **Sim-clock arithmetic** — midnight rollover, multi-day progression.
- **QBank parser** — one happy-path question, missing-answer flagging (`ANSWER-NOT-IN-SOURCE`, `isDraft`).
- **Gate binding & grading** — scaffold binding, topical-relevance rejection, no duplicate questions, standard grading, one blind-mode synonym match.
- **Answer-leak protection** — two independent checks that no gate's `patientContext` names its own diagnosis, across all scaffolds.
- **Gamification** — rank thresholds, streak XP, vitals severity (HR/SpO₂/BP/temp in both units).
- **Order entry** — comma splitting (bracket-aware), category inference, multi-order queuing.
- **Question-led cases** — vocabulary clustering, no repeats, uncommitted gates, no fake findings.
- **Import/export** — round-trip item *count* only.

## What is not covered

Roughly 2,600 of ~4,900 source lines — everything in `src/components/` and `src/App.tsx` — plus:

- **`generateScorecard` is imported by the test file but never called.** End-of-case scoring — the payoff of the whole simulation — has zero assertions.
- **`src/utils/storage.ts` (282 lines, 0 tests)** — the entire IndexedDB → localStorage → default fallback chain, malformed-JSON recovery, profile import/export, missed-question history.
- **`src/utils/rng.ts` (0 tests)** — PRNG determinism and option shuffling. A shuffle bug here silently grades correct answers as wrong.
- **The service worker and the `swPrecache` build plugin** — the two components that caused every real production breakage so far.
- **The question-bank data itself** — 8,211 imported questions in `public/pyq-index/` ship with no CI validation (`verify:index` exists but is not run in the deploy workflow).
- **The QBank bundle loader in `App.tsx`** fetches ~19 subject files sequentially inside one try/catch; one failed fetch discards everything already loaded. Untested behavior, observed during smoke testing.

## Proposed improvements, in priority order

### P0 — close the gap that actually burned us

1. **Production boot smoke test in CI.** After `npm run build` with `VITE_BASE_PATH=/Case-simulator/`, serve `dist/` under a `/Case-simulator/` subpath, load it in headless Chromium (Playwright), and assert: no request 404s, no page errors, `#boot-fallback` is detached (React mounted), and clicking "Start a case" renders a case. This one test catches base-path regressions, HTML-for-JS service-worker bugs, boot exceptions, and bundle 404s — the entire class of "unit tests green, site dead."
2. **Scorecard tests.** Call `generateScorecard` on sessions with known gate outcomes and assert scores, critical-delay detection (`targetMilestoneMinutes` windows), and behavior on an empty/zero-gate session (division-by-zero risk).
3. **Data-integrity gate for the question bank.** Run `verify:index` (or a test equivalent) in CI: manifest subjects match files on disk, every item parses, `correctAnswer ∈ {A,B,C,D, ANSWER-NOT-IN-SOURCE}`, four non-empty options, unique `qid`s. With 8,211 externally-imported questions, one malformed row is currently a runtime surprise.

### P1 — core logic that can corrupt a user's session

4. **`storage.ts` with `fake-indexeddb`** — save/load round-trips, the fallback chain when IndexedDB throws, malformed JSON in every localStorage key (returns default, never throws), `getMissedQIDsFromHistory` filtering, profile export→import round-trip *content* equality (the current test only checks count).
5. **RNG/shuffle invariants** — same seed ⇒ same sequence; after `shufflePYQOptions` the relabeled correct answer always points at the original correct text; all four option texts survive; over many seeds each position receives the correct answer roughly uniformly.
6. **Engine invariants** — deep-freeze the input session and assert `processTurnOffline` never touches it; pending orders deliver at the right sim time and never duplicate into `completedOrders`; sim clock never goes backwards across turns.
7. **Case-builder edge cases** — empty bank, bank with no scaffold-matching questions (throw vs. empty gates — pin down which), `missedQIDs` prioritization actually resurfaces missed questions, blind-mode grading against wrong-but-plausible synonyms (current suite tests one synonym that should pass, none that should fail).
8. **Parser breadth** — multi-question blocks, answer-format variants (`Ans: (B)`, `Answer- B`, lowercase), options containing commas/brackets, duplicate detection against the existing list, and `importQBankFromJSON` on malformed/hostile JSON.

### P2 — UI behavior, with React Testing Library

9. **Double-submit guard** — fire two rapid commands/gate answers, assert one `processTurnOffline` call (the `isProcessing` guard is load-bearing and untested).
10. **ErrorBoundary** — a child that throws renders the fallback with a reset path, not a blank screen.
11. **Gate flow** — committed gates show correctness, uncommitted gates never leak the answer into the DOM (component-level twin of the existing data-level leak test).

### Infrastructure

- **Adopt Vitest.** The project already uses Vite; Vitest adds a real runner (isolated failures, `--coverage` via v8, jsdom for component tests, watch mode) with near-zero config. Port the existing file mostly by wrapping suites in `describe`/`it` — the assertions carry over. Keep `npm test` as the entry point so `deploy.yml` doesn't change.
- **Add a coverage floor** once the P0/P1 items land (a modest `--coverage` threshold on `src/utils/**` — the pure-logic core — not the UI).
