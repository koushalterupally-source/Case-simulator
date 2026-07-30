import fs from 'fs/promises';
import path from 'path';
import { PYQItem, RoleTag, SubjectType, ExamType } from '../src/types';

const ROLE_PATTERNS: { tag: RoleTag; pattern: RegExp }[] = [
  { tag: 'EMERGENCY', pattern: /\b(resuscitat|airway|breathing|circulation|stat|urgent|anaphylaxis|shock|cardiac arrest|immediate|triage|decompress)\b/i },
  { tag: 'MANAGEMENT', pattern: /\b(treatment|management|manage|treat|therapy|drug of choice|first line|intervention|surgical|appendectomy|laparotomy|intubate)\b/i },
  { tag: 'PHARM', pattern: /\b(pharmacology|mechanism of action|side effect|adverse|toxicity|dosage|contraindication|antidote)\b/i },
  { tag: 'INVESTIGATION', pattern: /\b(investigation|diagnostic test|imaging|x-ray|ultrasound|ct scan|mri|biopsy|culture|lumbar puncture|ecg|blood test|lab)\b/i },
  { tag: 'PREVENTION', pattern: /\b(prevent|vaccin|prophylaxis|screening|immuniz)\b/i },
  { tag: 'COMPLICATION', pattern: /\b(complication|prognosis|sequelae|recurrence|post-op)\b/i },
  { tag: 'BASIC-SCIENCE', pattern: /\b(embryology|histology|anatomical|pathophysiology|biochemical pathway|enzyme deficiency)\b/i },
  { tag: 'DIAGNOSIS', pattern: /\b(most likely diagnosis|what is the diagnosis|diagnosed with|underlying diagnosis|presents with.*diagnosis)\b/i },
];

function classifyRole(fullText: string): RoleTag {
  let bestTag: RoleTag = 'UNTAGGED';
  let highestScore = 0;

  for (const { tag, pattern } of ROLE_PATTERNS) {
    const matches = fullText.match(new RegExp(pattern, 'gi'));
    const score = matches ? matches.length : 0;
    if (score > highestScore) {
      highestScore = score;
      bestTag = tag;
    }
  }
  return bestTag;
}

function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanConcept(explanation: string): string {
  if (!explanation) return '';
  const cleanExp = stripHtml(explanation);
  
  const stripped = cleanExp
    .replace(/^(ans|answer|solution|explanation)\s*[:\.-]?\s*([a-d]\)?)?\s*/i, '')
    .replace(/^[a-d]\)\s*/i, '')
    .trim();

  if (/^(ans|correct|option|solution|explanation)/i.test(stripped) || stripped.length < 5) {
    return '';
  }
  return stripped.substring(0, 150);
}

function extractTopic(explanation: string, fileTitle: string): string {
  const cleanExp = stripHtml(explanation);
  if (cleanExp) {
    const stripped = cleanExp
      .replace(/^(ans|answer|solution|explanation)\s*[:\.-]?\s*([a-d]\)?)?\s*/i, '')
      .replace(/^[a-d]\)\s*/i, '')
      .trim();
    if (stripped.length > 10 && !/^(ans|correct|option|solution|explanation)/i.test(stripped)) {
      return stripped.substring(0, 80).trim();
    }
  }
  const cleanTitle = stripHtml(fileTitle);
  const titleStr = cleanTitle ? cleanTitle.replace(/_/g, ' ').trim() : '';
  if (titleStr && !/^(ans|correct|option|solution|explanation)/i.test(titleStr)) {
    return titleStr.substring(0, 80);
  }
  return 'General Clinical Concept';
}

function determineSubject(fileName: string, category?: string): SubjectType {
  const cat = (category || '').toLowerCase();
  const fn = fileName.toLowerCase();

  if (fn.includes('medicine') || cat.includes('medicine')) return 'Medicine';
  if (fn.includes('surgery') || cat.includes('surgery')) return 'Surgery';
  if (fn.includes('obgy') || fn.includes('obstetric') || cat.includes('obgy')) return 'OBGY';
  if (fn.includes('pediatric') || cat.includes('pediatric')) return 'Pediatrics';
  if (fn.includes('pharmacology') || cat.includes('pharmacology')) return 'Pharmacology';
  if (fn.includes('pathology') || cat.includes('pathology')) return 'Pathology';
  if (fn.includes('psm') || fn.includes('community') || cat.includes('psm')) return 'PSM';
  if (fn.includes('ent') || cat.includes('ent')) return 'ENT';
  if (fn.includes('ophthalmology') || cat.includes('ophthalmology')) return 'Ophthalmology';
  if (fn.includes('orthopedics') || cat.includes('orthopedics')) return 'Orthopedics';
  if (fn.includes('anatomy') || fn.includes('physiology') || fn.includes('biochemistry') || fn.includes('microbiology') || fn.includes('forensic')) return 'Basic Science';
  if (fn.includes('previous year') || cat.includes('previous year')) return 'Previous Year Papers';

  return 'Medicine';
}

async function fetchWithRetry(url: string, retries = 3): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise(r => setTimeout(r, 500));
    }
  }
  throw new Error(`Failed to fetch ${url}`);
}

async function run() {
  console.log("Fetching manifest from Medtrix source...");
  const manifestUrl = "https://thesauceypotato.github.io/Medtrix-Android-Final/quiz_manifest.json";
  const manifest = await fetchWithRetry(manifestUrl);
  const fileItems = Array.isArray(manifest) ? manifest : (manifest.files || []);

  console.log(`Found ${fileItems.length} quiz data files in manifest.`);

  let allRecords: PYQItem[] = [];
  const concurrencyLimit = 80;

  for (let i = 0; i < fileItems.length; i += concurrencyLimit) {
    const chunk = fileItems.slice(i, i + concurrencyLimit);
    await Promise.all(chunk.map(async (fileObj: any) => {
      const fileName = typeof fileObj === 'string' ? fileObj : (fileObj.file || fileObj.name);
      const category = fileObj.category || '';
      const title = fileObj.title || fileName.replace('.json', '');
      const url = `https://thesauceypotato.github.io/Medtrix-Android-Final/quiz_data/${fileName}`;

      try {
        const data = await fetchWithRetry(url);
        const quizList = Array.isArray(data) ? data : (data.questions || []);

        const subject = determineSubject(fileName, category);

        let year: number | string = "Unknown";
        const yearMatch = fileName.match(/20\d{2}/) || title.match(/20\d{2}/);
        if (yearMatch) year = parseInt(yearMatch[0], 10);

        let exam: ExamType = 'NEET-PG';
        if (fileName.toLowerCase().includes('ini') || title.toLowerCase().includes('ini')) {
          exam = 'INI-CET';
        }

        for (const q of quizList) {
          const qid = q.id || Math.random().toString(36).substring(2, 10);
          const displayId = `${subject.substring(0, 3).toUpperCase()}-${year !== 'Unknown' ? year : 'UNK'}-${qid.substring(0, 5)}`;

          const rawStem = (q.text || q.question || '').trim();
          if (!rawStem) continue;
          const stem = stripHtml(rawStem);

          const rawOptions = q.options || [];
          let optA = '', optB = '', optC = '', optD = '';
          let correctAnswer: 'A' | 'B' | 'C' | 'D' | 'ANSWER-NOT-IN-SOURCE' = 'ANSWER-NOT-IN-SOURCE';

          const labels = ['A', 'B', 'C', 'D'];
          for (let idx = 0; idx < Math.min(4, rawOptions.length); idx++) {
            const opt = rawOptions[idx];
            const text = stripHtml((opt.text || opt.value || '').trim());
            const label = labels[idx];

            if (label === 'A') optA = text;
            if (label === 'B') optB = text;
            if (label === 'C') optC = text;
            if (label === 'D') optD = text;

            if (opt.correct) {
              correctAnswer = label as 'A' | 'B' | 'C' | 'D';
            }
          }

          const rawExp = (q.explanation || '').trim();
          const explanation = stripHtml(rawExp);
          const fullTextForRole = `${stem} ${optA} ${optB} ${optC} ${optD} ${explanation}`;
          const roleTag = classifyRole(fullTextForRole);

          const topic = extractTopic(explanation, title);
          const conceptTested = cleanConcept(explanation);

          allRecords.push({
            qid,
            displayId,
            sourceFile: fileName,
            exam,
            year,
            subject,
            system: q.system || 'General',
            topic,
            stem,
            options: {
              A: optA,
              B: optB,
              C: optC,
              D: optD,
            },
            correctAnswer,
            explanation,
            conceptTested,
            roleTag,
          });
        }
      } catch (err: any) {
        console.warn(`Error fetching/processing ${fileName}:`, err.message);
      }
    }));

    if ((i + concurrencyLimit) % 200 < concurrencyLimit) {
      console.log(`Processed ${Math.min(i + concurrencyLimit, fileItems.length)} / ${fileItems.length} files...`);
    }
  }

  console.log(`\nRebuild complete. Total questions processed: ${allRecords.length}`);

  // Create public/pyq-index directory
  const outDir = path.join(process.cwd(), 'public', 'pyq-index');
  await fs.mkdir(outDir, { recursive: true });

  // Group by subject
  const grouped: Record<string, PYQItem[]> = {};
  for (const record of allRecords) {
    const subKey = record.subject || 'Medicine';
    if (!grouped[subKey]) grouped[subKey] = [];
    grouped[subKey].push(record);
  }

  const subjectStats = Object.keys(grouped).map(s => ({
    name: s,
    count: grouped[s].length,
  }));

  const manifestData = {
    subjects: subjectStats,
    totalCount: allRecords.length,
    updatedAt: new Date().toISOString(),
  };

  await fs.writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifestData, null, 2));

  for (const subKey of Object.keys(grouped)) {
    const safeName = subKey.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    await fs.writeFile(path.join(outDir, `subject_${safeName}.json`), JSON.stringify(grouped[subKey]));
  }

  console.log(`Index bundles successfully created in public/pyq-index/!`);
}

run().catch((err) => {
  console.error("Fatal error during index build:", err);
  process.exit(1);
});
