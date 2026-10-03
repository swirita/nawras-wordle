import { launchBrowser } from './browser.js';
import { createServer, preview } from 'vite';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

await mkdir('.checks', { recursive: true });
const server = await createServer({ server: { port: 0 } });
await server.listen();
const url = `http://localhost:${server.httpServer.address().port}`;
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(url);
  assert.ok(await page.evaluate(async () => {
    const { isValidWord } = await import('/src/dictionary.js');
    const { WORDS } = await import('/src/words.js');
    return WORDS.every(({ answer }) => isValidWord(answer)) && isValidWord('HOUSE') && !isValidWord('ZZZZZ');
  }));
  await page.evaluate(async () => {
    window.testState = (await import('/src/state.js')).gameState;
    const originalNow = Date.now;
    window.timeOffset = 0;
    Date.now = () => originalNow() + window.timeOffset;
    Math.random = () => 0; // STACK for deterministic browser scenarios.
  });
  const input = page.getByLabel('Enter your name', { exact: true });
  const state = () => page.evaluate(() => JSON.parse(JSON.stringify(window.testState)));
  const start = async (name) => {
    await input.fill(name);
    await input.press('Enter');
    await page.waitForFunction(() => window.testState.round?.status === 'playing');
  };
  const type = async (word) => { await page.keyboard.type(word.toLowerCase()); };
  const submit = async () => {
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => !window.testState.round.revealing);
  };
  const next = async () => {
    await page.getByRole('button', { name: 'Next Player', exact: true }).click();
    assert.equal(await input.inputValue(), '');
    assert.equal((await state()).round, null);
  };
  await start('Input check');
  await page.keyboard.press('f');
  await page.waitForFunction(() => Boolean(document.fullscreenElement));
  assert.equal((await state()).round.currentGuess, '');
  await page.waitForFunction(() => document.querySelector('#fullscreen-button').getAttribute('aria-pressed') === 'true');
  await page.keyboard.press('f');
  await page.waitForFunction(() => !document.fullscreenElement);
  await page.waitForFunction(() => document.querySelector('#fullscreen-button').getAttribute('aria-pressed') === 'false');
  await page.keyboard.press('Shift+F');
  assert.equal((await state()).round.currentGuess, 'F');
  await page.keyboard.press('Backspace');
  await page.locator('[data-key="F"]').click();
  assert.equal((await state()).round.currentGuess, 'F');
  await page.keyboard.press('Backspace');
  await page.locator('#fullscreen-button').click();
  await page.waitForFunction(() => Boolean(document.fullscreenElement));
  await page.locator('#fullscreen-button').click();
  await page.waitForFunction(() => !document.fullscreenElement);
  await page.locator('#game-title').focus();
  assert.equal(await page.locator('#board .tile').count(), 30);
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Shift+A');
  assert.equal((await state()).round.currentGuess, '');
  await page.getByRole('button', { name: 'A', exact: true }).click();
  await page.getByRole('button', { name: 'Backspace', exact: true }).click();
  assert.equal((await state()).round.currentGuess, '');
  await page.getByRole('button', { name: 'Enter', exact: true }).click();
  assert.equal(await page.locator('#game-message').innerText(), 'Not enough letters');
  await type('ZZZZZ');
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('#game-message').innerText(), 'Word not found');
  assert.equal((await state()).round.guesses.length, 0);
  for (let i = 0; i < 5; i++) await page.keyboard.press('Backspace');
  // Validate entirely offline, including guesses beyond the answer pool.
  await page.context().setOffline(true);
  await type('HOUSE');
  await page.keyboard.press('Enter');
  assert.ok((await state()).round.revealing);
  await type('STACK');
  assert.equal((await state()).round.currentGuess, 'HOUSE');
  assert.ok(await page.getByRole('button', { name: 'A', exact: true }).isDisabled());
  await page.waitForFunction(() => !window.testState.round.revealing);
  assert.equal((await state()).round.guesses.length, 1);
  await page.context().setOffline(false);
  assert.equal(await page.locator('.board-row').first().innerText(), 'H\nO\nU\nS\nE');
  await type('A');
  assert.equal(await page.locator('.board-row').first().innerText(), 'H\nO\nU\nS\nE');
  await page.keyboard.press('Backspace');
  // Simulate an inactive interval without relying on interval ticks.
  const before = await state();
  await page.evaluate(() => {
    window.timeOffset += 125000;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const displayed = await page.locator('#elapsed-time').innerText();
  assert.ok(displayed.startsWith('2:'), displayed);
  assert.ok((await page.evaluate(() => Date.now())) - before.round.startedAt >= 125000);
  // Cancel and then accept abandoning the active round.
  page.once('dialog', (dialog) => { assert.equal(dialog.message(), 'Leave this round?'); return dialog.dismiss(); });
  await page.getByRole('button', { name: '← Back', exact: true }).click();
  assert.ok(await page.locator('#game').isVisible());
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '← Back', exact: true }).click();
  assert.equal((await state()).round, null);
  assert.equal((await state()).completedResult, null);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await start('Sixth guess winner');
  for (let i = 0; i < 5; i++) { await type('HOUSE'); await submit(); }
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await type('STACK');
  await page.getByRole('button', { name: 'Enter', exact: true }).click();
  const finalSubmission = await state();
  assert.equal(finalSubmission.round.status, 'won');
  assert.equal(finalSubmission.round.guesses.length, 6);
  const frozenTime = finalSubmission.round.completionTimeMs;
  await page.evaluate(() => { window.timeOffset += 60000; });
  await type('AAAAA');
  assert.equal((await state()).round.guesses.length, 6);
  await page.waitForFunction(() => document.querySelector('#board').classList.contains('celebrating'));
  await page.waitForSelector('#result:not([hidden])');
  assert.equal(await page.locator('#result-title').innerText(), 'Solved!');
  assert.equal(await page.locator('#result-guesses').innerText(), '6');
  assert.equal((await state()).completedResult.elapsedMs, frozenTime);
  assert.equal(await page.locator('#result-answer').innerText(), 'STACK');
  await next();
  assert.ok((await state()).completedResult.won);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await start('Sixth guess loser');
  assert.equal((await state()).round.guesses.length, 0);
  assert.ok((await state()).round.startedAt > finalSubmission.round.startedAt);
  await page.evaluate(() => {
    window.celebrated = false;
    new MutationObserver(() => {
      if (document.querySelector('#board').classList.contains('celebrating')) window.celebrated = true;
    }).observe(document.querySelector('#board'), { attributes: true, attributeFilter: ['class'] });
  });
  for (let i = 0; i < 6; i++) { await type('HOUSE'); await submit(); }
  await page.waitForSelector('#result:not([hidden])');
  assert.equal(await page.locator('#result-title').innerText(), 'Not solved');
  assert.equal((await state()).completedResult.guessesUsed, 6);
  assert.equal(await page.evaluate(() => window.celebrated), false);
  await next();
  await page.evaluate(() => { Math.random = () => 22.1 / 24; }); // APPLE
  await start('Repeated letters');
  for (const letter of 'ALLEY') await page.getByRole('button', { name: letter, exact: true }).click();
  await page.getByRole('button', { name: 'Enter', exact: true }).click();
  await page.waitForFunction(() => !window.testState.round.revealing);
  assert.deepEqual((await state()).round.guesses[0].feedback, ['correct', 'present', 'absent', 'present', 'absent']);
  assert.equal(await page.locator('[data-key="L"]').getAttribute('data-feedback'), 'present');
  for (const viewport of [{ width: 1366, height: 768 }, { width: 390, height: 844 }, { width: 320, height: 568 }]) {
    await page.setViewportSize(viewport);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const boardBounds = await page.locator('#board').boundingBox();
    const keysBounds = await page.locator('#keyboard').boundingBox();
    assert.ok(boardBounds.y >= 0 && keysBounds.y + keysBounds.height <= viewport.height, JSON.stringify({ viewport, boardBounds, keysBounds }));
    if (viewport.width !== 320) await page.screenshot({ path: `.checks/game-${viewport.width}.png` });
  }
  await type('APPLE');
  await submit();
  await page.waitForSelector('#result:not([hidden])');
  assert.equal((await state()).completedResult.answer, 'APPLE');
  assert.deepEqual(errors, []);
  console.log('PASS: physical/on-screen input, modified shortcuts, invalid guesses, offline dictionary, current-row editing, reveal lock, timestamps, abandonment, sixth-guess win/loss, celebration, result retention, fresh rounds, repeated letters, laptop/mobile layout.');
  const production = await preview({ preview: { port: 4190 } });
  try {
    await page.goto(`http://localhost:${production.httpServer.address().port}`);
    assert.equal(await page.title(), 'Nawras Wordle');
    assert.equal(await page.locator('link[rel="icon"]').getAttribute('href'), '/assets/nawras-small.png');
    await input.fill('Production player');
    await input.press('Enter');
    await page.context().setOffline(true);
    await type('HOUSE');
    await page.getByRole('button', { name: 'Enter', exact: true }).click();
    await page.waitForSelector('#board[aria-busy="false"]');
    assert.equal(await page.locator('.tile[data-feedback]').count(), 5);
    assert.deepEqual(errors, []);
    console.log('PASS: production bundle gameplay, offline dictionary, title and NS favicon.');
  } finally {
    await page.context().setOffline(false);
    await new Promise((resolve) => production.httpServer.close(resolve));
  }
} finally {
  await browser.close();
  await server.close();
}
