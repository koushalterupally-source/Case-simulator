/**
 * Imports MedMCQA into the app's offline question bundles.
 *
 *   npx tsx scripts/import-medmcqa.ts <train.json> [more.json ...] [options]
 *
 * MedMCQA (https://github.com/medmcqa/medmcqa, MIT) is 193,155 AIIMS and
 * NEET-PG multiple-choice questions — the same two exams this simulator is
 * built around. It is listed under "Text dataset" in openmedlab's
 * Awesome-Medical-Dataset catalogue.
 *
 * Why it is worth importing, concretely. Two numbers from the currently shipped
 * bank of 8,211 questions:
 *
 *   - 100% of them have an empty `explanation`, and 88% have no `conceptTested`
 *     either. The panel the app shows after you commit an answer — the one
 *     place a question can actually teach — renders blank almost every time.
 *     MedMCQA ships a written explanation per question (~66 tokens on average).
 *
 *   - The word "STEMI" occurs zero times in the whole bank, and only a handful
 *     of questions are about myocardial infarction at all, so the cardiology
 *     case has almost nothing to ask. Breadth is the fix, and MedMCQA is
 *     roughly 23× the size across 2.4k topics.
 *
 * The data files are not in the git repository; fetch them from the project's
 * own distribution (HuggingFace `openlifescienceai/medmcqa`, or the download
 * link on medmcqa.github.io) and pass the paths in. Both JSON-lines and a
 * plain JSON array are accepted.
 *
 * Options:
 *   --merge              Add to the existing bundles instead of replacing them.
 *   --limit N            Keep at most N questions (after filtering).
 *   --subjects A,B       Keep only these MedMCQA subject_name values.
 *   --cop-base 0|1       Force the `cop` answer index base instead of detecting it.
 *   --dry-run            Report what would be written, write nothing.
 *
 * Size matters here: the whole dataset is ~144 MB, and everything written to
 * public/pyq-index/ is downloaded by the browser for offline use. Curate with
 * --subjects and --limit rather than importing all 193k by default.
 */
import fs from 'fs/promises';
import path from 'path';
import { isUsableAsGate, cleanStem } from '../src/utils/questionQuality';
import { PYQItem } from '../src/types';

interface MedMcqaRecord {
  id: string;
  question: string;
  opa: string;
  opb: string;
  opc: string;
  opd: string;
  /** Index of the correct option. Base differs between distributions — see resolveCopBase. */
  cop: number | null;
  choice_type?: string;
  exp?: string | null;
  subject_name?: string;
  topic_name?: string | null;
}

/** MedMCQA subject names -> the subject labels this app groups bundles by. */
const SUBJECT_MAP: Record<string, string> = {
  'Anatomy': 'Anatomy',
  'Physiology': 'Physiology',
  'Biochemistry': 'Biochemistry',
  'Pharmacology': 'Pharmacology',
  'Pathology': 'Pathology',
  'Microbiology': 'Microbiology',
  'Forensic Medicine': 'Forensic Medicine',
  'Social & Preventive Medicine': 'Community Medicine',
  'Medicine': 'Medicine',
  'Surgery': 'Surgery',
  'Gynaecology & Obstetrics': 'Obstetrics & Gynaecology',
  'Obstetrics & Gynaecology': 'Obstetrics & Gynaecology',
  'Pediatrics': 'Pediatrics',
  'ENT': 'ENT',
  'Ophthalmology': 'Ophthalmology',
  'Orthopaedics': 'Orthopedics',
  'Anaesthesia': 'Anesthesia',
  'Radiology': 'Radiology',
  'Psychiatry': 'Psychiatry',
  'Skin': 'Dermatology',
  'Dental': 'Dental',
  'Unknown': 'Medicine',
};

/**
 * Body system, inferred from the subject so gate binding has something to match
 * on. The bank's own `system` field is used by the binder as a tie-breaker.
 */
const SYSTEM_MAP: Record<string, string> = {
  Medicine: 'General Medicine',
  Surgery: 'Surgery',
  'Obstetrics & Gynaecology': 'Obstetrics',
  Pediatrics: 'Pediatrics',
  Pharmacology: 'Pharmacology',
  Pathology: 'Pathology',
  Microbiology: 'Infectious Disease',
  ENT: 'ENT',
  Ophthalmology: 'Ophthalmology',
  Orthopedics: 'Musculoskeletal',
  Anesthesia: 'Critical Care',
  Radiology: 'Radiology',
  Psychiatry: 'Psychiatry',
  Dermatology: 'Dermatology',
};

/**
 * Same role classifier as the MASTER_INDEX importer: ordered most-specific
 * first, and anything genuinely unclear stays UNTAGGED rather than guessed. The
 * binder prefers a question whose role matches the milestone, so a wrong tag is
 * worse than no tag.
 */
const ROLE_RULES: [PYQItem['roleTag'], RegExp][] = [
  ['EMERGENCY', /\b(immediate|first step|initial step|emergency|resuscitat|life.?saving|cardiac arrest|unstable|crash|stat\b)/i],
  ['PREVENTION', /\b(vaccin|immunis|immuniz|prophyla|screening|prevent|counsel)\b/i],
  ['PHARM', /\b(mechanism of action|adverse effect|side effect|toxicity|antidote|contraindicat|half.?life|drug of choice|dosage|pharmacokinet|pharmacodynam)\b/i],
  ['COMPLICATION', /\b(complication|sequel|prognos|mortality|recurrence|late effect)\b/i],
  ['INVESTIGATION', /\b(investigation of choice|gold standard|best test|most useful test|confirm(?:atory)? test|diagnostic test|next investigation|imaging of choice|biopsy|culture|which test)\b/i],
  ['MANAGEMENT', /\b(treatment of choice|management|next step in management|definitive treatment|surgery of choice|therapy of choice)\b/i],
  ['DIAGNOSIS', /\b(most likely diagnosis|diagnosis is|what is the diagnosis|likely cause|characteristic of|pathognomonic)\b/i],
  ['BASIC-SCIENCE', /\b(anatom|embryolog|histolog|physiolog|biochem|enzyme|receptor|gene\b|chromosom|metabolism|pathway|nerve supply|blood supply|derived from)\b/i],
];

function classifyRole(text: string): PYQItem['roleTag'] {
  for (const [role, re] of ROLE_RULES) if (re.test(text)) return role;
  return 'UNTAGGED';
}

/** Accepts a JSON array or JSON-lines; MedMCQA ships the latter. */
function parseRecords(raw: string): MedMcqaRecord[] {
  const trimmed = raw.trim();
  if (trimmed.startsWith('[')) return JSON.parse(trimmed);
  const out: MedMcqaRecord[] = [];
  for (const line of trimmed.split('\n')) {
    const l = line.trim();
    if (!l) continue;
    try {
      out.push(JSON.parse(l));
    } catch {
      // A single malformed line must not abandon the rest of the file.
    }
  }
  return out;
}

/**
 * `cop` is 0-based in the HuggingFace distribution and 1-based in the original
 * release, and picking wrong silently shifts every answer by one — the worst
 * possible failure for a question bank, because everything still looks valid.
 * Detect it from the observed range and refuse to guess when it is ambiguous.
 */
function resolveCopBase(records: MedMcqaRecord[], override?: number): number {
  if (override === 0 || override === 1) return override;
  let min = Infinity;
  let max = -Infinity;
  for (const r of records) {
    if (typeof r.cop !== 'number') continue;
    min = Math.min(min, r.cop);
    max = Math.max(max, r.cop);
  }
  if (min === 0) return 0;
  if (max === 4) return 1;
  throw new Error(
    `Cannot tell whether 'cop' is 0- or 1-based (observed range ${min}..${max}). ` +
      `Re-run with --cop-base 0 or --cop-base 1 after checking one record by hand.`
  );
}

async function run() {
  const argv = process.argv.slice(2);
  const files = argv.filter((a) => !a.startsWith('--'));
  const flag = (name: string): string | undefined => {
    const i = argv.indexOf(`--${name}`);
    return i === -1 ? undefined : argv[i + 1];
  };
  const has = (name: string) => argv.includes(`--${name}`);

  if (files.length === 0) {
    console.error('Usage: npx tsx scripts/import-medmcqa.ts <train.json> [...] [--merge] [--limit N] [--subjects A,B] [--cop-base 0|1] [--dry-run]');
    process.exit(1);
  }

  const limit = flag('limit') ? parseInt(flag('limit')!, 10) : Infinity;
  const copBaseFlag = flag('cop-base') ? parseInt(flag('cop-base')!, 10) : undefined;
  const subjectFilter = flag('subjects')
    ? new Set(flag('subjects')!.split(',').map((s) => s.trim().toLowerCase()))
    : null;
  const dryRun = has('dry-run');
  const merge = has('merge');

  let records: MedMcqaRecord[] = [];
  for (const f of files) {
    const parsed = parseRecords(await fs.readFile(f, 'utf8'));
    console.log(`Read ${parsed.length.toLocaleString()} records from ${path.basename(f)}`);
    records = records.concat(parsed);
  }
  console.log(`\nTotal read: ${records.length.toLocaleString()}`);

  const copBase = resolveCopBase(records, copBaseFlag);
  console.log(`Answer index base: ${copBase} (${copBaseFlag !== undefined ? 'forced' : 'detected'})\n`);

  const dropped = { noAnswer: 0, multiChoice: 0, subject: 0, unusable: 0, duplicate: 0 };
  const kept: PYQItem[] = [];
  const seenIds = new Set<string>();
  const seenStems = new Set<string>();
  const LETTERS = ['A', 'B', 'C', 'D'] as const;

  for (const r of records) {
    if (kept.length >= limit) break;

    if (r.choice_type && /multi/i.test(r.choice_type)) {
      dropped.multiChoice++;
      continue;
    }

    const subject = SUBJECT_MAP[r.subject_name || ''] || 'Medicine';
    if (subjectFilter && !subjectFilter.has((r.subject_name || '').toLowerCase())) {
      dropped.subject++;
      continue;
    }

    const idx = typeof r.cop === 'number' ? r.cop - copBase : -1;
    if (idx < 0 || idx > 3) {
      dropped.noAnswer++;
      continue;
    }

    const stem = cleanStem(r.question || '');
    const options = {
      A: (r.opa || '').trim(),
      B: (r.opb || '').trim(),
      C: (r.opc || '').trim(),
      D: (r.opd || '').trim(),
    };

    if (seenIds.has(r.id)) {
      dropped.duplicate++;
      continue;
    }
    const stemKey = stem.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (seenStems.has(stemKey)) {
      dropped.duplicate++;
      continue;
    }

    const item: PYQItem = {
      qid: r.id,
      displayId: `MCQA-${subject.slice(0, 3).toUpperCase()}-${String(r.id).slice(0, 6)}`,
      sourceFile: 'medmcqa',
      exam: 'AIIMS/NEET-PG (MedMCQA)' as PYQItem['exam'],
      year: 'Unknown',
      subject: subject as PYQItem['subject'],
      system: SYSTEM_MAP[subject] || 'General',
      topic: (r.topic_name || '').trim(),
      stem,
      options,
      correctAnswer: LETTERS[idx],
      // The reason this dataset is worth importing at all: something to show
      // the user after they commit, instead of the blank panel they get today.
      explanation: (r.exp || '').trim(),
      conceptTested: (r.topic_name || '').trim(),
      roleTag: classifyRole(`${stem} ${Object.values(options).join(' ')}`),
    };

    // One gate on quality, shared with the runtime binder so what gets shipped
    // is exactly what can be played: no image-dependent stems, no fragments, no
    // blank or identical options.
    if (!isUsableAsGate(item)) {
      dropped.unusable++;
      continue;
    }

    seenIds.add(r.id);
    seenStems.add(stemKey);
    kept.push(item);
  }

  console.log('Dropped:');
  console.log(`  multi-answer          ${dropped.multiChoice.toLocaleString()}`);
  console.log(`  no usable answer      ${dropped.noAnswer.toLocaleString()}`);
  console.log(`  filtered subject      ${dropped.subject.toLocaleString()}`);
  console.log(`  duplicate             ${dropped.duplicate.toLocaleString()}`);
  console.log(`  unusable as a gate    ${dropped.unusable.toLocaleString()}`);
  const withExp = kept.filter((k) => k.explanation && k.explanation.length > 0).length;
  console.log(`\nKept ${kept.length.toLocaleString()}, of which ${withExp.toLocaleString()} ` +
    `(${((100 * withExp) / Math.max(kept.length, 1)).toFixed(1)}%) carry an explanation.\n`);

  if (kept.length === 0) {
    console.error('Nothing usable. Not writing any bundles.');
    process.exit(1);
  }

  const outDir = path.join(process.cwd(), 'public', 'pyq-index');
  const grouped: Record<string, PYQItem[]> = {};

  if (merge) {
    // Keep whatever is already shipped; MedMCQA adds to it rather than
    // replacing a bank that took work to assemble.
    let existingManifest: { subjects?: { name: string }[] } = {};
    try {
      existingManifest = JSON.parse(await fs.readFile(path.join(outDir, 'manifest.json'), 'utf8'));
    } catch {
      // No existing bundle; a merge into nothing is just an import.
    }
    for (const s of existingManifest.subjects || []) {
      const file = path.join(outDir, `subject_${s.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`);
      try {
        grouped[s.name] = JSON.parse(await fs.readFile(file, 'utf8'));
      } catch {
        // Listed in the manifest but unreadable; skip rather than abort.
      }
    }
    const already = new Set(Object.values(grouped).flat().map((i) => i.qid));
    for (const k of kept) {
      if (already.has(k.qid)) continue;
      (grouped[k.subject] ||= []).push(k);
    }
  } else {
    for (const k of kept) (grouped[k.subject] ||= []).push(k);
  }

  const subjects = Object.entries(grouped)
    .map(([name, items]) => ({ name, count: items.length }))
    .sort((a, b) => b.count - a.count);
  const totalCount = subjects.reduce((n, s) => n + s.count, 0);

  const bytes = Object.values(grouped).reduce((n, items) => n + JSON.stringify(items).length, 0);
  console.log(`Bundles: ${subjects.length} subjects, ${totalCount.toLocaleString()} questions, ` +
    `${(bytes / 1024 / 1024).toFixed(1)} MB uncompressed.`);
  if (bytes > 25 * 1024 * 1024) {
    console.warn('  ⚠ Over 25 MB. Every byte here is downloaded for offline use — ' +
      'narrow it with --subjects or --limit.');
  }

  if (dryRun) {
    console.log('\n--dry-run: nothing written.');
    return;
  }

  await fs.mkdir(outDir, { recursive: true });
  for (const [name, items] of Object.entries(grouped)) {
    const file = path.join(outDir, `subject_${name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`);
    await fs.writeFile(file, JSON.stringify(items));
  }
  await fs.writeFile(
    path.join(outDir, 'manifest.json'),
    JSON.stringify({ subjects, totalCount, updatedAt: new Date().toISOString() }, null, 1)
  );
  console.log(`\nWrote ${subjects.length + 1} files to public/pyq-index/.`);
}

run().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
