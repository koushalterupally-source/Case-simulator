# PYQ

An offline-first previous-year-question app for NEET-PG / INI-CET / AIIMS preparation, built on the
question bank already sitting in [`koushalterupally-source/Medqbank`](https://github.com/koushalterupally-source/Medqbank).

Two modes over one data layer:

- **Practice** — browse by subject, then by exam session (PYQ) or topic (CEREB); answer one question at a
  time with the explanation revealed immediately.
- **Grand Test** — sit one of 229 full-length mock papers under exam conditions: countdown, question
  palette, mark-for-review, no feedback until you submit. Then a real analysis: score, subject-wise
  accuracy, time per question, and every question reviewable with its full explanation.

No server, no login, no API key. It works in airplane mode.

## Building the data

The app ships no question data in git — it is derived, and about 90 MB. Generate it from the Medqbank
assets:

```bash
git clone --depth 1 https://github.com/koushalterupally-source/Medqbank /tmp/medqbank

python3 build/build_index.py \
  --src /tmp/medqbank/android/app/src/main/assets \
  --out data

python3 build/verify_index.py --dir data
```

`verify_index.py` exits non-zero if anything is inconsistent — a dangling shard reference, a `.q.json`
without its matching `.a.json`, a file over 1 MB, an out-of-range answer index. Run it after every build.

### Arrow (optional third practice source)

Arrow is the question bank behind Medtrix's `medical-mcq-engine` — 19 subjects, ~16,400 questions,
already tagged with real subjects (no Naive Bayes guessing needed). It lives in a **third party's**
public repo, [`thesauceypotato/Medtrix-Android-Final`](https://github.com/thesauceypotato/Medtrix-Android-Final)
— not this account's, not the Medqbank corpus's. Exactly like Medqbank, its data is built from source at
build time and **is never committed to this repo**. That is deliberate: whether it may be redistributed
is not a question this repo should answer by quietly vendoring 20 MB of someone else's data.

Building it in is opt-in — pass `--arrow`:

```bash
git clone --depth 1 https://github.com/thesauceypotato/Medtrix-Android-Final /tmp/medtrix

python3 build/build_index.py \
  --src /tmp/medqbank/android/app/src/main/assets \
  --arrow /tmp/medtrix/medical-mcq-engine \
  --out data

python3 build/verify_index.py --dir data
```

(`/tmp/medtrix` also carries ~700 MB of question images under `medical-mcq-engine/data/images/` —
untouched by the build; the app works fully offline without them, same as the Medqbank corpus's own
remote images.)

Omitting `--arrow` leaves the build byte-for-byte the same as without this source — that's what CI
runs. `build/stage.sh` takes the same option as the optional `ARROW_SRC` environment variable.

Two things Arrow needed handling for that Medqbank didn't. Its `correct_option` is a letter, not an
index, so it is converted rather than assumed — and a record whose letter names an option that does
not exist in its own options list is **excluded and reported loudly** in `report.json`
(`arrow.correctOptionOutOfRange`) rather than silently defaulted to option 0, because a wrong answer
key is the worst possible bug here. Its explanations are plain text rather than HTML, so they are
escaped and wrapped in paragraphs at build time to render consistently with the other sources.

## Running it

```bash
python3 -m http.server 8000     # any static server; the app is plain files
# then open http://localhost:8000/
```

`?reset` on the URL unregisters the service worker, clears caches and drops the local database — the way
out of a wedged install.

## Tests

```bash
node --test          # from this directory; recursive discovery needs no path argument
```

Covers the Grand Test engine (timing, palette state, scoring, subject attribution) and the HTML sanitizer
(XSS payloads, allowlist behaviour). Both are pure modules, deliberately, so they are testable without a
browser.

## Layout

```
index.html            shell; applies the theme before first paint
sw.js                 service worker
src/
  net.js              the only loader — XHR with a file:///android_asset fallback
  sanitize.js         allowlist HTML sanitizer
  store.js            IndexedDB, with an in-memory fallback
  ui.js               theme, toasts, router, dialogs
  data.js             catalog and shard access, answer-key locking
  dom.js              element helpers; the single path corpus markup takes into the DOM
  gt.js               Grand Test engine — pure, no DOM
  practice.js         practice engine — pure, no DOM
  screens/            one module per screen
build/
  build_index.py      source assets -> catalog + shards
  verify_index.py     consistency checker
```

## Why it is built this way

`ARCHITECTURE.md` is the binding spec and explains the decisions that are not obvious, including four
corrections made after measuring the source data:

1. There is no global question index — a catalog plus self-describing shards.
2. Questions and answers live in separate files, so a Grand Test genuinely cannot see the answer key
   before you submit.
3. Deduplication never touches a mock paper; removing a question would corrupt the paper.
4. Question text is HTML in 22.5% of records, and for 11,005 of them the image *is* the question.

Two constraints are load-bearing and easy to break by accident:

- **Never `fetch()` a local file.** It works in a desktop browser and fails silently in an Android
  WebView. Everything goes through `net.js`.
- **Never decrement a timer.** `gt.js` stores an absolute end timestamp; a counter decremented on an
  interval drifts over three hours and stops entirely when the app is backgrounded.
