import wordList from './data/english-five-letter.txt?raw';
import { WORDS } from './words.js';

const validWords = new Set(wordList.trim().toUpperCase().split(/\s+/));
WORDS.forEach(({ answer }) => validWords.add(answer));
export function isValidWord(word) {
  return /^[A-Z]{5}$/.test(word) && validWords.has(word);
}
