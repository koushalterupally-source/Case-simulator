/**
 * Imports mimo's MASTER_INDEX.json into the app's question bundles — offline,
 * no network needed.
 *
 *   npx tsx scripts/import-master-index.ts <path-to-MASTER_INDEX.json>
 *
 * That file was built with stems cut to 80 characters and each option cut to
 * 40, so a large share of it cannot be used as a question: a truncated stem is
 * unanswerable and a truncated option is misleading. This importer keeps only
 * the records that survive intact and tells you exactly how many it dropped and
 * why. It never repairs, pads or invents text.
 *
 * The per-subject INDEX_*.md files are NOT usable — they have no options column
 * at all, only the correct answer, so there are no distractors to choose from.
 */
import fs from 'fs/promises';
import path from 'path';

interface RawRecord {
  qid: string;
  exam: string;
  year: number | string;
  subject: string;
  system: string;
  topic: string;
  stem: string;
  options: string;
  correct_answer: string;
  concept: string;
  role: string;
}

const VALID_ROLES = new Set([
  'EMERGENCY', 'DIAGNOSIS', 'INVESTIGATION', 'MANAGEMENT',
  'PHARM', 'COMPLICATION', 'PREVENTION', 'BASIC-SCIENCE',
]);

/**
 * The source classifier put 77% of everything in DIAGNOSIS, because that was
 * both its broadest rule set and its fallback — which makes the
 * EMERGENCY → DIAGNOSIS → INVESTIGATION → MANAGEMENT arc unbuildable. These
 * rules are ordered most-specific-first and run over the stem AND the options,
 * and anything genuinely unclear is tagged UNTAGGED rather than guessed.
 */
const ROLE_RULES: [string, RegExp][] = [
  ['EMERGENCY', /\b(immediate|first step|initial step|emergency|resuscitat|life.?saving|cardiac arrest|shock|unstable|crash|stat\b)/i],
  ['PREVENTION', /\b(vaccin|immunis|immuniz|prophyla|screening|prevent|counsel|contraindicated in pregnancy)\b/i],
  ['PHARM', /\b(mechanism of action|adverse effect|side effect|toxicity|antidote|contraindicat|half.?life|drug of choice|dose|dosage|pharmacokinet|pharmacodynam)\b/i],
  ['COMPLICATION', /\b(complication|sequel|prognos|mortality|recurrence|long.?term effect|late effect)\b/i],
  ['INVESTIGATION', /\b(investigation of choice|gold standard|best test|most useful test|confirm(?:atory)? test|diagnostic test|next investigation|imaging of choice|biopsy|culture|which test)\b/i],
  ['MANAGEMENT', /\b(treatment of choice|management|next step in management|definitive treatment|surgery of choice|therapy of choice|how (?:will|would) you manage)\b/i],
  ['DIAGNOSIS', /\b(most likely diagnosis|diagnosis is|what is the diagnosis|likely cause|identify the (?:condition|disease)|characteristic of|pathognomonic)\b/i],
  ['BASIC-SCIENCE', /\b(anatom|embryolog|histolog|physiolog|biochem|enzyme|receptor|gene\b|chromosom|metabolism|pathway|nerve supply|blood supply|derived from)\b/i],
];

function classifyRole(text: string): string {
  for (const [role, re] of ROLE_RULES) if (re.test(text)) return role;
  return 'UNTAGGED';
}

/** Stopwords for deriving a topic label from a short stem. */
const TOPIC_STOP = new Set([
  'which', 'what', 'following', 'patient', 'presents', 'with', 'the', 'and',
  'for', 'from', 'this', 'that', 'most', 'best', 'true', 'false', 'about',
  'seen', 'used', 'caused', 'due', 'not', 'all', 'except', 'given', 'below',
  'year', 'old', 'male', 'female', 'man', 'woman', 'child', 'his', 'her',
]);

/**
 * A short human label for the question, derived from its own words. Used to
 * cluster related questions into a case — never shown before the user commits.
 */
function deriveTopic(stem: string, options: Record<string, string>): string {
  const words = `${stem} ${Object.values(options).join(' ')}`
    .toLowerCase()
    .split(/[^a-z0-9-]+/)
    .filter((w) => w.length > 4 && !TOPIC_STOP.has(w));

  const freq = new Map<string, number>();
  for (const w of words) freq.set(w, (freq.get(w) || 0) + 1);

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, 3)
    .map(([w]) => w)
    .join(', ');
}

/** "A)Foo B)Bar C)Baz D)Qux" -> { A: 'Foo', ... } */
function parseOptions(raw: string): Record<string, string> | null {
  if (!raw) return null;
  const out: Record<string, string> = {};
  const parts = raw.split(/(?=\b[A-D]\))/);
  for (const part of parts) {
    const m = part.match(/^([A-D])\)\s*(.*)$/s);
    if (m) out[m[1]] = m[2].trim();
  }
  return Object.keys(out).length === 4 ? out : null;
}

/** Turn "C) Neisseria gonorrhoeae and Chlamydia" into "C", verified against the options. */
function resolveAnswer(rawAnswer: string, options: Record<string, string>): string | null {
  if (!rawAnswer) return null;
  const letter = rawAnswer.trim().match(/^\(?([A-D])[\)\.\:\s]/);
  if (!letter) return null;
  const key = letter[1];
  if (!options[key]) return null;
  return key;
}

const looksTruncated = (s: string) => /\.\.\.$/.test((s || '').trimEnd());

/**
 * Questions that depend on a picture. The source scrape kept no images, so
 * "Identify the organism from the given image" is unanswerable here no matter
 * how complete the text is. Dropped rather than shipped as a guess.
 */
const NEEDS_IMAGE =
  /\b(image|images|figure|photograph|picture|shown below|given below|marked|diagram|arrow|specimen|slide|following image)\b/i;

async function run() {
  const src = process.argv[2];
  if (!src) {
    console.error('Usage: npx tsx scripts/import-master-index.ts <path-to-MASTER_INDEX.json>');
    process.exit(1);
  }

  const raw: RawRecord[] = JSON.parse(await fs.readFile(src, 'utf8'));
  console.log(`Read ${raw.length.toLocaleString()} records from ${path.basename(src)}\n`);

  const dropped = { stem: 0, options: 0, answer: 0, optTruncated: 0, image: 0 };
  const kept: any[] = [];
  const seen = new Set<string>();

  for (const r of raw) {
    if (!r.stem || looksTruncated(r.stem)) { dropped.stem++; continue; }
    if (NEEDS_IMAGE.test(r.stem)) { dropped.image++; continue; }

    const options = parseOptions(r.options);
    if (!options) { dropped.options++; continue; }
    if (Object.values(options).some((o) => !o || looksTruncated(o))) { dropped.optTruncated++; continue; }

    const correctAnswer = resolveAnswer(r.correct_answer, options);
    if (!correctAnswer) { dropped.answer++; continue; }

    if (seen.has(r.qid)) continue;
    seen.add(r.qid);

    // The source "concept" field is usually just a restatement of the answer,
    // so it is dropped rather than shown to the player before they commit.
    const concept = /^(ans|correct|option|solution)/i.test((r.concept || '').trim())
      ? ''
      : (r.concept || '').trim();

    kept.push({
      qid: r.qid,
      displayId: `${String(r.subject).slice(0, 3).toUpperCase()}-${r.year}-${r.qid.slice(0, 5)}`,
      sourceFile: 'MASTER_INDEX.json',
      exam: String(r.exam || 'Unknown'),
      year: r.year ?? 'Unknown',
      subject: r.subject || 'Medicine',
      system: r.system || 'General',
      topic: deriveTopic(r.stem, options),
      stem: r.stem.trim(),
      options,
      correctAnswer,
      explanation: '',
      conceptTested: concept,
      // Reclassify from the full text rather than trusting the source's
      // DIAGNOSIS-heavy tagging; fall back to the source tag only if it is
      // valid and ours is inconclusive.
      // Reclassify from the full text. The source tag is NOT used as a
      // fallback: it defaulted everything it could not place to DIAGNOSIS,
      // which is the distortion being corrected here. Unclear stays UNTAGGED.
      roleTag: classifyRole(`${r.stem} ${Object.values(options).join(' ')}`),
    });
  }

  console.log('Dropped as unusable:');
  console.log(`  truncated stem       ${dropped.stem.toLocaleString()}`);
  console.log(`  options unparseable  ${dropped.options.toLocaleString()}`);
  console.log(`  truncated option     ${dropped.optTruncated.toLocaleString()}`);
  console.log(`  no verifiable answer ${dropped.answer.toLocaleString()}`);
  console.log(`  needs an image       ${dropped.image.toLocaleString()}`);
  console.log(`\nKept ${kept.length.toLocaleString()} of ${raw.length.toLocaleString()} ` +
    `(${((100 * kept.length) / raw.length).toFixed(1)}%)\n`);

  if (kept.length === 0) {
    console.error('Nothing usable. Not writing any bundles.');
    process.exit(1);
  }

  const grouped: Record<string, any[]> = {};
  for (const k of kept) (grouped[k.subject] ||= []).push(k);

  const outDir = path.join(process.cwd(), 'public', 'pyq-index');
  await fs.mkdir(outDir, { recursive: true });

  const subjects = Object.entries(grouped)
    .map(([name, items]) => ({ name, count: items.length }))
    .sort((a, b) => b.count - a.count);

  await fs.writeFile(
    path.join(outDir, 'manifest.json'),
    JSON.stringify({ subjects, totalCount: kept.length, updatedAt: new Date().toISOString() }, null, 2)
  );

  for (const [name, items] of Object.entries(grouped)) {
    const safe = name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    await fs.writeFile(path.join(outDir, `subject_${safe}.json`), JSON.stringify(items));
  }

  console.log('Per subject:');
  for (const s of subjects) console.log(`  ${s.name.padEnd(28)} ${s.count.toLocaleString()}`);
  console.log(`\nWrote ${subjects.length} bundles to public/pyq-index/`);
  console.log('Run "npm run verify:index" next, then commit public/pyq-index and push.');
}

run().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
