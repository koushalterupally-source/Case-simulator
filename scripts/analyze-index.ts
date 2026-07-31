import fs from 'fs';
import path from 'path';

async function main() {
  const manifestPath = path.join(process.cwd(), 'public', 'pyq-index', 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.error('Manifest file not found!');
    return;
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  console.log('Total Count:', manifest.totalCount);
  console.log('Per subject breakdown:');
  console.dir(manifest.subjects, { depth: null });

  let answerNotInSource = 0;
  const roleCounts: Record<string, number> = {};
  const allQuestions: any[] = [];

  for (const sub of manifest.subjects) {
    const safeName = sub.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const filePath = path.join(process.cwd(), 'public', 'pyq-index', `subject_${safeName}.json`);
    if (fs.existsSync(filePath)) {
      const items = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      for (const item of items) {
        if (item.correctAnswer === 'ANSWER-NOT-IN-SOURCE') answerNotInSource++;
        roleCounts[item.roleTag] = (roleCounts[item.roleTag] || 0) + 1;
        allQuestions.push(item);
      }
    }
  }

  console.log('\nAnswer Not In Source:', answerNotInSource);
  console.log('Role Distribution:', roleCounts);

  console.log('\n--- 10 RANDOM SAMPLE QUESTIONS ---');
  for (let i = 0; i < 10; i++) {
    const idx = Math.floor(Math.random() * allQuestions.length);
    console.log(`\nSample ${i + 1}:`);
    console.log(JSON.stringify(allQuestions[idx], null, 2));
  }
}

main().catch(console.error);
