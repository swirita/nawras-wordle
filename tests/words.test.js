import test from 'node:test';
import assert from 'node:assert/strict';
import { WORDS, randomIndex, selectWord } from '../src/words.js';

const source = (...samples) => ({ getRandomValues(buffer) {
  assert.ok(samples.length, 'Unexpected entropy request');
  buffer[0] = samples.shift();
  return buffer;
} });

test('each unique word has one equally reachable index; duplicates do not add weight', () => {
  const pool = [...WORDS, WORDS[0], WORDS[0]];
  assert.deepEqual(WORDS.map((_, index) => selectWord(null, pool, source(index))), WORDS);
});

test('every remaining unique answer is reachable when the previous answer is excluded', () => {
  for (const previous of WORDS) {
    const remaining = WORDS.filter(({ answer }) => answer !== previous.answer);
    assert.deepEqual(remaining.map((_, index) => selectWord(previous.answer, WORDS, source(index))), remaining);
  }
});

test('fresh samples choose from remaining words, without a fixed sequence', () => {
  const entropy = source(4, 10, 2, 18, 0);
  let previous = null;
  const selected = [];
  for (let round = 0; round < 5; round++) {
    const word = selectWord(previous, WORDS, entropy);
    assert.notEqual(word.answer, previous);
    selected.push(word.answer);
    previous = word.answer;
  }
  assert.deepEqual(selected, ['LOGIC', 'HACKS', 'ARRAY', 'BOOKS', 'STACK']);
});

test('uint32 rejection sampling discards the incomplete modulo bucket', () => {
  assert.equal(randomIndex(3, source(0xffffffff, 0xfffffffe)), 2);
  assert.equal(randomIndex(24, source(0xffffffff, 0xfffffff0, 23)), 23);
});

test('one unique word returns immediately even when it was the previous answer', () => {
  assert.equal(selectWord('STACK', [WORDS[0], WORDS[0]], source()), WORDS[0]);
  assert.throws(() => selectWord(null, [], source()), RangeError);
});
