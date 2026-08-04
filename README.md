# Medtrix PYQ CCS Engine & Clinical Simulator

An offline-first, deterministic clinical case simulation platform designed for medical education (USMLE Step 3 CCS & INI-CET Clinical Reasoning).

## Features

- **Offline-First PWA Architecture**: Built with Service Workers (`public/sw.js`) and Web Application Manifest (`public/manifest.webmanifest`) to run completely offline without server dependencies.
- **PYQ Index Engine**: Parses and manages thousands of Previous Year Questions (NEET-PG, INI-CET, USMLE) with automatic subject/system categorizations, role tags (`EMERGENCY`, `DIAGNOSIS`, `INVESTIGATION`, `MANAGEMENT`, `PHARM`), and draft flag handling for missing answer sources.
- **Clinical Simulation Loop (`ccsEngine.ts`)**:
  - Deterministic turn-based clock arithmetic supporting multi-day timelines past Day 10.
  - Realistic order turnaround times (e.g. STAT ECG vs outpatient echo) and result delivery.
  - Dynamic patient vitals deterioration if critical interventions are omitted beyond target milestones.
- **Decision Gate Binding**:
  - Binds clinical decision milestones to real PYQs.
  - Standard Mode (MCQ) & Blind Mode (free-text commitment with clinical synonym matching and self-review fallbacks).
  - Strict answer leak prevention: uncommitted gates hide concept answers and future gates are locked.
- **USMLE/INI-CET Scorecard**:
  - Evaluates decision gate accuracy, incidental actionable findings, over-ordering penalties, and critical delays.
  - Clamped score output (0–100) with explicit mathematical formula display.
- **Runtime Error Shield**: Built-in React `ErrorBoundary` prevents application white-screening during runtime edge cases, allowing session recovery or restart.

## Getting Started

### Development
```bash
npm install
npm run dev
```

### Type Checking & Linting
```bash
npm run lint
```

### Run Verification Test Suite
```bash
npm test
```

### Build for Production
```bash
npm run build
```

## Growing the question bank

Cases are assembled by binding real exam questions to authored clinical
scaffolds, so how good a case is depends on how many questions the bank holds
*about that condition*. The shipped bank of 8,211 questions is thin in places —
the cardiology case has only a handful of myocardial-infarction questions to
draw on, and none of the 8,211 carry a written explanation, so the panel shown
after you commit an answer is usually blank.

[MedMCQA](https://github.com/medmcqa/medmcqa) (MIT) is the natural source to
grow it with: 193,155 AIIMS and NEET-PG questions — the same two exams — across
2,400 topics, each with an explanation. It is catalogued under "Text dataset" in
openmedlab's [Awesome-Medical-Dataset](https://github.com/openmedlab/Awesome-Medical-Dataset).

The data files are not in this repository. Download them from the dataset's own
distribution, then:

```bash
# See what would be imported without writing anything
npm run import:medmcqa -- path/to/train.json --dry-run

# Add a curated slice to the existing bundles
npm run import:medmcqa -- path/to/train.json --merge --subjects Medicine,Surgery,Pediatrics
```

Everything written to `public/pyq-index/` is downloaded by the browser for
offline use, so curate with `--subjects` and `--limit` rather than importing all
193k at once; the importer reports the resulting bundle size and warns past
25 MB. It drops questions that cannot be played — image-dependent stems, blank
or duplicated options, multi-answer items — using the same check the runtime
binder applies, and it verifies whether the source's answer index is 0- or
1-based rather than assuming, since guessing wrong shifts every answer by one
while still looking valid.

## Data Persistence & Storage

Session data and question bank indices are stored locally in browser IndexedDB (`PYQ_CCS_Simulator_DB`) with fallbacks to `localStorage`. Full user profiles and QBank indices can be exported or imported as JSON files from the PYQ Index Builder view.
