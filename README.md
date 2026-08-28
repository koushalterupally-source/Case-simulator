# PYQ

An offline-first question-bank app for Indian PG medical entrance prep — NEET-PG, INI-CET, AIIMS.

Three ways to study, over one data layer:

- **QBank** — browse by subject, then by exam session (PYQ), topic (CEREB) or chapter (Arrow), with
  the explanation revealed the moment you answer.
- **Grand Tests** — sit one of 165 full-length mock papers under exam conditions: countdown, question
  palette, mark-for-review, no feedback until you submit. Then a real analysis — score, subject-wise
  accuracy, time per question, and every question reviewable with its full explanation.
- **Anki** — spaced repetition over a curated high-yield deck and over your own mistakes and
  bookmarks, scheduled by SM-2.

No server, no login, no API key. It works in airplane mode.

The app lives in [`pyq-app/`](pyq-app/) — see its README for building, testing and the data pipeline,
and `pyq-app/ARCHITECTURE.md` for the decisions that are not obvious.

## The clinical case simulator

The simulator moved to its own repository:
**[koushalterupally-source/clinical-case-simulator](https://github.com/koushalterupally-source/clinical-case-simulator)**

The two still ship as one product. `pyq-app/build/stage.sh` assembles a single site with the PYQ app
at the root and the simulator at `/simulator/`, sharing one origin, one palette and one theme
setting. It finds the simulator via `SIMULATOR_SRC` if you point it at a checkout, and clones it
otherwise:

```bash
git clone --depth 1 https://github.com/koushalterupally-source/Medqbank /tmp/medqbank

SIMULATOR_SRC=/path/to/clinical-case-simulator \
  bash pyq-app/build/stage.sh /tmp/medqbank/android/app/src/main/assets dist
```

## Where the questions come from

None of it is committed here — it is derived data, rebuilt from source on every build.

| Source | Questions | Repository |
|---|---:|---|
| PYQ + CEREB | 12,426 practice, 165 mock papers | [`Medqbank`](https://github.com/koushalterupally-source/Medqbank) |
| Arrow *(optional)* | 16,278 | [`thesauceypotato/Medtrix-Android-Final`](https://github.com/thesauceypotato/Medtrix-Android-Final) — a third party's |

## Tests

```bash
cd pyq-app && node --test          # engine, scheduler, sanitizer, module graph
cd pyq-app && node tests/smoke.mjs # the whole app, driven in Chromium
```
