import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evaluateGuess, updateKeyFeedback, elapsedMs, formatTime } from '../src/round.js';
import { WORDS } from '../src/words.js';

const C = 'correct', P = 'present', A = 'absent';
test('exact matches reserve occurrences before assigning yellow', () => {
  assert.deepEqual(evaluateGuess('GEESE', 'GEEKS'), [C, C, C, P, A]);
  assert.deepEqual(evaluateGuess('ARRAY', 'MAJOR'), [P, P, A, A, A]);
  assert.deepEqual(evaluateGuess('ERROR', 'ARRAY'), [A, C, C, A, A]);
});
test('surplus repeated letters are gray and remaining duplicates can be yellow', () => {
  assert.deepEqual(evaluateGuess('ALLEY', 'APPLE'), [C, P, A, P, A]);
  assert.deepEqual(evaluateGuess('EERIE', 'ERROR'), [C, A, C, A, A]);
  assert.deepEqual(evaluateGuess('RARAR', 'ARRAY'), [P, P, C, C, A]);
});
test('all exact matches and all absent letters', () => {
  assert.deepEqual(evaluateGuess('QUEUE', 'QUEUE'), [C, C, C, C, C]);
  assert.deepEqual(evaluateGuess('BYTES', 'CRASH'), [A, A, A, A, P]);
});
test('feedback never credits more occurrences than the answer contains', () => {
  for (const { answer } of WORDS) {
    for (const { answer: guess } of WORDS) {
      const result = evaluateGuess(guess, answer);
      for (const letter of new Set(guess)) {
        const credited = [...guess].filter((value, i) => value === letter && result[i] !== A).length;
        assert.ok(credited <= [...answer].filter((value) => value === letter).length);
      }
    }
  }
});
test('keyboard keeps the strongest evidence across guesses and duplicates', () => {
  const keys = {};
  updateKeyFeedback(keys, 'ALLEY', evaluateGuess('ALLEY', 'APPLE'));
  assert.equal(keys.L, P);
  updateKeyFeedback(keys, 'APPLE', evaluateGuess('APPLE', 'APPLE'));
  updateKeyFeedback(keys, 'ALLEY', evaluateGuess('ALLEY', 'APPLE'));
  assert.equal(keys.A, C);
  assert.equal(keys.L, C);
  assert.equal(keys.E, C);
});
test('elapsed time uses timestamps and freezes at submission', () => {
  const round = { startedAt: 1000, completedAt: null };
  assert.equal(elapsedMs(round, 126000), 125000);
  round.completedAt = 66543;
  assert.equal(elapsedMs(round, 900000), 65543);
  assert.equal(formatTime(65543), '1:05');
});
test('local dictionary is broad, five letters only, and answer union accepts every answer', () => {
  const entries = readFileSync(new URL('../src/data/english-five-letter.txt', import.meta.url), 'utf8').trim().split(/\s+/);
  assert.ok(entries.length > 10000);
  assert.ok(entries.every((entry) => /^[a-z]{5}$/.test(entry)));
  const dictionary = new Set([...entries.map((entry) => entry.toUpperCase()), ...WORDS.map(({ answer }) => answer)]);
  for (const { answer } of WORDS) assert.ok(dictionary.has(answer));
  for (const word of ['HOUSE', 'WATER', 'ALLEY', 'GEESE', 'EERIE']) assert.ok(dictionary.has(word));
  assert.ok(!dictionary.has('ZZZZZ'));
});
