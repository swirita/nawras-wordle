// Themed answer pool. The broader local dictionary validates English guesses.
const categories = {
  'Data Structures': ['STACK', 'QUEUE', 'ARRAY', 'NODES'],
  Programming: ['LOGIC', 'CODES', 'INPUT', 'BYTES'],
  'Software Problems': ['ERROR', 'CRASH'],
  'Fixing Code': ['DEBUG'],
  Cybersecurity: ['HACKS', 'CYBER'],
  Connectivity: ['WIRED'],
  Learning: ['LEARN', 'NOTES', 'STUDY'],
  'Tech Community': ['GEEKS', 'NERDY'],
  'University Life': ['BOOKS', 'MAJOR', 'CLASS'],
  'Technology & Systems': ['APPLE', 'LINUX'],
};

export const WORDS = Object.freeze(
  Object.entries(categories).flatMap(([category, answers]) =>
    answers.map((answer) => Object.freeze({ answer, category })),
  ),
);

export const RULES = Object.freeze({ language: 'en', wordLength: 5, maxGuesses: 6 });

// Rejection sampling avoids the bias of reducing every uint32 modulo the pool size.
export function randomIndex(size, cryptoSource = globalThis.crypto) {
  if (!Number.isInteger(size) || size < 1 || size > 2 ** 32) throw new RangeError('Invalid pool size');
  if (size === 1) return 0;
  const limit = 2 ** 32 - (2 ** 32 % size);
  const sample = new Uint32Array(1);
  do { cryptoSource.getRandomValues(sample); } while (sample[0] >= limit);
  return sample[0] % size;
}

export function selectWord(previousAnswer = null, pool = WORDS, cryptoSource = globalThis.crypto) {
  const unique = [...new Map(pool.map((word) => [word.answer, word])).values()];
  if (!unique.length) throw new RangeError('Empty word pool');
  const eligible = unique.length > 1 ? unique.filter(({ answer }) => answer !== previousAnswer) : unique;
  return eligible[randomIndex(eligible.length, cryptoSource)];
}
