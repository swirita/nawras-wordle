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

export function selectWord() {
  return WORDS[Math.floor(Math.random() * WORDS.length)];
}
