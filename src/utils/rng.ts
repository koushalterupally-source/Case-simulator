/**
 * Simple, fast seedable Pseudo-Random Number Generator (PRNG) - Mulberry32
 */
export function createPRNG(seedStr: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 16777619);
  }
  let state = h;

  return function next(): number {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Shuffles options for a PYQItem deterministically or randomly,
 * updating the correctAnswer key accordingly.
 */
export function shufflePYQOptions(
  options: { A: string; B: string; C: string; D: string },
  correctAnswer: 'A' | 'B' | 'C' | 'D' | 'ANSWER-NOT-IN-SOURCE',
  prng?: () => number
): {
  shuffledOptions: { A: string; B: string; C: string; D: string };
  newCorrectAnswer: 'A' | 'B' | 'C' | 'D' | 'ANSWER-NOT-IN-SOURCE';
} {
  if (correctAnswer === 'ANSWER-NOT-IN-SOURCE') {
    return { shuffledOptions: { ...options }, newCorrectAnswer: 'ANSWER-NOT-IN-SOURCE' };
  }

  const random = prng || Math.random;

  const entries: { originalKey: 'A' | 'B' | 'C' | 'D'; text: string }[] = [
    { originalKey: 'A', text: options.A },
    { originalKey: 'B', text: options.B },
    { originalKey: 'C', text: options.C },
    { originalKey: 'D', text: options.D },
  ];

  // Fisher-Yates shuffle
  for (let i = entries.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [entries[i], entries[j]] = [entries[j], entries[i]];
  }

  const keys: ('A' | 'B' | 'C' | 'D')[] = ['A', 'B', 'C', 'D'];
  const shuffledOptions: { A: string; B: string; C: string; D: string } = {
    A: '',
    B: '',
    C: '',
    D: '',
  };

  let newCorrectAnswer: 'A' | 'B' | 'C' | 'D' = 'A';

  entries.forEach((item, index) => {
    const newKey = keys[index];
    shuffledOptions[newKey] = item.text;
    if (item.originalKey === correctAnswer) {
      newCorrectAnswer = newKey;
    }
  });

  return { shuffledOptions, newCorrectAnswer };
}
