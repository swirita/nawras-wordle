import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { launchBrowser, stubWordRandom } from './browser.js';
import { WORDS } from '../src/words.js';
import { STORAGE_KEY } from '../src/leaderboard.js';

const server = await createServer({ server: { port: 0 } });
await server.listen();
let browser;
try {
  browser = await launchBrowser();
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`http://localhost:${server.httpServer.address().port}`);
  await page.evaluate(stubWordRandom, 0);
  const attach = () => page.evaluate(async () => {
    window.state = (await import('/src/state.js')).gameState;
  });
  await attach();
  const state = () => page.evaluate(() => structuredClone(window.state));
  const calls = () => page.evaluate(() => window.wordRandomCalls);
  const start = async () => {
    await page.locator('#player-name').fill('Same name');
    await page.locator('#player-name').press('Enter');
  };
  const guess = async (word) => {
    await page.locator('#game-title').focus();
    await page.keyboard.type(word.toLowerCase());
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => !window.state.round.revealing);
  };
  const leave = async () => {
    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('#game [data-back]').click();
  };

  await start();
  const first = (await state()).round;
  assert.equal(first.word.answer, 'STACK');
  assert.equal(await calls(), 1);
  await guess('HOUSE');
  for (let i = 0; i < 3; i++) await page.locator('#hint-button').click();
  await page.keyboard.type('ab');
  await page.evaluate(() => {
    window.state.round.startedAt -= 65000;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  assert.deepEqual((await state()).round.word, first.word);
  assert.equal(await calls(), 1); // Guesses, typing, hints, rendering and timer updates never select.

  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('#retry-button').click();
  const retry = (await state()).round;
  assert.equal(retry.word.answer, 'QUEUE'); // Zero now indexes the pool without STACK.
  assert.equal(await calls(), 2);
  assert.notEqual(retry.id, first.id);
  assert.equal(retry.playerName, first.playerName);
  assert.equal(retry.isRetry, true);
  assert.deepEqual(retry.guesses, []);
  assert.deepEqual(retry.hintPositions, []);
  assert.deepEqual(retry.keys, {});
  assert.equal(retry.hintsUsed, 0);
  assert.equal(retry.currentGuess, '');
  assert.equal(retry.completedAt, null);
  assert.equal(retry.completionTimeMs, null);
  assert.equal(retry.revealing, false);
  assert.equal((await state()).completedResult, null);
  assert.equal(await page.locator('#elapsed-time').innerText(), '0:00');
  assert.equal(await page.locator('#category-hint').innerText(), `Hint: ${retry.word.category} · Practice`);

  await leave();
  await page.evaluate(stubWordRandom, 10);
  await start();
  const restarted = (await state()).round;
  assert.deepEqual(restarted.word, WORDS.filter(({ answer }) => answer !== retry.word.answer)[10]);
  assert.equal(restarted.isRetry, false);
  assert.equal(await calls(), 1);
  await guess(restarted.word.answer);
  await page.waitForSelector('#result:not([hidden])');
  await page.locator('#next-player').click();
  await page.locator('#leaderboard-button').click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('#clear-leaderboard').click();
  assert.equal(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY), null);
  await page.locator('#leaderboard [data-back]').click();
  await page.evaluate(stubWordRandom, 17);
  await start();
  const afterClear = (await state()).round;
  assert.deepEqual(afterClear.word, WORDS.filter(({ answer }) => answer !== restarted.word.answer)[17]);
  assert.equal(await calls(), 1);
  assert.notEqual(afterClear.word.answer, restarted.word.answer);

  // The project's full reset is clearing site data and reloading; no reset UI exists.
  await leave();
  await page.evaluate(() => localStorage.clear());
  await page.addInitScript(stubWordRandom, 22);
  await page.reload();
  await attach();
  assert.deepEqual(await state(), { round: null, completedResult: null });
  assert.equal(await calls(), 0);
  await start();
  assert.deepEqual((await state()).round.word, WORDS[22]);
  assert.equal(await calls(), 1);
  assert.deepEqual(errors, []);
  console.log('PASS: same-name starts, active/result resets, fresh Retry, one selection per round, synchronized category, leaderboard clearing and fresh randomness after full reset.');
} finally {
  await browser?.close();
  await server.close();
}
