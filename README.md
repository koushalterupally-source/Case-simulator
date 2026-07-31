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

## Data Persistence & Storage

Session data and question bank indices are stored locally in browser IndexedDB (`PYQ_CCS_Simulator_DB`) with fallbacks to `localStorage`. Full user profiles and QBank indices can be exported or imported as JSON files from the PYQ Index Builder view.
