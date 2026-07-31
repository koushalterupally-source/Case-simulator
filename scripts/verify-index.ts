/**
 * Verifies a built index in public/pyq-index/ against the failure modes that
 * destroyed the previous one.
 *
 * The old index was built with `stem[:80]` and `text[:40]` per option, so every
 * question was truncated mid-sentence and unusable as a verbatim PYQ — while the
 * build still "succeeded". Run this after `npm run build:index` so a broken
 * rebuild fails loudly instead of shipping.
 *
 *   npm run verify:index
 */
import fs from 'fs/promises';
import path from 'path';

interface Rec {
  qid: string;
  displayId?: string;
  sourceFile?: string;
  exam?: string;
  year?: number | string;
  subject?: string;
  system?: string;
  topic?: string;
  stem: string;
  options: { A: string; B: string; C: string; D: string };
  correctAnswer: string;
  explanation?: string;
  conceptTested?: string;
  roleTag?: string;
}

const outDir = path.join(process.cwd(), 'public', 'pyq-index');

function pct(n: number, total: number): string {
  return total ? `${n} (${((100 * n) / total).toFixed(1)}%)` : '0';
}

async function run() {
  let files: string[];
  try {
    files = (await fs.readdir(outDir)).filter((f) => f.startsWith('subject_') && f.endsWith('.json'));
  } catch {
    console.error(`✗ ${outDir} does not exist. Run "npm run build:index" first.`);
    process.exit(1);
  }

  if (files.length === 0) {
    console.error(`✗ No subject bundles in ${outDir}. The build wrote nothing — treat it as failed.`);
    process.exit(1);
  }

  const records: Rec[] = [];
  for (const f of files) {
    const parsed = JSON.parse(await fs.readFile(path.join(outDir, f), 'utf8'));
    if (Array.isArray(parsed)) records.push(...parsed);
  }

  const n = records.length;
  console.log(`\nLoaded ${n} records from ${files.length} subject bundles.\n`);

  const failures: string[] = [];
  const check = (ok: boolean, label: string, detail = '') => {
    console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failures.push(label);
  };

  // ---- The truncation bug that ruined the last index -----------------------
  console.log('--- Truncation ---');
  const ellipsis = records.filter((r) => r.stem?.trimEnd().endsWith('...'));
  const stemLens = records.map((r) => (r.stem || '').length);
  const maxStem = stemLens.length ? Math.max(...stemLens) : 0;
  const avgStem = stemLens.length ? Math.round(stemLens.reduce((a, b) => a + b, 0) / stemLens.length) : 0;

  check(ellipsis.length === 0, 'No stem ends in "..."', pct(ellipsis.length, n));
  // The old index capped at 83 chars. A healthy bank has stems well past that.
  check(maxStem > 200, 'Longest stem exceeds 200 chars', `max ${maxStem}, mean ${avgStem}`);

  const optTrunc = records.filter((r) =>
    (['A', 'B', 'C', 'D'] as const).some((k) => (r.options?.[k] || '').trimEnd().endsWith('...'))
  );
  check(optTrunc.length === 0, 'No option text ends in "..."', pct(optTrunc.length, n));

  // ---- Answer integrity ----------------------------------------------------
  console.log('\n--- Answers ---');
  const validLetters = new Set(['A', 'B', 'C', 'D', 'ANSWER-NOT-IN-SOURCE']);
  const badAnswer = records.filter((r) => !validLetters.has(r.correctAnswer));
  check(badAnswer.length === 0, 'Every correctAnswer is A–D or ANSWER-NOT-IN-SOURCE', pct(badAnswer.length, n));

  const answered = records.filter((r) => r.correctAnswer !== 'ANSWER-NOT-IN-SOURCE');
  const notInSource = n - answered.length;
  console.log(`     ANSWER-NOT-IN-SOURCE: ${pct(notInSource, n)} (excluded from graded gates)`);

  // All-'A' was the single worst defect in the shipped placeholder bank.
  const dist: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
  for (const r of answered) if (dist[r.correctAnswer] !== undefined) dist[r.correctAnswer]++;
  const maxShare = answered.length ? Math.max(...Object.values(dist)) / answered.length : 0;
  check(
    maxShare < 0.5,
    'No single answer letter dominates',
    Object.entries(dist).map(([k, v]) => `${k}:${v}`).join(' ')
  );

  // An answer pointing at an empty option is unanswerable.
  const emptyCorrect = answered.filter((r) => {
    const k = r.correctAnswer as 'A' | 'B' | 'C' | 'D';
    return !(r.options?.[k] || '').trim();
  });
  check(emptyCorrect.length === 0, 'Correct option is never empty', pct(emptyCorrect.length, n));

  // ---- Derived metadata ----------------------------------------------------
  console.log('\n--- Derived fields ---');
  const emptyTopic = records.filter((r) => !(r.topic || '').trim());
  check(emptyTopic.length < n * 0.2, 'Topic populated on >80% of records', pct(emptyTopic.length, n));

  // 54% of the old index's "concept" field just restated the answer.
  const leaky = records.filter((r) => /^(ans|correct|option|solution)/i.test((r.conceptTested || '').trim()));
  check(leaky.length === 0, 'No conceptTested restates the answer', pct(leaky.length, n));

  const roles: Record<string, number> = {};
  for (const r of records) roles[r.roleTag || 'UNTAGGED'] = (roles[r.roleTag || 'UNTAGGED'] || 0) + 1;
  const topRole = Object.entries(roles).sort((a, b) => b[1] - a[1])[0];
  // The old classifier put 67% in DIAGNOSIS because it was both the broadest
  // bucket and the fallback, which makes the role arc unbuildable.
  check(
    !!topRole && topRole[1] / n < 0.5,
    'No single role tag exceeds 50%',
    Object.entries(roles).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(' ')
  );

  const dupes = n - new Set(records.map((r) => r.qid)).size;
  check(dupes === 0, 'QIDs are unique', `${dupes} duplicates`);

  const noProvenance = records.filter((r) => !(r.sourceFile || '').trim());
  check(noProvenance.length === 0, 'Every record keeps its sourceFile', pct(noProvenance.length, n));

  // ---- Sample for eyeballing ----------------------------------------------
  console.log('\n--- Random sample (read these; the checks above cannot judge medicine) ---');
  for (let i = 0; i < Math.min(3, n); i++) {
    const r = records[Math.floor(Math.random() * n)];
    console.log(`\n  [${r.displayId || r.qid}] ${r.subject} / ${r.roleTag}  (${r.sourceFile})`);
    console.log(`  ${r.stem}`);
    for (const k of ['A', 'B', 'C', 'D'] as const) console.log(`     ${k}) ${r.options?.[k]}`);
    console.log(`  Answer: ${r.correctAnswer}`);
  }

  console.log(`\n${'='.repeat(60)}`);
  if (failures.length) {
    console.error(`✗ ${failures.length} check(s) FAILED:`);
    for (const f of failures) console.error(`   - ${f}`);
    console.error('\nDo not ship this index. Fix the builder and rebuild.');
    process.exit(1);
  }
  console.log(`✓ All checks passed across ${n} records.`);
}

run().catch((err) => {
  console.error('Fatal error during verification:', err);
  process.exit(1);
});
