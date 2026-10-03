import test from 'node:test';
import assert from 'node:assert/strict';
import { STORAGE_KEY, loadResults, saveResult, rankResults, roundedSeconds, resultTime } from '../src/leaderboard.js';

const attempt = (id, guessesUsed = 2, elapsedMs = 10000, solved = true, completedAt = '2026-10-03T12:00:00.000Z') =>
  ({ id, playerName: 'Same name', word: 'STACK', solved, guessesUsed, elapsedMs, completedAt });
function storage(raw = null) {
  return { raw, writes: 0, getItem(key) { assert.equal(key, STORAGE_KEY); return this.raw; },
    setItem(key, value) { assert.equal(key, STORAGE_KEY); this.writes++; this.raw = value; } };
}
test('saving is idempotent by ID, preserves milliseconds, and keeps duplicate names', () => {
  const target = storage();
  saveResult(attempt('first', 2, 10499), [], target);
  saveResult(attempt('first', 2, 10499), [], target);
  assert.equal(target.writes, 1);
  saveResult(attempt('second'), [], target);
  const saved = loadResults(target);
  assert.equal(saved.length, 2);
  assert.equal(saved[0].elapsedMs, 10499);
  assert.equal(saved[0].playerName, saved[1].playerName);
});
test('fewest guesses come first regardless of speed, then rounded seconds', () => {
  const rows = rankResults([attempt('fast-three', 3, 1000), attempt('slow-two', 2, 99999), attempt('fast-two', 2, 10000)]);
  assert.deepEqual(rows.map(({ id }) => id), ['fast-two', 'slow-two', 'fast-three']);
  assert.equal(roundedSeconds(10499), 10);
  assert.equal(roundedSeconds(10500), 11);
  assert.equal(resultTime(59500), '1:00');
});
test('displayed ties share competition ranks and dates only stabilize row order', () => {
  const rows = rankResults([
    attempt('tie-new', 2, 10499, true, '2026-10-03T14:00:00Z'),
    attempt('first', 1, 30000), attempt('fourth', 2, 10500),
    attempt('tie-old', 2, 10001, true, '2026-10-03T11:00:00Z'),
  ]);
  assert.deepEqual(rows.map(({ rank }) => rank), [1, 2, 2, 4]);
  assert.deepEqual(rows.map(({ id }) => id), ['first', 'tie-old', 'tie-new', 'fourth']);
});
test('everyone tied at rank five is highlighted and losses are newest first below winners', () => {
  const rows = rankResults([
    ...[1, 2, 3, 4].map((i) => attempt(`winner-${i}`, 1, i * 1000)),
    attempt('fifth-b', 1, 50499), attempt('fifth-a', 1, 50001), attempt('seventh', 2, 0),
    attempt('loss-old', 6, 1, false, '2026-10-02T12:00:00Z'),
    attempt('loss-new', 6, 0, false, '2026-10-03T13:00:00Z'),
  ]);
  assert.deepEqual(rows.slice(4, 6).map(({ rank, topFive }) => [rank, topFive]), [[5, true], [5, true]]);
  assert.equal(rows[6].rank, 7);
  assert.equal(rows[6].topFive, false);
  assert.deepEqual(rows.slice(7).map(({ id, rank, topFive }) => [id, rank, topFive]), [['loss-new', null, false], ['loss-old', null, false]]);
});
test('missing, malformed, partial, and duplicate stored records are safe', () => {
  for (const raw of [null, '', '{broken', 'null', '{}', '42', '[null,1,"bad"]']) assert.deepEqual(loadResults(storage(raw)), []);
  const good = attempt('good');
  const bad = [null, { ...good, id: 'bad-time', elapsedMs: -1 }, { ...good, id: 'bad-solved', solved: 'yes' },
    { ...good, id: 'bad-date', completedAt: 'nope' }, { ...good, id: 'abandoned', solved: false, guessesUsed: 2 }];
  assert.deepEqual(loadResults(storage(JSON.stringify([...bad, good, good]))), [good]);
  const target = storage('{broken');
  assert.equal(saveResult(good, [], target).saved, true);
  assert.deepEqual(loadResults(target), [good]);
});
test('unavailable storage and quota errors retain a usable in-memory leaderboard', () => {
  const unavailable = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } };
  assert.deepEqual(loadResults(unavailable), []);
  const good = attempt('memory');
  assert.deepEqual(saveResult(good, [], unavailable), { results: [good], saved: false });
  const quota = { getItem() { return null; }, setItem() { throw Error('quota'); } };
  assert.equal(saveResult(good, [], quota).saved, false);
});
