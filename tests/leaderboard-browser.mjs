import { launchBrowser } from './browser.js';
import { createServer, preview } from 'vite';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { STORAGE_KEY } from '../src/leaderboard.js';

await mkdir('.checks', { recursive: true });
const server = await createServer({ server: { port: 5188 } });
await server.listen();
const browser = await launchBrowser();
const url = `http://localhost:${server.httpServer.address().port}`;
const record = (id, guessesUsed, elapsedMs, solved = true, completedAt = '2026-10-03T12:00:00Z', playerName = 'Twin') =>
  ({ id, playerName, word: 'STACK', solved, guessesUsed, elapsedMs, completedAt });
const fixtures = [
  ...[1, 2, 3, 4].map((i) => record(`first-${i}`, 1, i * 1000)),
  record('five-a', 2, 5001), record('five-b', 2, 5499), record('seventh', 3, 1000),
  ...Array.from({ length: 45 }, (_, i) => record(`long-${i}`, 4, 10000 + i * 1000)),
  record('loss-old', 6, 5000, false, '2026-10-02T12:00:00Z'),
  record('loss-new', 6, 1000, false, '2026-10-03T12:00:00Z', '<img src=x onerror=x>'),
];
try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(url);
  const saved = () => page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '[]'), STORAGE_KEY);
  const open = async () => { await page.getByRole('button', { name: 'Leaderboard', exact: true }).click(); };
  await open();
  assert.ok(await page.getByText('No results yet', { exact: true }).isVisible());
  for (const malformed of ['{broken', 'null', '{}', '[null,1,{"playerName":"bad"}]']) {
    await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: STORAGE_KEY, value: malformed });
    await page.reload();
    await open();
    assert.ok(await page.getByText('No results yet', { exact: true }).isVisible());
  }
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: STORAGE_KEY, value: fixtures });
  await page.reload();
  await open();
  assert.equal(await page.locator('#full-leaderboard tbody tr').count(), fixtures.length);
  assert.equal(await page.locator('#full-leaderboard .top-five').count(), 6);
  await page.screenshot({ path: '.checks/leaderboard-top.png' });
  assert.equal(await page.locator('[data-result-id="five-a"] td').first().innerText(), '5');
  assert.equal(await page.locator('[data-result-id="five-b"] td').first().innerText(), '5');
  assert.equal(await page.locator('[data-result-id="seventh"] td').first().innerText(), '7');
  assert.equal(await page.locator('[data-result-id="loss-new"] td').first().innerText(), 'Not solved');
  assert.equal(await page.locator('[data-result-id="loss-new"] img').count(), 0);
  assert.equal(await page.locator('[data-result-id="loss-new"] td').nth(1).textContent(), '<img src=x onerror=x>');
  const headBefore = await page.locator('#full-leaderboard th').first().boundingBox();
  await page.locator('#full-leaderboard').evaluate((host) => { host.scrollTop = host.scrollHeight; });
  const headAfter = await page.locator('#full-leaderboard th').first().boundingBox();
  assert.ok(Math.abs(headBefore.y - headAfter.y) < 2);
  const lastIds = await page.locator('#full-leaderboard tbody tr').evaluateAll((rows) => rows.slice(-2).map((row) => row.dataset.resultId));
  assert.deepEqual(lastIds, ['loss-new', 'loss-old']);
  await page.screenshot({ path: '.checks/leaderboard-desktop.png' });
  await page.getByRole('button', { name: '← Back', exact: true }).click();
  await page.evaluate(() => { Math.random = () => 0; });
  const start = async () => {
    await page.getByLabel('Enter your name', { exact: true }).fill('Twin');
    await page.getByLabel('Enter your name', { exact: true }).press('Enter');
  };
  const guess = async (word) => {
    await page.keyboard.type(word.toLowerCase());
    await page.keyboard.press('Enter');
    await page.waitForSelector('#board[aria-busy="false"], #result:not([hidden])');
  };
  await start();
  for (let i = 0; i < 5; i++) await guess('HOUSE');
  await page.evaluate(async () => {
    const { gameState } = await import('/src/state.js');
    const completion = gameState.round.startedAt + 10500;
    Date.now = () => completion;
  });
  await guess('STACK');
  await page.waitForSelector('#result:not([hidden])');
  const winner = (await saved()).at(-1);
  assert.equal(winner.solved, true);
  assert.equal(winner.guessesUsed, 6);
  assert.equal(winner.elapsedMs, 10500);
  assert.equal(await page.locator('#result-time').innerText(), '0:11');
  assert.equal(await page.locator('#result-leaderboard .current-attempt td').last().innerText(), '0:11');
  assert.equal(await page.locator('#result-rank').innerText(), 'Rank 53');
  assert.equal(await page.locator('#result-leaderboard tbody tr').count(), fixtures.length + 1);
  assert.equal(await page.locator('#result-leaderboard .current-attempt').count(), 1);
  assert.equal(await page.locator('#result-leaderboard .current-attempt').getAttribute('data-result-id'), winner.id);
  const checkScroll = async () => {
    await page.waitForFunction(() => document.querySelector('#result-leaderboard').scrollTop > 0);
    const bounds = await page.evaluate(() => {
      const host = document.querySelector('#result-leaderboard');
      const rect = host.getBoundingClientRect();
      const row = host.querySelector('.current-attempt').getBoundingClientRect();
      const header = host.querySelector('thead').getBoundingClientRect();
      return { rowTop: row.top, rowBottom: row.bottom, hostBottom: rect.bottom, headerBottom: header.bottom, pageScroll: window.scrollY };
    });
    assert.ok(bounds.rowTop >= bounds.headerBottom - 1 && bounds.rowBottom <= bounds.hostBottom + 1, JSON.stringify(bounds));
    assert.equal(bounds.pageScroll, 0);
    const summary = await page.locator('#result-title').boundingBox();
    const next = await page.locator('#next-player').boundingBox();
    assert.ok(summary.y >= 0 && next.y + next.height <= page.viewportSize().height);
  };
  await checkScroll();
  const length = (await saved()).length;
  await page.keyboard.press('Enter');
  await page.keyboard.type('stack');
  assert.equal((await saved()).length, length);
  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }]) {
    await page.setViewportSize(viewport);
    await page.evaluate(async (id) => {
      const { scrollToAttempt } = await import('/src/leaderboard-view.js');
      scrollToAttempt(document.querySelector('#result-leaderboard'), id);
    }, winner.id);
    await checkScroll();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: `.checks/result-${viewport.width}.png` });
  }
  await page.getByRole('button', { name: 'Next Player', exact: true }).click();
  await start();
  for (let i = 0; i < 6; i++) await guess('HOUSE');
  await page.waitForSelector('#result:not([hidden])');
  const loser = (await saved()).at(-1);
  assert.equal(loser.playerName, winner.playerName);
  assert.notEqual(loser.id, winner.id);
  assert.equal(loser.solved, false);
  assert.equal(await page.locator('#result-rank').innerText(), 'Not solved');
  assert.equal(await page.locator('#result-leaderboard .current-attempt').getAttribute('data-result-id'), loser.id);
  assert.equal(await page.locator('#result-leaderboard .current-attempt.top-five').count(), 0);
  await checkScroll();
  await page.getByRole('button', { name: 'Next Player', exact: true }).click();
  await start();
  const beforeAbandon = (await saved()).length;
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '← Back', exact: true }).click();
  assert.equal((await saved()).length, beforeAbandon);
  await page.reload();
  await open();
  assert.equal(await page.locator('#full-leaderboard tbody tr').count(), beforeAbandon);
  assert.ok(await page.locator('#full-leaderboard').evaluate((host, id) => [...host.querySelectorAll('tr')].some((row) => row.dataset.resultId === id), loser.id));
  // A storage event with malformed contents must also be safe, without refresh.
  await page.evaluate((key) => {
    localStorage.setItem(key, '{broken');
    dispatchEvent(new StorageEvent('storage', { key, newValue: '{broken' }));
  }, STORAGE_KEY);
  assert.ok(await page.getByText('No results yet', { exact: true }).isVisible());
  assert.ok(await page.locator('#clear-leaderboard').isDisabled());
  assert.deepEqual(errors, []);
  console.log('PASS: empty/malformed storage, ties and rank-five highlights, plain-text names, sticky headers, long-list current-ID scroll, duplicate names, mobile summary/footer, win/loss saves, idempotence, abandonment, refresh persistence.');
  // Check persistence through a refresh of the actual production bundle too.
  const production = await preview({ preview: { port: 4191 } });
  try {
    await page.goto(`http://localhost:${production.httpServer.address().port}`);
    await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: STORAGE_KEY, value: fixtures });
    await page.reload();
    await open();
    assert.equal(await page.locator('#full-leaderboard tbody tr').count(), fixtures.length);
    assert.equal(await page.locator('#full-leaderboard .top-five').count(), 6);
    page.once('dialog', (dialog) => {
      assert.equal(dialog.message(), 'Clear all leaderboard results? This cannot be undone.');
      return dialog.dismiss();
    });
    await page.locator('#clear-leaderboard').click();
    assert.equal((await saved()).length, fixtures.length);
    await page.evaluate(() => { localStorage.setItem('unrelated-preference', 'keep'); });
    // A failed storage deletion must retain visible results and report failure.
    await page.evaluate(() => {
      window.originalRemoveItem = Storage.prototype.removeItem;
      Storage.prototype.removeItem = () => { throw Error('blocked'); };
    });
    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('#clear-leaderboard').click();
    assert.equal(await page.locator('#full-leaderboard tbody tr').count(), fixtures.length);
    assert.equal(await page.locator('#clear-message').innerText(), 'Leaderboard could not be cleared on this browser.');
    await page.evaluate(() => { Storage.prototype.removeItem = window.originalRemoveItem; });
    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('#clear-leaderboard').focus();
    await page.keyboard.press('Enter');
    assert.ok(await page.getByText('No results yet', { exact: true }).isVisible());
    assert.ok(await page.locator('#clear-leaderboard').isDisabled());
    assert.equal((await saved()).length, 0);
    assert.equal(await page.evaluate(() => localStorage.getItem('unrelated-preference')), 'keep');
    await page.reload();
    await open();
    assert.ok(await page.getByText('No results yet', { exact: true }).isVisible());
    assert.deepEqual(errors, []);
    console.log('PASS: production leaderboard, clear confirmation/cancel, keyboard activation, storage failure, unrelated data preservation and refresh persistence.');
  } finally { await new Promise((resolve) => production.httpServer.close(resolve)); }
} finally {
  await browser.close();
  await server.close();
}
